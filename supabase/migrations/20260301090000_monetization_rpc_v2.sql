-- Monetization RPC v2 contract
-- Purpose:
-- 1) Provide schema-drift-tolerant entitlement/subscription reads for the client
-- 2) Provide a single write path for attraction usage recording
-- 3) Keep RevenueCat webhook as source-of-truth while stabilizing client contracts

CREATE OR REPLACE FUNCTION get_user_subscription_state_v2(user_uuid UUID)
RETURNS TABLE (
  is_active BOOLEAN,
  subscription_type TEXT,
  expires_at TIMESTAMPTZ,
  in_grace_period BOOLEAN,
  in_trial BOOLEAN,
  trial_ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  WITH raw_subscriptions AS (
    SELECT to_jsonb(us) AS payload
    FROM user_subscriptions us
    WHERE us.user_id = user_uuid
  ),
  normalized AS (
    SELECT
      COALESCE(NULLIF(payload->>'subscription_type', ''), 'free') AS normalized_subscription_type,
      CASE
        WHEN LOWER(COALESCE(payload->>'is_active', '')) IN ('true', 'false')
          THEN (payload->>'is_active')::BOOLEAN
        WHEN LOWER(COALESCE(payload->>'status', '')) IN ('active', 'grace_period', 'trial')
          THEN TRUE
        ELSE FALSE
      END AS raw_is_active,
      COALESCE(
        NULLIF(payload->>'expiration_date', '')::TIMESTAMPTZ,
        NULLIF(payload->>'expires_at', '')::TIMESTAMPTZ
      ) AS normalized_expires_at,
      LOWER(COALESCE(payload->>'status', '')) = 'grace_period' AS normalized_in_grace_period,
      LOWER(COALESCE(payload->>'status', '')) = 'trial' AS normalized_in_trial,
      NULLIF(payload->>'trial_ends_at', '')::TIMESTAMPTZ AS normalized_trial_ends_at,
      COALESCE(
        NULLIF(payload->>'updated_at', '')::TIMESTAMPTZ,
        NULLIF(payload->>'created_at', '')::TIMESTAMPTZ,
        NOW()
      ) AS sort_timestamp
    FROM raw_subscriptions
  ),
  candidate AS (
    SELECT
      normalized_subscription_type,
      (raw_is_active AND (normalized_expires_at IS NULL OR normalized_expires_at > NOW())) AS normalized_is_active,
      normalized_expires_at,
      normalized_in_grace_period,
      normalized_in_trial,
      normalized_trial_ends_at,
      sort_timestamp
    FROM normalized
    ORDER BY sort_timestamp DESC, normalized_expires_at DESC NULLS LAST
    LIMIT 1
  )
  SELECT
    COALESCE(candidate.normalized_is_active, FALSE),
    COALESCE(candidate.normalized_subscription_type, 'free'),
    candidate.normalized_expires_at,
    COALESCE(candidate.normalized_in_grace_period, FALSE),
    COALESCE(candidate.normalized_in_trial, FALSE),
    candidate.normalized_trial_ends_at
  FROM candidate
  UNION ALL
  SELECT FALSE, 'free', NULL::TIMESTAMPTZ, FALSE, FALSE, NULL::TIMESTAMPTZ
  WHERE NOT EXISTS (SELECT 1 FROM candidate);
END;
$$;

CREATE OR REPLACE FUNCTION get_user_entitlements_v2(user_uuid UUID)
RETURNS TABLE (
  has_unlimited_access BOOLEAN,
  total_attraction_limit INTEGER,
  attractions_used INTEGER,
  attractions_remaining INTEGER,
  owned_packages TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  subscription_row RECORD;
  package_limit INTEGER := 0;
  usage_count INTEGER := 0;
  owned_packages_array TEXT[] := ARRAY[]::TEXT[];
  unlimited BOOLEAN := FALSE;
  total_limit INTEGER := 2;
BEGIN
  SELECT *
  INTO subscription_row
  FROM get_user_subscription_state_v2(user_uuid)
  LIMIT 1;

  IF COALESCE(subscription_row.is_active, FALSE) AND
     COALESCE(subscription_row.subscription_type, 'free') IN (
       'unlimited_monthly',
       'premium_monthly',
       'premium_yearly',
       'lifetime'
     ) THEN
    unlimited := TRUE;
  END IF;

  SELECT
    COALESCE(SUM(ap.attraction_count), 0)::INTEGER,
    COALESCE(ARRAY_AGG(DISTINCT upp.package_id), ARRAY[]::TEXT[])
  INTO package_limit, owned_packages_array
  FROM user_package_purchases upp
  JOIN attraction_packages ap ON ap.id = upp.package_id
  WHERE upp.user_id = user_uuid
    AND ap.is_active = TRUE;

  SELECT
    COALESCE(
      MAX(NULLIF(to_jsonb(uu)->>'usage_count', '')::INTEGER),
      0
    )
  INTO usage_count
  FROM user_usage uu
  WHERE uu.user_id = user_uuid;

  IF unlimited THEN
    RETURN QUERY SELECT
      TRUE,
      1000000,
      0,
      1000000,
      ARRAY[]::TEXT[];
    RETURN;
  END IF;

  total_limit := GREATEST(2, COALESCE(package_limit, 0));

  RETURN QUERY SELECT
    FALSE,
    total_limit,
    usage_count,
    GREATEST(0, total_limit - usage_count),
    COALESCE(owned_packages_array, ARRAY[]::TEXT[]);
END;
$$;

CREATE OR REPLACE FUNCTION can_user_access_attraction_v2(
  user_uuid UUID,
  attraction_id TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entitlement_row RECORD;
  already_counted BOOLEAN := FALSE;
BEGIN
  SELECT * INTO entitlement_row
  FROM get_user_entitlements_v2(user_uuid)
  LIMIT 1;

  IF COALESCE(entitlement_row.has_unlimited_access, FALSE) THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_usage uu
    WHERE uu.user_id = user_uuid
      AND (
        (
          to_jsonb(uu) ? 'attraction_id'
          AND to_jsonb(uu)->>'attraction_id' = attraction_id
        )
        OR (
          jsonb_typeof(to_jsonb(uu)->'attractions_used') = 'array'
          AND (to_jsonb(uu)->'attractions_used') ? attraction_id
        )
      )
  )
  INTO already_counted;

  IF already_counted THEN
    RETURN TRUE;
  END IF;

  RETURN COALESCE(entitlement_row.attractions_remaining, 0) > 0;
END;
$$;

CREATE OR REPLACE FUNCTION record_attraction_usage_v2(
  user_uuid UUID,
  attraction_id TEXT
)
RETURNS TABLE (
  recorded BOOLEAN,
  reason TEXT,
  total_attraction_limit INTEGER,
  attractions_used INTEGER,
  attractions_remaining INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entitlement_row RECORD;
  updated_entitlement_row RECORD;
  already_counted BOOLEAN := FALSE;
  has_attractions_used BOOLEAN := FALSE;
  has_package_usage_count BOOLEAN := FALSE;
BEGIN
  SELECT * INTO entitlement_row
  FROM get_user_entitlements_v2(user_uuid)
  LIMIT 1;

  IF COALESCE(entitlement_row.has_unlimited_access, FALSE) THEN
    RETURN QUERY SELECT
      FALSE,
      'unlimited_access',
      entitlement_row.total_attraction_limit,
      entitlement_row.attractions_used,
      entitlement_row.attractions_remaining;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM user_usage uu
    WHERE uu.user_id = user_uuid
      AND (
        (
          to_jsonb(uu) ? 'attraction_id'
          AND to_jsonb(uu)->>'attraction_id' = attraction_id
        )
        OR (
          jsonb_typeof(to_jsonb(uu)->'attractions_used') = 'array'
          AND (to_jsonb(uu)->'attractions_used') ? attraction_id
        )
      )
  )
  INTO already_counted;

  IF already_counted THEN
    RETURN QUERY SELECT
      FALSE,
      'already_recorded',
      entitlement_row.total_attraction_limit,
      entitlement_row.attractions_used,
      entitlement_row.attractions_remaining;
    RETURN;
  END IF;

  IF COALESCE(entitlement_row.attractions_remaining, 0) <= 0 THEN
    RETURN QUERY SELECT
      FALSE,
      'limit_exceeded',
      entitlement_row.total_attraction_limit,
      entitlement_row.attractions_used,
      entitlement_row.attractions_remaining;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_usage'
      AND column_name = 'attractions_used'
  )
  INTO has_attractions_used;

  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'user_usage'
      AND column_name = 'package_usage_count'
  )
  INTO has_package_usage_count;

  IF has_attractions_used AND has_package_usage_count THEN
    INSERT INTO user_usage (user_id, usage_count, package_usage_count, attractions_used, updated_at)
    VALUES (user_uuid, 1, 1, jsonb_build_array(attraction_id), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      usage_count = COALESCE(user_usage.usage_count, 0) + 1,
      package_usage_count = COALESCE(user_usage.package_usage_count, 0) + 1,
      attractions_used = CASE
        WHEN user_usage.attractions_used @> jsonb_build_array(attraction_id) THEN user_usage.attractions_used
        ELSE COALESCE(user_usage.attractions_used, '[]'::jsonb) || jsonb_build_array(attraction_id)
      END,
      updated_at = NOW();
  ELSIF has_attractions_used THEN
    INSERT INTO user_usage (user_id, usage_count, attractions_used, updated_at)
    VALUES (user_uuid, 1, jsonb_build_array(attraction_id), NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      usage_count = COALESCE(user_usage.usage_count, 0) + 1,
      attractions_used = CASE
        WHEN user_usage.attractions_used @> jsonb_build_array(attraction_id) THEN user_usage.attractions_used
        ELSE COALESCE(user_usage.attractions_used, '[]'::jsonb) || jsonb_build_array(attraction_id)
      END,
      updated_at = NOW();
  ELSIF has_package_usage_count THEN
    INSERT INTO user_usage (user_id, usage_count, package_usage_count, updated_at)
    VALUES (user_uuid, 1, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      usage_count = COALESCE(user_usage.usage_count, 0) + 1,
      package_usage_count = COALESCE(user_usage.package_usage_count, 0) + 1,
      updated_at = NOW();
  ELSE
    INSERT INTO user_usage (user_id, usage_count, updated_at)
    VALUES (user_uuid, 1, NOW())
    ON CONFLICT (user_id) DO UPDATE SET
      usage_count = COALESCE(user_usage.usage_count, 0) + 1,
      updated_at = NOW();
  END IF;

  SELECT * INTO updated_entitlement_row
  FROM get_user_entitlements_v2(user_uuid)
  LIMIT 1;

  RETURN QUERY SELECT
    TRUE,
    'recorded',
    updated_entitlement_row.total_attraction_limit,
    updated_entitlement_row.attractions_used,
    updated_entitlement_row.attractions_remaining;
END;
$$;

GRANT EXECUTE ON FUNCTION get_user_subscription_state_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_entitlements_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_access_attraction_v2(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_attraction_usage_v2(UUID, TEXT) TO authenticated;

GRANT EXECUTE ON FUNCTION get_user_subscription_state_v2(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_user_entitlements_v2(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION can_user_access_attraction_v2(UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION record_attraction_usage_v2(UUID, TEXT) TO service_role;
