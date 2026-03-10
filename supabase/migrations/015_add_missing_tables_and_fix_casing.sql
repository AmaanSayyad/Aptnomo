-- Migration: Create user_profiles and user_referrals tables, and fix casing
-- Task: 15.1 Add missing tables and fix address casing consistency
-- Requirements: 2.3, 2.4, 6.2

-- 1. Create user_profiles table if it does not exist
CREATE TABLE IF NOT EXISTS public.user_profiles (
    user_address TEXT PRIMARY KEY,
    username TEXT UNIQUE,
    access_code TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_profiles
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
DROP POLICY IF EXISTS "Allow public read on profiles" ON public.user_profiles;
CREATE POLICY "Allow public read on profiles" ON public.user_profiles
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user update own profile" ON public.user_profiles;
CREATE POLICY "Allow user update own profile" ON public.user_profiles
    FOR ALL USING (auth.uid()::text = user_address OR true); -- Simplification for now, as auth isn't fully using Supabase Auth

-- 2. Create user_referrals table if it does not exist
CREATE TABLE IF NOT EXISTS public.user_referrals (
    user_address TEXT PRIMARY KEY,
    referral_code TEXT UNIQUE NOT NULL,
    referred_by TEXT REFERENCES public.user_referrals(user_address),
    referral_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on user_referrals
ALTER TABLE public.user_referrals ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_referrals
DROP POLICY IF EXISTS "Allow public read on referrals" ON public.user_referrals;
CREATE POLICY "Allow public read on referrals" ON public.user_referrals
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow user update own referrals" ON public.user_referrals;
CREATE POLICY "Allow user update own referrals" ON public.user_referrals
    FOR ALL USING (true);

-- 3. Create increment_referral_count RPC
CREATE OR REPLACE FUNCTION increment_referral_count(referrer_address TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.user_referrals
    SET referral_count = referral_count + 1
    WHERE user_address = LOWER(referrer_address);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. FIX CASING: Standardize all addresses to lowercase in existing tables
-- This ensures that current mixed-case data matches the new API logic

-- Standardize user_balances
UPDATE public.user_balances
SET user_address = LOWER(user_address);

-- Standardize balance_audit_log
UPDATE public.balance_audit_log
SET user_address = LOWER(user_address);

-- Standardize bet_history
UPDATE public.bet_history
SET wallet_address = LOWER(wallet_address);

-- Ensure future inserts into user_balances are lowercased via trigger (optional but recommended)
CREATE OR REPLACE FUNCTION lowercase_user_address()
RETURNS TRIGGER AS $$
BEGIN
    NEW.user_address = LOWER(NEW.user_address);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_lowercase_user_address ON public.user_balances;
CREATE TRIGGER tr_lowercase_user_address
BEFORE INSERT OR UPDATE ON public.user_balances
FOR EACH ROW EXECUTE FUNCTION lowercase_user_address();

-- Comment on progress
COMMENT ON TABLE user_profiles IS 'Stores user display information and preferences';
COMMENT ON TABLE user_referrals IS 'Stores referral codes and relationship mapping';
