-- Migration: Update bet_history table for CreditCoin (CTC) support
-- Task: 2.2 Create database migration script for bet_history table
-- Requirements: 4.2, 4.4, 4.5, 4.6

-- Update asset column default from 'BNB' to 'CTC'
ALTER TABLE bet_history 
ALTER COLUMN asset SET DEFAULT 'CTC';

-- Update mode column default from 'binomo' to 'creditnomo'
ALTER TABLE bet_history 
ALTER COLUMN mode SET DEFAULT 'creditnomo';

-- Update network column default from 'BNB' to 'CTC'
ALTER TABLE bet_history 
ALTER COLUMN network SET DEFAULT 'CTC';

-- Update amount column precision from NUMERIC(20,8) to NUMERIC(20,18)
ALTER TABLE bet_history 
ADD COLUMN amount_new NUMERIC(20, 18);

UPDATE bet_history 
SET amount_new = amount;

ALTER TABLE bet_history 
DROP COLUMN amount;

ALTER TABLE bet_history 
RENAME COLUMN amount_new TO amount;

ALTER TABLE bet_history 
ALTER COLUMN amount SET NOT NULL;

-- Update strike_price column precision from NUMERIC(20,8) to NUMERIC(20,18)
ALTER TABLE bet_history 
ADD COLUMN strike_price_new NUMERIC(20, 18);

UPDATE bet_history 
SET strike_price_new = strike_price;

ALTER TABLE bet_history 
DROP COLUMN strike_price;

ALTER TABLE bet_history 
RENAME COLUMN strike_price_new TO strike_price;

ALTER TABLE bet_history 
ALTER COLUMN strike_price SET NOT NULL,
ALTER COLUMN strike_price SET DEFAULT 0;

-- Update end_price column precision from NUMERIC(20,8) to NUMERIC(20,18)
ALTER TABLE bet_history 
ADD COLUMN end_price_new NUMERIC(20, 18);

UPDATE bet_history 
SET end_price_new = end_price;

ALTER TABLE bet_history 
DROP COLUMN end_price;

ALTER TABLE bet_history 
RENAME COLUMN end_price_new TO end_price;

ALTER TABLE bet_history 
ALTER COLUMN end_price SET DEFAULT 0;

-- Update payout column precision from NUMERIC(20,8) to NUMERIC(20,18)
ALTER TABLE bet_history 
ADD COLUMN payout_new NUMERIC(20, 18);

UPDATE bet_history 
SET payout_new = payout;

ALTER TABLE bet_history 
DROP COLUMN payout;

ALTER TABLE bet_history 
RENAME COLUMN payout_new TO payout;

ALTER TABLE bet_history 
ALTER COLUMN payout SET DEFAULT 0;

-- Ensure CHECK constraint exists for direction
-- Drop existing constraint if it exists and recreate
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'bet_history_direction_check'
  ) THEN
    ALTER TABLE bet_history DROP CONSTRAINT bet_history_direction_check;
  END IF;
END $$;

ALTER TABLE bet_history 
ADD CONSTRAINT bet_history_direction_check CHECK (direction IN ('UP', 'DOWN'));

-- Create index on created_at if not exists (for time-based queries)
CREATE INDEX IF NOT EXISTS idx_bet_history_created ON bet_history(created_at DESC);

-- Update table comment
COMMENT ON TABLE bet_history IS 'Stores all bet results for persistent history and leaderboard on CreditCoin testnet';

-- Update column comments
COMMENT ON COLUMN bet_history.id IS 'Unique bet identifier (UUID)';
COMMENT ON COLUMN bet_history.wallet_address IS 'User EVM wallet address (0x...)';
COMMENT ON COLUMN bet_history.asset IS 'Asset type (default: CTC for CreditCoin)';
COMMENT ON COLUMN bet_history.direction IS 'Bet direction: UP or DOWN';
COMMENT ON COLUMN bet_history.amount IS 'Bet amount in CTC tokens (18 decimal places)';
COMMENT ON COLUMN bet_history.multiplier IS 'Payout multiplier (e.g., 1.9x)';
COMMENT ON COLUMN bet_history.strike_price IS 'Asset price when bet was placed (18 decimal places)';
COMMENT ON COLUMN bet_history.end_price IS 'Asset price when bet was resolved (18 decimal places)';
COMMENT ON COLUMN bet_history.payout IS 'Payout amount in CTC tokens if won (18 decimal places)';
COMMENT ON COLUMN bet_history.won IS 'Whether the bet was won (true) or lost (false)';
COMMENT ON COLUMN bet_history.mode IS 'Game mode (default: creditnomo)';
COMMENT ON COLUMN bet_history.network IS 'Blockchain network (default: CTC for CreditCoin)';
COMMENT ON COLUMN bet_history.resolved_at IS 'Timestamp when bet was resolved';
COMMENT ON COLUMN bet_history.created_at IS 'Timestamp when bet was created';

-- Ensure Row Level Security is enabled
ALTER TABLE bet_history ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist and recreate
DROP POLICY IF EXISTS "Allow public read" ON bet_history;
DROP POLICY IF EXISTS "Allow public insert" ON bet_history;

-- Create RLS policies for public read and insert
CREATE POLICY "Allow public read" 
ON bet_history 
FOR SELECT 
USING (true);

CREATE POLICY "Allow public insert" 
ON bet_history 
FOR INSERT 
WITH CHECK (true);
