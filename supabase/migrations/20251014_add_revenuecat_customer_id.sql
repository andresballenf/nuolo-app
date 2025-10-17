-- Add RevenueCat customer ID to profiles
-- Migration: 20251014_add_revenuecat_customer_id.sql

-- Add revenuecat_customer_id column to profiles table (if it exists)
-- If profiles table doesn't exist, you may need to create it first
DO $$
BEGIN
    -- Try to add column to profiles table
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'profiles') THEN
        ALTER TABLE profiles
        ADD COLUMN IF NOT EXISTS revenuecat_customer_id TEXT UNIQUE;

        -- Add index for faster lookups
        CREATE INDEX IF NOT EXISTS idx_profiles_revenuecat_customer_id
        ON profiles(revenuecat_customer_id);

        RAISE NOTICE 'Added revenuecat_customer_id to profiles table';
    ELSE
        -- Create profiles table if it doesn't exist
        CREATE TABLE profiles (
            id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
            revenuecat_customer_id TEXT UNIQUE,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Create index
        CREATE INDEX idx_profiles_revenuecat_customer_id
        ON profiles(revenuecat_customer_id);

        -- Enable RLS
        ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

        -- RLS Policies
        CREATE POLICY "Users can view own profile" ON profiles
            FOR SELECT USING (auth.uid() = id);

        CREATE POLICY "Users can update own profile" ON profiles
            FOR UPDATE USING (auth.uid() = id);

        CREATE POLICY "Users can insert own profile" ON profiles
            FOR INSERT WITH CHECK (auth.uid() = id);

        -- Service role policies
        CREATE POLICY "Service can manage all profiles" ON profiles
            FOR ALL USING (current_setting('request.jwt.claims', true)::json->>'role' = 'service_role');

        RAISE NOTICE 'Created profiles table with revenuecat_customer_id';
    END IF;
END $$;

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT ALL ON profiles TO service_role;

-- Comment on column
COMMENT ON COLUMN profiles.revenuecat_customer_id IS 'RevenueCat customer identifier for cross-platform purchase management';
