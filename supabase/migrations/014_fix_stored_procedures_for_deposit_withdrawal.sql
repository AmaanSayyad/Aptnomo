-- Migration: Fix update_balance_for_deposit and update_balance_for_withdrawal for CreditCoin schema
-- Task: 11.6 Fix deposit and withdrawal stored procedures
-- Requirements: 2.4, 2.5, 6.2

-- 1. Update update_balance_for_deposit to use CreditCoin schema
CREATE OR REPLACE FUNCTION update_balance_for_deposit(
    p_user_address TEXT,
    p_deposit_amount NUMERIC,
    p_transaction_hash TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'CTC'
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Validate input parameters
    IF p_deposit_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Deposit amount must be greater than zero',
            'new_balance', NULL
        );
    END IF;

    -- Lock the row for update with currency filter
    SELECT balance INTO v_current_balance
    FROM user_balances
    WHERE user_address = p_user_address AND currency = p_currency
    FOR UPDATE;
    
    -- Check if user exists, if not create a new record
    IF v_current_balance IS NULL THEN
        -- Insert new user with deposit amount for this currency
        INSERT INTO user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (p_user_address, p_currency, p_deposit_amount, NOW(), NOW());
        
        v_current_balance := 0;
        v_new_balance := p_deposit_amount;
    ELSE
        -- Calculate new balance
        v_new_balance := v_current_balance + p_deposit_amount;
        
        -- Update balance
        UPDATE user_balances
        SET balance = v_new_balance,
            updated_at = NOW()
        WHERE user_address = p_user_address AND currency = p_currency;
    END IF;
    
    -- Insert audit log entry with correct column names (operation, tx_hash)
    INSERT INTO balance_audit_log (
        user_address,
        currency,
        operation,
        amount,
        balance_before,
        balance_after,
        tx_hash
    ) VALUES (
        p_user_address,
        p_currency,
        'deposit',
        p_deposit_amount,
        v_current_balance,
        v_new_balance,
        p_transaction_hash
    );
    
    -- Return success result
    RETURN json_build_object(
        'success', true,
        'error', NULL,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql;

-- 2. Update update_balance_for_withdrawal to use CreditCoin schema
CREATE OR REPLACE FUNCTION update_balance_for_withdrawal(
    p_user_address TEXT,
    p_withdrawal_amount NUMERIC,
    p_transaction_hash TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'CTC'
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Validate input parameters
    IF p_withdrawal_amount <= 0 THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Withdrawal amount must be greater than zero',
            'new_balance', NULL
        );
    END IF;

    -- Lock the row for update with currency filter
    SELECT balance INTO v_current_balance
    FROM user_balances
    WHERE user_address = p_user_address AND currency = p_currency
    FOR UPDATE;
    
    -- Check if user exists
    IF v_current_balance IS NULL THEN
        RETURN json_build_object(
            'success', false,
            'error', 'User balance not found for this currency',
            'new_balance', NULL
        );
    END IF;
    
    -- Check sufficient balance
    IF v_current_balance < p_withdrawal_amount THEN
        RETURN json_build_object(
            'success', false,
            'error', 'Insufficient balance',
            'new_balance', v_current_balance
        );
    END IF;
    
    -- Calculate new balance
    v_new_balance := v_current_balance - p_withdrawal_amount;
    
    -- Update balance
    UPDATE user_balances
    SET balance = v_new_balance,
        updated_at = NOW()
    WHERE user_address = p_user_address AND currency = p_currency;
    
    -- Insert audit log entry with correct column names (operation, tx_hash)
    INSERT INTO balance_audit_log (
        user_address,
        currency,
        operation,
        amount,
        balance_before,
        balance_after,
        tx_hash
    ) VALUES (
        p_user_address,
        p_currency,
        'withdraw',
        p_withdrawal_amount,
        v_current_balance,
        v_new_balance,
        p_transaction_hash
    );
    
    -- Return success result
    RETURN json_build_object(
        'success', true,
        'error', NULL,
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql;

-- Add comments to the functions
COMMENT ON FUNCTION update_balance_for_deposit IS 
'Updates user house balance for a deposit. Creates audit log entry with operation=deposit.';

COMMENT ON FUNCTION update_balance_for_withdrawal IS 
'Updates user house balance for a withdrawal. Creates audit log entry with operation=withdraw.';
