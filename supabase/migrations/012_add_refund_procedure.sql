-- Migration: Add stored procedure for bet refunds
-- Task: 9.2 Update bet settlement logic to use Pyth oracle
-- Requirements: 9.5, 9.6
-- 
-- This procedure credits a refund amount back to the user's house balance
-- and creates an audit log entry with operation='refund'

-- Create credit_balance_for_refund stored procedure
CREATE OR REPLACE FUNCTION credit_balance_for_refund(
    p_user_address TEXT,
    p_refund_amount NUMERIC,
    p_currency TEXT DEFAULT 'CTC',
    p_bet_id TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
    v_current_balance NUMERIC;
    v_new_balance NUMERIC;
BEGIN
    -- Validate refund amount
    IF p_refund_amount <= 0 THEN
        RETURN json_build_object(
            'success', false, 
            'error', 'Refund amount must be greater than zero', 
            'new_balance', NULL
        );
    END IF;

    -- Lock the row for update with currency filter
    SELECT balance INTO v_current_balance
    FROM user_balances
    WHERE user_address = p_user_address AND currency = p_currency
    FOR UPDATE;
    
    -- If user doesn't exist, create new balance entry
    IF v_current_balance IS NULL THEN
        INSERT INTO user_balances (user_address, currency, balance, updated_at, created_at)
        VALUES (p_user_address, p_currency, p_refund_amount, NOW(), NOW());
        v_current_balance := 0;
        v_new_balance := p_refund_amount;
    ELSE
        -- Update existing balance
        v_new_balance := v_current_balance + p_refund_amount;
        UPDATE user_balances
        SET balance = v_new_balance, updated_at = NOW()
        WHERE user_address = p_user_address AND currency = p_currency;
    END IF;
    
    -- Create audit log entry with operation='refund'
    -- Requirements: 9.6
    INSERT INTO balance_audit_log (
        user_address, 
        currency, 
        operation, 
        amount, 
        balance_before, 
        balance_after,
        tx_hash,
        created_at
    )
    VALUES (
        p_user_address, 
        p_currency, 
        'refund', 
        p_refund_amount, 
        v_current_balance, 
        v_new_balance,
        p_bet_id, -- Store bet_id in tx_hash field for reference
        NOW()
    );
    
    RETURN json_build_object(
        'success', true, 
        'error', NULL, 
        'new_balance', v_new_balance
    );
END;
$$ LANGUAGE plpgsql;

-- Add comment to the function
COMMENT ON FUNCTION credit_balance_for_refund IS 
'Credits a refund amount to user house balance when oracle price fetch fails. Creates audit log entry with operation=refund.';
