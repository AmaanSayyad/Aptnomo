/**
 * Balance Synchronization Module
 *
 * Checks and maintains synchronization between the Supabase user_balances table
 * and the CreditCoin treasury (EOA). Stub for on-chain balance query.
 */

import { supabase } from '../supabase/client';

/**
 * Result of a synchronization check
 */
export interface SyncCheckResult {
  /** Whether the balances are synchronized */
  synchronized: boolean;
  /** Total balance in Supabase user_balances table */
  supabaseTotal: number;
  /** Total balance in the treasury on-chain */
  escrowVaultBalance: number;
  /** Discrepancy amount (escrowVaultBalance - supabaseTotal) */
  discrepancy: number;
  /** Timestamp of the check */
  timestamp: Date;
  /** Error message if check failed */
  error?: string;
}

/**
 * Check synchronization between Supabase and CreditCoin treasury.
 * @param contractAddress - CreditCoin (EVM) treasury address
 */
export async function checkBalanceSynchronization(
  contractAddress: string
): Promise<SyncCheckResult> {
  const timestamp = new Date();
  
  try {
    // Query total of all user_balances from Supabase
    const { data: balances, error: queryError } = await supabase
      .from('user_balances')
      .select('balance');

    if (queryError) {
      console.error('Error querying user balances:', queryError);
      return {
        synchronized: false,
        supabaseTotal: 0,
        escrowVaultBalance: 0,
        discrepancy: 0,
        timestamp,
        error: `Failed to query Supabase: ${queryError.message}`
      };
    }

    // Calculate total from Supabase
    const supabaseTotal = balances?.reduce((sum, row) => sum + parseFloat(row.balance.toString()), 0) || 0;

    // TODO: Query CreditCoin treasury balance via RPC for full sync check
    return {
      synchronized: true,
      supabaseTotal,
      escrowVaultBalance: supabaseTotal,
      discrepancy: 0,
      timestamp,
    };
  } catch (error) {
    console.error('Unexpected error in checkBalanceSynchronization:', error);
    return {
      synchronized: false,
      supabaseTotal: 0,
      escrowVaultBalance: 0,
      discrepancy: 0,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Result of a user balance reconciliation
 */
export interface ReconcileResult {
  /** Whether reconciliation was successful */
  success: boolean;
  /** User's address */
  userAddress: string;
  /** Balance before reconciliation */
  oldBalance: number;
  /** Balance after reconciliation (from blockchain) */
  newBalance: number;
  /** Discrepancy that was corrected */
  discrepancy: number;
  /** Timestamp of reconciliation */
  timestamp: Date;
  /** Error message if reconciliation failed */
  error?: string;
}

/**
 * Reconcile a single user's balance with the blockchain
 * 
 * TODO: Update this function to work with CreditCoin blockchain after migration.
 * Currently returns a stub response.
 * 
 * @param userAddress - The user's CreditCoin wallet address
 * @param dryRun - If true, only check discrepancy without updating
 * @returns ReconcileResult containing reconciliation details
 */
export async function reconcileUserBalance(
  userAddress: string,
  dryRun: boolean = false
): Promise<ReconcileResult> {
  const timestamp = new Date();
  
  try {
    // Query user's current balance from Supabase
    const { data: userData, error: queryError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', userAddress)
      .single();

    if (queryError) {
      return {
        success: false,
        userAddress,
        oldBalance: 0,
        newBalance: 0,
        discrepancy: 0,
        timestamp,
        error: `Failed to query user balance: ${queryError.message}`
      };
    }

    const oldBalance = parseFloat(userData.balance.toString());

    // TODO: Query user balance from CreditCoin chain if needed for reconciliation
    return {
      success: true,
      userAddress,
      oldBalance,
      newBalance: oldBalance,
      discrepancy: 0,
      timestamp,
    };
  } catch (error) {
    console.error('Unexpected error in reconcileUserBalance:', error);
    return {
      success: false,
      userAddress,
      oldBalance: 0,
      newBalance: 0,
      discrepancy: 0,
      timestamp,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Reconcile all users' balances with the blockchain (CreditCoin treasury).
 * 
 * @param dryRun - If true, only check discrepancies without updating
 * @param discrepancyThreshold - Only reconcile if discrepancy exceeds this amount
 * @returns Array of ReconcileResult for each user
 */
export async function reconcileAllUsers(
  dryRun: boolean = false,
  discrepancyThreshold: number = 0.00000001
): Promise<ReconcileResult[]> {
  try {
    // Query all users from Supabase
    const { data: users, error: queryError } = await supabase
      .from('user_balances')
      .select('user_address');

    if (queryError) {
      console.error('Error querying users:', queryError);
      return [];
    }

    // Reconcile each user
    const results: ReconcileResult[] = [];
    for (const user of users || []) {
      const result = await reconcileUserBalance(user.user_address, dryRun);
      
      // Only include users with discrepancies above threshold
      if (Math.abs(result.discrepancy) >= discrepancyThreshold) {
        results.push(result);
      }
    }

    return results;
  } catch (error) {
    console.error('Unexpected error in reconcileAllUsers:', error);
    return [];
  }
}
