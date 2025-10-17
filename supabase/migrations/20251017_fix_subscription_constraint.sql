-- Fix subscription_type constraint to allow unlimited_monthly
-- This ensures the constraint includes all valid subscription types

ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS valid_subscription_type;
ALTER TABLE user_subscriptions DROP CONSTRAINT IF EXISTS user_subscriptions_subscription_type_check;

ALTER TABLE user_subscriptions
ADD CONSTRAINT valid_subscription_type
CHECK (subscription_type IN ('premium_monthly', 'premium_yearly', 'lifetime', 'unlimited_monthly'));
