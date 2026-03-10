/**
 * CreditCoin Database Module
 * 
 * This module provides Supabase client and helper functions for managing
 * user house balances and audit logs on CreditCoin testnet.
 * 
 * Requirements: 4.1, 4.2, 4.3
 */

import { createClient } from '@supabase/supabase-js';

// Validate required environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}

if (!supabaseAnonKey) {
  throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create and export Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// Type definitions for database tables
export interface UserBalance {
  user_address: string;
  currency: string;
  balance: string; // Decimal string (18 decimals)
  updated_at: string;
  created_at: string;
}

export interface BalanceAuditLog {
  id: number;
  user_address: string;
  currency: string;
  operation: string;
  amount: string; // Decimal string (18 decimals)
  balance_before: string; // Decimal string (18 decimals)
  balance_after: string; // Decimal string (18 decimals)
  tx_hash?: string;
  created_at: string;
}

/**
 * Get user's house balance in CTC
 * 
 * @param userAddress - User's EVM wallet address
 * @returns User's house balance as decimal string, or '0' if user doesn't exist
 * 
 * Requirements: 4.1, 14.3, 14.6
 */
export async function getHouseBalance(userAddress: string): Promise<string> {
  const timestamp = new Date().toISOString();
  
  try {
    const { data, error } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', userAddress.toLowerCase())
      .eq('currency', 'CTC')
      .single();

    if (error) {
      // User doesn't exist yet, return 0
      if (error.code === 'PGRST116') {
        return '0';
      }
      
      // Log database error with structured format
      console.error(`[${timestamp}] [Database] Error fetching house balance:`, {
        operation: 'getHouseBalance',
        userAddress: userAddress.toLowerCase(),
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
      
      throw error;
    }

    return data?.balance || '0';
  } catch (error) {
    // Log unexpected errors with structured format
    console.error(`[${timestamp}] [Database] Unexpected error in getHouseBalance:`, {
      operation: 'getHouseBalance',
      userAddress: userAddress.toLowerCase(),
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    throw new Error('Failed to fetch house balance');
  }
}

/**
 * Update user's house balance with audit logging
 * 
 * @param userAddress - User's EVM wallet address
 * @param amount - Amount to add (positive) or subtract (negative) as decimal string
 * @param operation - Operation type (deposit, withdraw, bet_debit, bet_credit, refund)
 * @param txHash - Optional blockchain transaction hash
 * @returns New balance as decimal string
 * 
 * Requirements: 4.1, 4.3, 14.3, 14.6
 */
export async function updateHouseBalance(
  userAddress: string,
  amount: string,
  operation: string,
  txHash?: string
): Promise<string> {
  const normalizedAddress = userAddress.toLowerCase();
  const timestamp = new Date().toISOString();
  
  try {
    // Get current balance
    const currentBalance = await getHouseBalance(normalizedAddress);
    
    // Calculate new balance
    const currentBalanceNum = parseFloat(currentBalance);
    const amountNum = parseFloat(amount);
    const newBalance = (currentBalanceNum + amountNum).toFixed(18);
    
    // Ensure balance doesn't go negative
    if (parseFloat(newBalance) < 0) {
      console.error(`[${timestamp}] [Database] Insufficient balance:`, {
        operation: 'updateHouseBalance',
        userAddress: normalizedAddress,
        currentBalance,
        amount,
        operationType: operation,
        txHash,
      });
      throw new Error('Insufficient balance');
    }

    // Upsert user balance
    const { error: upsertError } = await supabase
      .from('user_balances')
      .upsert({
        user_address: normalizedAddress,
        currency: 'CTC',
        balance: newBalance,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_address,currency',
      });

    if (upsertError) {
      // Log database error with structured format
      console.error(`[${timestamp}] [Database] Error upserting user balance:`, {
        operation: 'updateHouseBalance',
        userAddress: normalizedAddress,
        amount,
        operationType: operation,
        txHash,
        errorCode: upsertError.code,
        errorMessage: upsertError.message,
        errorDetails: upsertError.details,
        errorHint: upsertError.hint,
      });
      
      throw upsertError;
    }

    // Create audit log entry
    await createAuditLog(
      normalizedAddress,
      operation,
      amount,
      currentBalance,
      newBalance,
      txHash
    );

    return newBalance;
  } catch (error) {
    // Log unexpected errors with structured format
    console.error(`[${timestamp}] [Database] Unexpected error in updateHouseBalance:`, {
      operation: 'updateHouseBalance',
      userAddress: normalizedAddress,
      amount,
      operationType: operation,
      txHash,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    throw error;
  }
}

/**
 * Create audit log entry for balance change
 * 
 * @param userAddress - User's EVM wallet address
 * @param operation - Operation type (deposit, withdraw, bet_debit, bet_credit, refund)
 * @param amount - Amount involved in the operation as decimal string
 * @param balanceBefore - Balance before operation as decimal string
 * @param balanceAfter - Balance after operation as decimal string
 * @param txHash - Optional blockchain transaction hash
 * 
 * Requirements: 4.3, 14.3, 14.6
 */
export async function createAuditLog(
  userAddress: string,
  operation: string,
  amount: string,
  balanceBefore: string,
  balanceAfter: string,
  txHash?: string
): Promise<void> {
  const timestamp = new Date().toISOString();
  
  try {
    const { error } = await supabase
      .from('balance_audit_log')
      .insert({
        user_address: userAddress.toLowerCase(),
        currency: 'CTC',
        operation,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        tx_hash: txHash || null,
        created_at: new Date().toISOString(),
      });

    if (error) {
      // Log database error with structured format
      console.error(`[${timestamp}] [Database] Error creating audit log:`, {
        operation: 'createAuditLog',
        userAddress: userAddress.toLowerCase(),
        operationType: operation,
        amount,
        balanceBefore,
        balanceAfter,
        txHash,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
      
      throw error;
    }
  } catch (error) {
    // Log unexpected errors with structured format
    console.error(`[${timestamp}] [Database] Unexpected error in createAuditLog:`, {
      operation: 'createAuditLog',
      userAddress: userAddress.toLowerCase(),
      operationType: operation,
      amount,
      balanceBefore,
      balanceAfter,
      txHash,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    
    throw new Error('Failed to create audit log');
  }
}
