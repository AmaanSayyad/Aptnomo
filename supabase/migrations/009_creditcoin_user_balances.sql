-- Migration: Update user_balances table for CreditCoin (CTC) support
-- Task: 2.1 Create database migration script for user_balances table
-- Requirements: 4.1, 4.4, 4.5, 4.6

-- Add currency column with default 'CTC'
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'CTC' NOT NULL;

-- Update balance column precision from NUMERIC(20,8) to NUMERIC(20,18) for CTC
-- This requires creating a new column, copying data, dropping old, and renaming
ALTER TABLE user_balances 
ADD COLUMN balance_new NUMERIC(20, 18);

-- Copy existing balances to new column (converting from 8 to 18 decimals)
UPDATE user_balances 
SET balance_new = balance;

-- Drop old balance column
ALTER TABLE user_balances 
DROP COLUMN balance;

-- Rename new column to balance
ALTER TABLE user_balances 
RENAME COLUMN balance_new TO balance;

-- Add NOT NULL and DEFAULT constraints to new balance column
ALTER TABLE user_balances 
ALTER COLUMN balance SET NOT NULL,
ALTER COLUMN balance SET DEFAULT 0,
ADD CONSTRAINT balance_non_negative CHECK (balance >= 0);

-- Create index on currency column for efficient filtering
CREATE INDEX IF NOT EXISTS idx_user_balances_currency ON user_balances(currency);

-- Update table comment
COMMENT ON TABLE user_balances IS 'Tracks CTC token balances for users in the house balance system on CreditCoin testnet';

-- Update column comments
COMMENT ON COLUMN user_balances.user_address IS 'EVM wallet address (0x...)';
COMMENT ON COLUMN user_balances.currency IS 'Currency type (default: CTC for CreditCoin)';
COMMENT ON COLUMN user_balances.balance IS 'Current house balance in CTC tokens (18 decimal places)';
COMMENT ON COLUMN user_balances.updated_at IS 'Timestamp of last balance update';
COMMENT ON COLUMN user_balances.created_at IS 'Timestamp when user first deposited';

-- Enable Row Level Security
ALTER TABLE user_balances ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read access" ON user_balances;
DROP POLICY IF EXISTS "Allow public insert access" ON user_balances;

-- Create RLS policies for public read and insert
CREATE POLICY "Allow public read access" 
ON user_balances 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert access" 
ON user_balances 
FOR INSERT 
WITH CHECK (true);

-- Create policy for public update (needed for balance updates)
CREATE POLICY "Allow public update access" 
ON user_balances 
FOR UPDATE 
USING (true)
WITH CHECK (true);
