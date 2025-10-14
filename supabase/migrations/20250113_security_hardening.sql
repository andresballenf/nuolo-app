-- Security Hardening Migration
-- Created: 2025-01-13
-- Purpose: Add processed_transactions table and RLS policies for security

-- ============================================================================
-- 1. CREATE PROCESSED_TRANSACTIONS TABLE
-- ============================================================================
-- Prevents replay attacks by tracking all processed purchase transactions

CREATE TABLE IF NOT EXISTS processed_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android')),
  processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processed_transactions_txn_id
  ON processed_transactions(transaction_id);

CREATE INDEX IF NOT EXISTS idx_processed_transactions_user_id
  ON processed_transactions(user_id);

CREATE INDEX IF NOT EXISTS idx_processed_transactions_processed_at
  ON processed_transactions(processed_at DESC);

-- Add comment for documentation
COMMENT ON TABLE processed_transactions IS
  'Tracks all processed IAP transactions to prevent replay attacks';

-- ============================================================================
-- 2. ENABLE ROW LEVEL SECURITY (RLS) ON ALL USER TABLES
-- ============================================================================

-- User profiles
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- User subscriptions
ALTER TABLE IF EXISTS user_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own subscriptions" ON user_subscriptions;
CREATE POLICY "Users can view own subscriptions"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage subscriptions" ON user_subscriptions;
CREATE POLICY "Service role can manage subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- User purchases
ALTER TABLE IF EXISTS user_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own purchases" ON user_purchases;
CREATE POLICY "Users can view own purchases"
  ON user_purchases FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage purchases" ON user_purchases;
CREATE POLICY "Service role can manage purchases"
  ON user_purchases FOR ALL
  USING (auth.role() = 'service_role');

-- User usage tracking
ALTER TABLE IF EXISTS user_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own usage" ON user_usage;
CREATE POLICY "Users can view own usage"
  ON user_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own usage" ON user_usage;
CREATE POLICY "Users can update own usage"
  ON user_usage FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage usage" ON user_usage;
CREATE POLICY "Service role can manage usage"
  ON user_usage FOR ALL
  USING (auth.role() = 'service_role');

-- Processed transactions (very restrictive)
ALTER TABLE processed_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own processed transactions" ON processed_transactions;
CREATE POLICY "Users can view own processed transactions"
  ON processed_transactions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service role can manage processed transactions" ON processed_transactions;
CREATE POLICY "Service role can manage processed transactions"
  ON processed_transactions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================================================
-- 3. READONLY ACCESS FOR PUBLIC DATA
-- ============================================================================

-- Attraction packages (public catalog)
ALTER TABLE IF EXISTS attraction_packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packages" ON attraction_packages;
CREATE POLICY "Anyone can view active packages"
  ON attraction_packages FOR SELECT
  USING (is_active = true);

-- Attraction packs (legacy, public catalog)
ALTER TABLE IF EXISTS attraction_packs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view active packs" ON attraction_packs;
CREATE POLICY "Anyone can view active packs"
  ON attraction_packs FOR SELECT
  USING (is_active = true);

-- ============================================================================
-- 4. SECURITY FUNCTIONS
-- ============================================================================

-- Function to check if user can access a specific transaction
CREATE OR REPLACE FUNCTION can_access_transaction(transaction_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM processed_transactions
    WHERE id = transaction_uuid
    AND user_id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's purchase history securely
CREATE OR REPLACE FUNCTION get_user_purchase_history()
RETURNS TABLE (
  transaction_id TEXT,
  product_id TEXT,
  platform TEXT,
  processed_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT pt.transaction_id, pt.product_id, pt.platform, pt.processed_at
  FROM processed_transactions pt
  WHERE pt.user_id = auth.uid()
  ORDER BY pt.processed_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 5. AUDIT LOGGING
-- ============================================================================

-- Create audit log table for security events
CREATE TABLE IF NOT EXISTS security_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address INET,
  user_agent TEXT,
  event_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_user_id
  ON security_audit_log(user_id);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_event_type
  ON security_audit_log(event_type);

CREATE INDEX IF NOT EXISTS idx_security_audit_log_created_at
  ON security_audit_log(created_at DESC);

-- RLS for audit log (only service role can access)
ALTER TABLE security_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role can manage audit logs" ON security_audit_log;
CREATE POLICY "Service role can manage audit logs"
  ON security_audit_log FOR ALL
  USING (auth.role() = 'service_role');

-- Function to log security events
CREATE OR REPLACE FUNCTION log_security_event(
  p_event_type TEXT,
  p_event_data JSONB DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO security_audit_log (event_type, user_id, event_data)
  VALUES (p_event_type, auth.uid(), p_event_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions to authenticated users
GRANT SELECT ON processed_transactions TO authenticated;
GRANT SELECT ON attraction_packages TO authenticated, anon;
GRANT SELECT ON attraction_packs TO authenticated, anon;

-- Grant all permissions to service role (already has by default, but explicit is clear)
GRANT ALL ON processed_transactions TO service_role;
GRANT ALL ON security_audit_log TO service_role;

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

-- Log migration completion
DO $$
BEGIN
  RAISE NOTICE 'Security hardening migration completed successfully';
  RAISE NOTICE 'Created processed_transactions table';
  RAISE NOTICE 'Enabled RLS on all user tables';
  RAISE NOTICE 'Created security audit logging';
END $$;
