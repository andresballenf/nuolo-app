-- Nuolo App Package System Migration
-- Migration: 20250109_package_system.sql
-- Adds attraction packages (Basic, Standard, Premium) + monthly unlimited

-- Add attraction packages table for the new package tiers
CREATE TABLE attraction_packages (
  id TEXT PRIMARY KEY, -- 'basic_package', 'standard_package', 'premium_package'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  attraction_count INTEGER NOT NULL, -- 5, 20, 50
  price_usd DECIMAL(10,2) NOT NULL, -- 3.99, 9.99, 19.99
  apple_product_id TEXT NOT NULL,
  google_product_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  badge_text TEXT, -- 'Most Popular', etc.
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track user package purchases
CREATE TABLE user_package_purchases (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  package_id TEXT REFERENCES attraction_packages(id),
  platform_transaction_id TEXT UNIQUE NOT NULL,
  purchased_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, package_id) -- User can only buy each package once
);

-- Add package limit tracking to user_usage
ALTER TABLE user_usage 
ADD COLUMN package_limit INTEGER DEFAULT 2, -- Default to free tier (2)
ADD COLUMN package_usage_count INTEGER DEFAULT 0; -- Attractions used with current package

-- Update subscription types to include monthly unlimited
ALTER TABLE user_subscriptions 
DROP CONSTRAINT valid_subscription_type,
ADD CONSTRAINT valid_subscription_type CHECK (subscription_type IN ('premium_monthly', 'premium_yearly', 'lifetime', 'unlimited_monthly'));

-- Create indexes for performance
CREATE INDEX idx_user_package_purchases_user_id ON user_package_purchases(user_id);
CREATE INDEX idx_user_package_purchases_package_id ON user_package_purchases(package_id);
CREATE INDEX idx_attraction_packages_is_active ON attraction_packages(is_active, sort_order) WHERE is_active = TRUE;

-- Enable Row Level Security
ALTER TABLE attraction_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_package_purchases ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Public can view active packages" ON attraction_packages
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Users can view own package purchases" ON user_package_purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Service role policies
CREATE POLICY "Service can manage all packages" ON attraction_packages
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

CREATE POLICY "Service can manage all package purchases" ON user_package_purchases
  FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

-- Helper function to get user's package entitlements
CREATE OR REPLACE FUNCTION get_user_package_entitlements(user_uuid UUID)
RETURNS TABLE (
  total_attraction_limit INTEGER,
  attractions_used INTEGER,
  remaining_attractions INTEGER,
  owned_packages TEXT[]
) AS $$
DECLARE
  user_packages TEXT[];
  max_package_limit INTEGER := 2; -- Default free tier
  current_usage INTEGER := 0;
BEGIN
  -- Get user's owned packages
  SELECT ARRAY_AGG(package_id) INTO user_packages
  FROM user_package_purchases 
  WHERE user_id = user_uuid;
  
  -- If user has packages, find the highest limit
  IF user_packages IS NOT NULL AND array_length(user_packages, 1) > 0 THEN
    SELECT MAX(attraction_count) INTO max_package_limit
    FROM attraction_packages 
    WHERE id = ANY(user_packages) AND is_active = TRUE;
  END IF;
  
  -- Get current usage count
  SELECT COALESCE(usage_count, 0) INTO current_usage
  FROM user_usage
  WHERE user_id = user_uuid;
  
  -- Return entitlements
  RETURN QUERY SELECT 
    max_package_limit,
    current_usage,
    GREATEST(0, max_package_limit - current_usage),
    COALESCE(user_packages, ARRAY[]::TEXT[]);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Updated function to check access with packages
CREATE OR REPLACE FUNCTION can_user_access_attraction_with_packages(user_uuid UUID, attraction_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  has_unlimited_subscription BOOLEAN := FALSE;
  user_limit INTEGER;
  current_usage INTEGER;
BEGIN
  -- Check if user has unlimited subscription
  SELECT EXISTS (
    SELECT 1 FROM user_subscriptions 
    WHERE user_id = user_uuid 
      AND status = 'active' 
      AND expires_at > NOW()
      AND subscription_type IN ('unlimited_monthly', 'premium_monthly', 'premium_yearly', 'lifetime')
  ) INTO has_unlimited_subscription;
  
  IF has_unlimited_subscription THEN
    RETURN TRUE;
  END IF;
  
  -- Check if user owns this specific attraction
  IF EXISTS (
    SELECT 1 FROM user_purchases up
    WHERE up.user_id = user_uuid
      AND (
        (up.purchase_type = 'single_attraction' AND up.product_id = 'attraction_' || attraction_id)
        OR
        (up.purchase_type = 'attraction_pack' AND up.item_data->>'attractionIds' @> ('["' || attraction_id || '"]')::jsonb)
      )
  ) THEN
    RETURN TRUE;
  END IF;
  
  -- Check package/free tier limits
  SELECT total_attraction_limit, attractions_used 
  INTO user_limit, current_usage
  FROM get_user_package_entitlements(user_uuid);
  
  RETURN current_usage < user_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert the new attraction packages
INSERT INTO attraction_packages (id, name, description, attraction_count, price_usd, apple_product_id, google_product_id, sort_order, badge_text) VALUES
('basic_package', 'Basic Package', 'Perfect for trying out premium content', 5, 3.99, 'nuolo_basic_package', 'nuolo_basic_package', 1, NULL),
('standard_package', 'Standard Package', 'Great value for regular travelers', 20, 9.99, 'nuolo_standard_package', 'nuolo_standard_package', 2, 'Most Popular'),
('premium_package', 'Premium Package', 'Maximum flexibility for frequent explorers', 50, 19.99, 'nuolo_premium_package', 'nuolo_premium_package', 3, 'Best Value');

-- Add new IAP products for packages
INSERT INTO iap_products (id, internal_id, platform, product_type) VALUES
-- iOS Package Products
('nuolo_basic_package', 'basic_package', 'ios', 'non_consumable'),
('nuolo_standard_package', 'standard_package', 'ios', 'non_consumable'),
('nuolo_premium_package', 'premium_package', 'ios', 'non_consumable'),
('nuolo_unlimited_monthly', 'unlimited_monthly', 'ios', 'subscription'),

-- Android Package Products
('nuolo_basic_package', 'basic_package', 'android', 'non_consumable'),
('nuolo_standard_package', 'standard_package', 'android', 'non_consumable'),
('nuolo_premium_package', 'premium_package', 'android', 'non_consumable'),
('nuolo_unlimited_monthly', 'unlimited_monthly', 'android', 'subscription');

-- Grant permissions on new tables
GRANT SELECT ON attraction_packages TO anon, authenticated;
GRANT ALL ON user_package_purchases TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_package_entitlements(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION can_user_access_attraction_with_packages(UUID, TEXT) TO authenticated;