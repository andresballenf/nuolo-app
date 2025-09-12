-- Fix missing columns in user_usage table
-- Migration: 20250111_fix_user_usage_columns.sql
-- Adds package_limit and package_usage_count columns that were referenced but not created

-- Check if columns exist before adding them (to make migration idempotent)
DO $$ 
BEGIN
    -- Add package_limit column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_usage' 
        AND column_name = 'package_limit'
    ) THEN
        ALTER TABLE user_usage 
        ADD COLUMN package_limit INTEGER DEFAULT 2; -- Default to free tier (2)
        
        -- Update existing rows to set package_limit based on user entitlements
        UPDATE user_usage u
        SET package_limit = COALESCE(
            (SELECT MAX(ap.attraction_count)
             FROM user_package_purchases upp
             JOIN attraction_packages ap ON upp.package_id = ap.id
             WHERE upp.user_id = u.user_id
             AND ap.is_active = TRUE),
            2 -- Default to free tier if no packages
        );
    END IF;

    -- Add package_usage_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_usage' 
        AND column_name = 'package_usage_count'
    ) THEN
        ALTER TABLE user_usage 
        ADD COLUMN package_usage_count INTEGER DEFAULT 0; -- Attractions used with current package
        
        -- Initialize package_usage_count to match current usage_count
        UPDATE user_usage
        SET package_usage_count = COALESCE(usage_count, 0);
    END IF;
END $$;

-- Create index for performance on the new columns
CREATE INDEX IF NOT EXISTS idx_user_usage_package_limit ON user_usage(user_id, package_limit);
CREATE INDEX IF NOT EXISTS idx_user_usage_package_usage ON user_usage(user_id, package_usage_count);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON user_usage TO authenticated;