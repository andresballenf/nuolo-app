-- Fix package credits calculation to SUM all purchases instead of MAX
-- This allows users to buy packages multiple times and accumulate credits

-- 1. Remove UNIQUE constraint that prevents buying same package multiple times
ALTER TABLE user_package_purchases DROP CONSTRAINT IF EXISTS user_package_purchases_user_id_package_id_key;

-- 2. Drop and recreate the get_user_package_entitlements function to use SUM instead of MAX
DROP FUNCTION IF EXISTS get_user_package_entitlements(UUID);

CREATE FUNCTION get_user_package_entitlements(user_uuid UUID)
RETURNS TABLE (
  total_attraction_limit INTEGER,
  has_unlimited_access BOOLEAN,
  attractions_used INTEGER,
  attractions_remaining INTEGER,
  owned_packages TEXT[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  active_subscription RECORD;
  max_package_limit INTEGER := 0;
  used_count INTEGER := 0;
  owned_packages_array TEXT[];
BEGIN
  -- Check for active unlimited monthly subscription
  SELECT * INTO active_subscription
  FROM user_subscriptions
  WHERE user_id = user_uuid
    AND subscription_type = 'unlimited_monthly'
    AND is_active = TRUE
    AND (expiration_date IS NULL OR expiration_date > NOW());

  -- If user has active unlimited subscription, return unlimited access
  IF active_subscription.user_id IS NOT NULL THEN
    RETURN QUERY SELECT
      1000000 as total_attraction_limit,
      TRUE as has_unlimited_access,
      0 as attractions_used,
      1000000 as attractions_remaining,
      ARRAY[]::TEXT[] as owned_packages;
    RETURN;
  END IF;

  -- Calculate SUM of all purchased packages (not MAX) and get owned package IDs
  SELECT
    COALESCE(SUM(ap.attraction_count), 0),
    array_agg(DISTINCT upp.package_id)
  INTO max_package_limit, owned_packages_array
  FROM user_package_purchases upp
  JOIN attraction_packages ap ON upp.package_id = ap.id
  WHERE upp.user_id = user_uuid AND ap.is_active = TRUE;

  -- Get count of attractions used
  SELECT COUNT(*) INTO used_count
  FROM user_usage
  WHERE user_id = user_uuid;

  -- Return package-based entitlements
  RETURN QUERY SELECT
    max_package_limit as total_attraction_limit,
    FALSE as has_unlimited_access,
    used_count as attractions_used,
    GREATEST(max_package_limit - used_count, 0) as attractions_remaining,
    COALESCE(owned_packages_array, ARRAY[]::TEXT[]) as owned_packages;
END;
$$;

-- 3. Drop and recreate can_user_access_attraction_with_packages function to use the new logic
DROP FUNCTION IF EXISTS can_user_access_attraction_with_packages(UUID, UUID);

CREATE FUNCTION can_user_access_attraction_with_packages(
  user_uuid UUID,
  attraction_uuid UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  entitlements RECORD;
  already_used BOOLEAN;
BEGIN
  -- Get user entitlements
  SELECT * INTO entitlements
  FROM get_user_package_entitlements(user_uuid);

  -- Check if user already used this attraction
  SELECT EXISTS(
    SELECT 1 FROM user_usage
    WHERE user_id = user_uuid AND attraction_id = attraction_uuid
  ) INTO already_used;

  -- If already used, allow access (they already paid for it)
  IF already_used THEN
    RETURN TRUE;
  END IF;

  -- If unlimited access, allow
  IF entitlements.has_unlimited_access THEN
    RETURN TRUE;
  END IF;

  -- If they have remaining attractions, allow
  IF entitlements.attractions_remaining > 0 THEN
    RETURN TRUE;
  END IF;

  -- Otherwise, deny access
  RETURN FALSE;
END;
$$;
