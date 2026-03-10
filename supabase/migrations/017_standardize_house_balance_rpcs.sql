-- Consolidated fix for House Balance RPCs
-- Ensures no function overloads exist by dropping first

-- 1. DROP old versions to avoid ambiguity
DROP FUNCTION IF EXISTS public.update_balance_for_deposit(TEXT, NUMERIC, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.update_balance_for_withdrawal(TEXT, NUMERIC, TEXT);

-- 2. CREATE Standardized Deposit RPC
CREATE OR REPLACE FUNCTION public.update_balance_for_deposit(
    p_user_address TEXT,
    p_deposit_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC',
    p_transaction_hash TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_address TEXT;
    v_new_balance NUMERIC;
    v_current_balance NUMERIC;
BEGIN
    -- Normalize address
    v_user_address := LOWER(p_user_address);
    
    -- 1. Try to find existing balance (lock row)
    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE user_address = v_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        -- Create new record
        INSERT INTO public.user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (v_user_address, p_currency, p_deposit_amount, NOW(), NOW())
        RETURNING balance INTO v_new_balance;
    ELSE
        -- Update existing
        UPDATE public.user_balances
        SET balance = balance + p_deposit_amount,
            updated_at = NOW()
        WHERE user_address = v_user_address AND currency = p_currency
        RETURNING balance INTO v_new_balance;
    END IF;
    
    -- 2. Log to audit log
    INSERT INTO public.balance_audit_log (
        user_address,
        currency,
        amount,
        type,
        transaction_hash,
        created_at
    ) VALUES (
        v_user_address,
        p_currency,
        p_deposit_amount,
        'deposit',
        p_transaction_hash,
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance,
        'user', v_user_address
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;

-- 3. CREATE Standardized Withdrawal RPC
CREATE OR REPLACE FUNCTION public.update_balance_for_withdrawal(
    p_user_address TEXT,
    p_withdraw_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_address TEXT;
    v_new_balance NUMERIC;
    v_current_balance NUMERIC;
BEGIN
    -- Normalize address
    v_user_address := LOWER(p_user_address);
    
    -- 1. Verify balance
    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE user_address = v_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL OR v_current_balance < p_withdraw_amount THEN
        RETURN jsonb_build_object('success', false, 'error', 'Insufficient house balance');
    END IF;
    
    -- 2. Deduct
    UPDATE public.user_balances
    SET balance = balance - p_withdraw_amount,
        updated_at = NOW()
    WHERE user_address = v_user_address AND currency = p_currency
    RETURNING balance INTO v_new_balance;
    
    -- 3. Log
    INSERT INTO public.balance_audit_log (
        user_address,
        currency,
        amount,
        type,
        created_at
    ) VALUES (
        v_user_address,
        p_currency,
        p_withdraw_amount,
        'withdrawal',
        NOW()
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'new_balance', v_new_balance
    );
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$;
