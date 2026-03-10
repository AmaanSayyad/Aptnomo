-- Migration: Create balance_audit_log table for CreditCoin (CTC) audit trail
-- Task: 2.3 Create database migration script for balance_audit_log table
-- Requirements: 4.3, 4.4, 4.5, 4.6

-- Create balance_audit_log table
CREATE TABLE IF NOT EXISTS balance_audit_log (
  id SERIAL PRIMARY KEY,
  user_address TEXT NOT NULL,
  currency TEXT DEFAULT 'CTC' NOT NULL,
  operation TEXT NOT NULL,
  amount NUMERIC(20, 18) NOT NULL,
  balance_before NUMERIC(20, 18) NOT NULL,
  balance_after NUMERIC(20, 18) NOT NULL,
  tx_hash TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON balance_audit_log(user_address);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON balance_audit_log(created_at DESC);

-- Add table comment
COMMENT ON TABLE balance_audit_log IS 'Audit trail for all balance-changing operations (deposits, withdrawals, bets, payouts, refunds) on CreditCoin testnet';

-- Add column comments
COMMENT ON COLUMN balance_audit_log.id IS 'Auto-incrementing primary key';
COMMENT ON COLUMN balance_audit_log.user_address IS 'User EVM wallet address (0x...)';
COMMENT ON COLUMN balance_audit_log.currency IS 'Currency type (default: CTC for CreditCoin)';
COMMENT ON COLUMN balance_audit_log.operation IS 'Operation type: deposit, withdraw, bet_debit, bet_credit, refund';
COMMENT ON COLUMN balance_audit_log.amount IS 'Amount involved in the operation (18 decimal places)';
COMMENT ON COLUMN balance_audit_log.balance_before IS 'User house balance before operation (18 decimal places)';
COMMENT ON COLUMN balance_audit_log.balance_after IS 'User house balance after operation (18 decimal places)';
COMMENT ON COLUMN balance_audit_log.tx_hash IS 'Blockchain transaction hash (if applicable)';
COMMENT ON COLUMN balance_audit_log.created_at IS 'Timestamp when operation occurred';

-- Enable Row Level Security
ALTER TABLE balance_audit_log ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow public read" ON balance_audit_log;
DROP POLICY IF EXISTS "Allow public insert" ON balance_audit_log;

-- Create RLS policies for public read and insert
CREATE POLICY "Allow public read" 
ON balance_audit_log 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert" 
ON balance_audit_log 
FOR INSERT 
WITH CHECK (true);
