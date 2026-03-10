-- Migration: Update stored procedures for CreditCoin schema
-- Task: 11.5 Update database to store transaction hashes
-- Requirements: 13.6
-- 
-- This migration updates the stored procedures to use the correct column names
-- from the CreditCoin schema: 'operation' instead of 'operation_type' and 
-- 'tx_hash' instead of 'transaction_hash'

-- 1. Update deduct_balance_for_bet to use 'operation' column
CREATE OR REPLACE FUNCTION deduct_balance_for_bet(
    p_user_address TEXT,
    p_bet_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC'
)
RETURNS JSON AS $
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_bet_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Bet amount must be greater than zero', 'new_balance', NULL);
    END IF;

    -- Lock the row for update with currency filter
    SELECT balance INTO v_current_balance
    FROM user_balances
    WHERE user_address = p_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'User balance not found for this currency', 'new_balance', NULL);
    END IF;
    
    IF v_current_balance < p_bet_amount THEN
        RETURN json_build_object('success', false, 'error', 'Insufficient balance', 'new_balance', v_current_balance);
    END IF;
    
    v_new_balance := v_current_balance - p_bet_amount;
    
    UPDATE user_balances
    SET balance = v_new_balance, updated_at = NOW()
    WHERE user_address = p_user_address AND currency = p_currency;
    
    -- Use 'operation' column instead of 'operation_type'
    INSERT INTO balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after)
    VALUES (p_user_address, p_currency, 'bet_debit', p_bet_amount, v_current_balance, v_new_balance);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$ LANGUAGE plpgsql;

-- 2. Update credit_balance_for_payout to use 'operation' column
CREATE OR REPLACE FUNCTION credit_balance_for_payout(
    p_user_address TEXT,
    p_payout_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC',
    p_bet_id TEXT DEFAULT NULL
)
RETURNS JSON AS $
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    IF p_payout_amount <= 0 THEN
        RETURN json_build_object('success', false, 'error', 'Payout amount must be greater than zero', 'new_balance', NULL);
    END IF;

    SELECT balance INTO v_current_balance
    FROM user_balances
    WHERE user_address = p_user_address AND currency = p_currency
    FOR UPDATE;
    
    IF v_current_balance IS NULL THEN
        INSERT INTO user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (p_user_address, p_currency, p_payout_amount, NOW(), NOW());
        v_current_balance := 0;
        v_new_balance := p_payout_amount;
    ELSE
        v_new_balance := v_current_balance + p_payout_amount;
        UPDATE user_balances
        SET balance = v_new_balance, updated_at = NOW()
        WHERE user_address = p_user_address AND currency = p_currency;
    END IF;
    
    -- Use 'operation' column instead of 'operation_type'
    -- Store bet_id in tx_hash field for reference
    INSERT INTO balance_audit_log (user_address, currency, operation, amount, balance_before, balance_after, tx_hash)
    VALUES (p_user_address, p_currency, 'bet_credit', p_payout_amount, v_current_balance, v_new_balance, p_bet_id);
    
    RETURN json_build_object('success', true, 'error', NULL, 'new_balance', v_new_balance);
END;
$ LANGUAGE plpgsql;

-- Add comments to the functions
COMMENT ON FUNCTION deduct_balance_for_bet IS 
'Deducts bet amount from user house balance. Creates audit log entry with operation=bet_debit.';

COMMENT ON FUNCTION credit_balance_for_payout IS 
'Credits payout amount to user house balance for winning bets. Creates audit log entry with operation=bet_credit and stores bet_id in tx_hash field.';

