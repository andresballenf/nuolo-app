-- Nuolo App In-App Purchase System
-- Migration: 20241211_purchase_system.sql

-- User subscription status and entitlements
CREATE TABLE user_subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  subscription_type TEXT NOT NULL, -- 'premium_monthly', 'premium_yearly', 'lifetime'
  status TEXT NOT NULL, -- 'active', 'expired', 'cancelled', 'grace_period', 'trial'
  platform TEXT NOT NULL, -- 'ios', 'android', 'web'
  original_transaction_id TEXT UNIQUE NOT NULL, -- Platform's original transaction ID
  latest_receipt_info JSONB, -- Platform-specific receipt data
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_subscription_type CHECK (subscription_type IN ('premium_monthly', 'premium_yearly', 'lifetime')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'expired', 'cancelled', 'grace_period', 'trial')),
  CONSTRAINT valid_platform CHECK (platform IN ('ios', 'android', 'web')),
  UNIQUE(user_id, subscription_type, platform)
);

-- Individual attraction purchases
CREATE TABLE user_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL, -- 'attraction_pack_nyc', 'single_attraction_123'
  platform_transaction_id TEXT UNIQUE NOT NULL,
  purchase_type TEXT NOT NULL, -- 'single_attraction', 'attraction_pack'
  item_data JSONB NOT NULL, -- Attraction IDs, pack info, etc.
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_purchase_type CHECK (purchase_type IN ('single_attraction', 'attraction_pack'))
);

-- Free tier usage tracking
CREATE TABLE user_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  attractions_used JSONB DEFAULT '[]'::jsonb, -- Array of attraction IDs
  usage_count INTEGER DEFAULT 0,
  reset_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'), -- Monthly reset
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Attraction packs definition (managed content)
CREATE TABLE attraction_packs (
  id TEXT PRIMARY KEY, -- 'pack_nyc_landmarks', 'pack_paris_museums'
  name TEXT NOT NULL,
  description TEXT,
  price_usd DECIMAL(10,2) NOT NULL,
  attraction_ids JSONB NOT NULL, -- Array of attraction IDs
  region TEXT,
  category TEXT,
  image_url TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Platform-specific product configurations
CREATE TABLE iap_products (
  id TEXT PRIMARY KEY, -- SKU/Product ID from stores
  internal_id TEXT NOT NULL, -- Maps to subscription_type or product_id
  platform TEXT NOT NULL, -- 'ios', 'android'
  product_type TEXT NOT NULL, -- 'subscription', 'consumable', 'non_consumable'
  price_tier TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_iap_platform CHECK (platform IN ('ios', 'android')),
  CONSTRAINT valid_product_type CHECK (product_type IN ('subscription', 'consumable', 'non_consumable'))
);

-- Indexes for performance
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_status ON user_subscriptions(status) WHERE status = 'active';
CREATE INDEX idx_user_subscriptions_expires_at ON user_subscriptions(expires_at);
CREATE INDEX idx_user_purchases_user_id ON user_purchases(user_id);
CREATE INDEX idx_user_purchases_product_id ON user_purchases(product_id);
CREATE INDEX idx_user_usage_user_id ON user_usage(user_id);
CREATE INDEX idx_attraction_packs_active ON attraction_packs(active) WHERE active = TRUE;
CREATE INDEX idx_iap_products_platform ON iap_products(platform, active) WHERE active = TRUE;

-- Enable Row Level Security
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE attraction_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE iap_products ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Users can only access their own data
CREATE POLICY "Users can view own subscriptions" ON user_subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own purchases" ON user_purchases
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can view own usage" ON user_usage
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Public can view active packs" ON attraction_packs
  FOR SELECT USING (active = TRUE);

CREATE POLICY "Public can view active products" ON iap_products
  FOR SELECT USING (active = TRUE);

-- Service role policies for server-side operations
CREATE POLICY "Service can manage all subscriptions" ON user_subscriptions
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service can manage all purchases" ON user_purchases
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service can manage all usage" ON user_usage
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service can manage all packs" ON attraction_packs
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service can manage all products" ON iap_products
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Helper functions

-- Function to get user's current subscription status
CREATE OR REPLACE FUNCTION get_user_subscription_status(user_uuid UUID)
RETURNS TABLE (
  subscription_type TEXT,
  status TEXT,
  expires_at TIMESTAMPTZ,
  is_active BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    us.subscription_type,
    us.status,
    us.expires_at,
    (us.expires_at > NOW() AND us.status = 'active') AS is_active
  FROM user_subscriptions us
  WHERE us.user_id = user_uuid
    AND us.status IN ('active', 'grace_period', 'trial')
  ORDER BY us.expires_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can access attraction
CREATE OR REPLACE FUNCTION can_user_access_attraction(user_uuid UUID, attraction_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_subscription BOOLEAN := FALSE;
  owns_attraction BOOLEAN := FALSE;
  free_usage_remaining BOOLEAN := FALSE;
BEGIN
  -- Check if user has active subscription
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = user_uuid 
      AND status = 'active' 
      AND expires_at > NOW()
      AND subscription_type != 'free'
  ) INTO has_subscription;
  
  IF has_subscription THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns this specific attraction
  SELECT EXISTS (
    SELECT 1 FROM user_purchases up
    WHERE up.user_id = user_uuid
      AND (
        (up.purchase_type = 'single_attraction' AND up.product_id = 'attraction_' || attraction_id)
        OR
        (up.purchase_type = 'attraction_pack' AND up.item_data->>'attractionIds' @> ('["' || attraction_id || '"]')::jsonb)
      )
  ) INTO owns_attraction;
  
  IF owns_attraction THEN
    RETURN TRUE;
  END IF;
  
  -- Check free tier usage
  SELECT (COALESCE(usage_count, 0) < 2) INTO free_usage_remaining
  FROM user_usage
  WHERE user_id = user_uuid;
  
  RETURN COALESCE(free_usage_remaining, TRUE); -- TRUE if no usage record exists
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to record attraction usage
CREATE OR REPLACE FUNCTION record_attraction_usage(user_uuid UUID, attraction_id TEXT)
RETURNS VOID AS $$
BEGIN
  INSERT INTO user_usage (user_id, attractions_used, usage_count)
  VALUES (
    user_uuid,
    jsonb_build_array(attraction_id),
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    attractions_used = CASE 
      WHEN user_usage.attractions_used @> jsonb_build_array(attraction_id) THEN user_usage.attractions_used
      ELSE user_usage.attractions_used || jsonb_build_array(attraction_id)
    END,
    usage_count = CASE
      WHEN user_usage.attractions_used @> jsonb_build_array(attraction_id) THEN user_usage.usage_count
      ELSE user_usage.usage_count + 1
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert some sample data for testing
INSERT INTO attraction_packs (id, name, description, price_usd, attraction_ids, region, category) VALUES
('pack_nyc_landmarks', 'NYC Landmarks Pack', 'Explore iconic New York City landmarks including Statue of Liberty, Central Park, and more', 9.99, '["nyc_statue_of_liberty", "nyc_central_park", "nyc_empire_state", "nyc_brooklyn_bridge"]', 'New York', 'landmarks'),
('pack_paris_museums', 'Paris Museums Pack', 'Discover world-famous Paris museums including the Louvre, Musée d''Orsay, and more', 12.99, '["paris_louvre", "paris_orsay", "paris_rodin", "paris_picasso"]', 'Paris', 'museums'),
('pack_london_royalty', 'London Royal Sites', 'Tour the royal heritage of London with Buckingham Palace, Tower of London, and more', 11.99, '["london_buckingham", "london_tower", "london_westminster", "london_windsor"]', 'London', 'royal');

INSERT INTO iap_products (id, internal_id, platform, product_type) VALUES
-- iOS Products
('nuolo_premium_monthly', 'premium_monthly', 'ios', 'subscription'),
('nuolo_premium_yearly', 'premium_yearly', 'ios', 'subscription'),
('nuolo_lifetime', 'lifetime', 'ios', 'non_consumable'),
('pack_nyc_landmarks', 'pack_nyc_landmarks', 'ios', 'non_consumable'),
('pack_paris_museums', 'pack_paris_museums', 'ios', 'non_consumable'),
('pack_london_royalty', 'pack_london_royalty', 'ios', 'non_consumable'),

-- Android Products
('nuolo_premium_monthly', 'premium_monthly', 'android', 'subscription'),
('nuolo_premium_yearly', 'premium_yearly', 'android', 'subscription'),
('nuolo_lifetime', 'lifetime', 'android', 'non_consumable'),
('pack_nyc_landmarks', 'pack_nyc_landmarks', 'android', 'non_consumable'),
('pack_paris_museums', 'pack_paris_museums', 'android', 'non_consumable'),
('pack_london_royalty', 'pack_london_royalty', 'android', 'non_consumable');

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT ON attraction_packs TO anon, authenticated;
GRANT SELECT ON iap_products TO anon, authenticated;
GRANT ALL ON user_subscriptions TO authenticated;
GRANT ALL ON user_purchases TO authenticated;
GRANT ALL ON user_usage TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_subscription_status(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_access_attraction(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION record_attraction_usage(UUID, TEXT) TO authenticated;