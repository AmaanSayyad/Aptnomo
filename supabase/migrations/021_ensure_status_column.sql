-- Migration: Ensure status column exists in user_balances with proper default
-- This fixes any issues where the status column might be missing

-- Add status column if it doesn't exist (idempotent)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'user_balances' 
        AND column_name = 'status'
    ) THEN
        ALTER TABLE user_balances 
        ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
        
        COMMENT ON COLUMN user_balances.status IS 'User account status: active, frozen, or banned';
    END IF;
END $$;

-- Ensure existing rows have a status value
UPDATE user_balances 
SET status = 'active' 
WHERE status IS NULL;

-- Create index on status for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_balances_status ON user_balances(status);
