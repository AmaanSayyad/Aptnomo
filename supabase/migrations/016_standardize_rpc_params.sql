-- Migration: Standardize RPC parameters and fix any missing procedures
-- Task: 15.2 Ensure update_balance_for_deposit/withdrawal use consistent parameter ordering
-- Requirements: 2.4, 2.5, 6.2

-- Re-defining update_balance_for_deposit with explicit parameter names for safety
CREATE OR REPLACE FUNCTION public.update_balance_for_deposit(
    p_user_address TEXT,
    p_deposit_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC',
    p_transaction_hash TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_user_address TEXT;
BEGIN
    v_user_address := LOWER(p_user_address);

    IF p_deposit_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Deposit amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE user_address = v_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO public.user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (v_user_address, p_currency, p_deposit_amount, NOW(), NOW());
        v_current_balance := 0;
        v_new_balance := p_deposit_amount;
    ELSE
        v_new_balance := v_current_balance + p_deposit_amount;
        UPDATE public.user_balances
        SET balance = v_new_balance, updated_at = NOW()
        WHERE user_address = v_user_address AND currency = p_currency;
    END IF;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after, tx_hash)
    VALUES (v_user_address, p_currency, 'deposit', p_deposit_amount, v_current_balance, v_new_balance, p_transaction_hash);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-defining update_balance_for_withdrawal with explicit parameter names for safety
CREATE OR REPLACE FUNCTION public.update_balance_for_withdrawal(
    p_user_address TEXT,
    p_withdrawal_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC',
    p_transaction_hash TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
    v_user_address TEXT;
BEGIN
    v_user_address := LOWER(p_user_address);

    IF p_withdrawal_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Withdrawal amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM public.user_balances
    WHERE user_address = v_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User balance not found', 'new_balance', NULL);
    END IF;
    
    IF v_current_balance < p_withdrawal_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'new_balance', v_current_balance);
    END IF;
    
    v_new_balance := v_current_balance - p_withdrawal_amount;
    UPDATE public.user_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE user_address = v_user_address AND currency = p_currency;
    
    INSERT INTO public.balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after, tx_hash)
    VALUES (v_user_address, p_currency, 'withdraw', p_withdrawal_amount, v_current_balance, v_new_balance, p_transaction_hash);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
