/**
 * Treasury Backend Client Module
 * 
 * This module provides server-side treasury wallet operations for processing
 * withdrawals from the CreditCoin treasury wallet. It uses the treasury private
 * key to sign transactions and should NEVER be used in client-side code.
 * 
 * Security:
 * - Private key is read from CREDITCOIN_TREASURY_PRIVATE_KEY environment variable
 * - All operations are audit logged
 * - Private key is never exposed in logs or responses
 * 
 * Features:
 * - Withdrawal processing with comprehensive validation
 * - Treasury balance checking
 * - Withdrawal validation against treasury balance
 * - Error handling and structured logging
 */

import { ethers } from 'ethers';
import { CreditCoinClient } from './client';
import { creditCoinTestnet } from './config';

/**
 * Result of a withdrawal operation
 */
export interface WithdrawalResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

/**
 * Treasury Client for server-side withdrawal operations
 * 
 * SECURITY WARNING: This class uses the treasury private key and should
 * ONLY be instantiated in server-side code (API routes, server actions).
 * Never import or use this class in client-side components.
 */
export class TreasuryClient {
  private client: CreditCoinClient;
  private treasuryAddress: string;

  /**
   * Create a new TreasuryClient instance
   * @param privateKey - Treasury wallet private key (from environment variable)
   * @throws Error if private key is missing or invalid
   */
  constructor(privateKey?: string) {
    // Get private key from environment or parameter
    const key = privateKey || process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;

    if (!key) {
      const error = 'Treasury private key not found. Set CREDITCOIN_TREASURY_PRIVATE_KEY environment variable.';
      console.error('[TreasuryClient] ERROR:', error);
      throw new Error(error);
    }

    // Validate private key format (should be 64 hex chars, optionally prefixed with 0x)
    const cleanKey = key.startsWith('0x') ? key.slice(2) : key;
    if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
      const error = 'Invalid treasury private key format. Expected 64 hexadecimal characters.';
      console.error('[TreasuryClient] ERROR:', error);
      throw new Error(error);
    }

    // Initialize client with private key
    this.client = new CreditCoinClient(undefined, key);
    this.treasuryAddress = creditCoinTestnet.treasuryAddress;

    console.log('[TreasuryClient] Initialized with treasury address:', this.treasuryAddress);
  }

  /**
   * Process a withdrawal from treasury to user wallet
   * 
   * This method:
   * 1. Validates the withdrawal amount and user address
   * 2. Checks treasury has sufficient balance
   * 3. Sends CTC from treasury to user wallet
   * 4. Waits for transaction confirmation
   * 5. Returns result with transaction hash or error
   * 
   * @param userAddress - Recipient wallet address
   * @param amount - Amount in wei (bigint)
   * @returns WithdrawalResult with success status, txHash, or error
   */
  async processWithdrawal(userAddress: string, amount: bigint): Promise<WithdrawalResult> {
    const timestamp = new Date().toISOString();

    try {
      console.log(`[${timestamp}] [TreasuryClient] Processing withdrawal:`, {
        userAddress,
        amount: this.client.formatCTC(amount),
      });

      // Validate user address
      if (!ethers.isAddress(userAddress)) {
        const error = `Invalid user address: ${userAddress}`;
        console.error(`[${timestamp}] [TreasuryClient] Validation error:`, {
          error,
          userAddress,
        });
        return { success: false, error };
      }

      // Validate amount
      if (amount <= BigInt(0)) {
        const error = 'Withdrawal amount must be greater than 0';
        console.error(`[${timestamp}] [TreasuryClient] Validation error:`, {
          error,
          amount: this.client.formatCTC(amount),
        });
        return { success: false, error };
      }

      // Check treasury balance
      const treasuryBalance = await this.getTreasuryBalance();
      if (!this.validateWithdrawal(amount, treasuryBalance)) {
        const error = `Insufficient treasury balance. Have: ${this.client.formatCTC(treasuryBalance)} CTC, Need: ${this.client.formatCTC(amount)} CTC`;
        console.error(`[${timestamp}] [TreasuryClient] Insufficient balance:`, {
          requestedAmount: this.client.formatCTC(amount),
          treasuryBalance: this.client.formatCTC(treasuryBalance),
          shortfall: this.client.formatCTC(amount - treasuryBalance),
        });
        return { success: false, error };
      }

      // Send transaction
      let txHash: string;
      try {
        txHash = await this.client.sendTransaction(userAddress, amount);
        console.log(`[${timestamp}] [TreasuryClient] Transaction sent:`, {
          txHash,
          userAddress,
          amount: this.client.formatCTC(amount),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] [TreasuryClient] Transaction send failed:`, {
          userAddress,
          amount: this.client.formatCTC(amount),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
        });
        return {
          success: false,
          error: `Withdrawal failed: ${errorMessage}`,
        };
      }

      // Wait for confirmation
      let receipt;
      try {
        receipt = await this.client.waitForTransaction(txHash);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] [TreasuryClient] Transaction confirmation failed:`, {
          txHash,
          userAddress,
          amount: this.client.formatCTC(amount),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
        });
        return {
          success: false,
          txHash,
          error: `Transaction confirmation failed: ${errorMessage}`,
        };
      }

      if (receipt.status === 'failed') {
        const error = 'Transaction failed on blockchain';
        console.error(`[${timestamp}] [TreasuryClient] Transaction failed:`, {
          txHash,
          blockNumber: receipt.blockNumber,
          from: receipt.from,
          to: receipt.to,
          gasUsed: receipt.gasUsed.toString(),
        });
        return { success: false, txHash, error };
      }

      console.log(`[${timestamp}] [TreasuryClient] Withdrawal successful:`, {
        txHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed.toString(),
        userAddress,
        amount: this.client.formatCTC(amount),
      });

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${timestamp}] [TreasuryClient] Withdrawal processing error:`, {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage,
        userAddress,
        amount: this.client.formatCTC(amount),
      });

      return {
        success: false,
        error: `Withdrawal failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get current treasury wallet balance
   * 
   * @returns Treasury balance in wei (bigint)
   * @throws Error if balance check fails after retries
   */
  async getTreasuryBalance(): Promise<bigint> {
    try {
      const balance = await this.client.getBalance(this.treasuryAddress);
      console.log('[TreasuryClient] Treasury balance:', this.client.formatCTC(balance), 'CTC');
      return balance;
    } catch (error) {
      console.error('[TreasuryClient] Failed to get treasury balance:', error);
      throw new Error(`Failed to get treasury balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Validate if a withdrawal amount can be processed
   * 
   * Checks if the treasury has sufficient balance to process the withdrawal.
   * This is a simple comparison and does not account for gas fees.
   * 
   * @param amount - Withdrawal amount in wei (bigint)
   * @param treasuryBalance - Current treasury balance in wei (bigint)
   * @returns true if withdrawal is valid, false otherwise
   */
  validateWithdrawal(amount: bigint, treasuryBalance: bigint): boolean {
    // Simple validation: treasury must have at least the withdrawal amount
    // Note: In production, you might want to add a buffer for gas fees
    const isValid = treasuryBalance >= amount;

    if (!isValid) {
      console.warn('[TreasuryClient] Withdrawal validation failed:', {
        requestedAmount: this.client.formatCTC(amount),
        treasuryBalance: this.client.formatCTC(treasuryBalance),
        shortfall: this.client.formatCTC(amount - treasuryBalance),
      });
    }

    return isValid;
  }

  /**
   * Get the treasury wallet address
   * @returns Treasury address
   */
  getTreasuryAddress(): string {
    return this.treasuryAddress;
  }
}

/**
 * Singleton instance for server-side use
 * 
 * WARNING: Only use in server-side code (API routes, server actions)
 */
let treasuryClientInstance: TreasuryClient | null = null;

/**
 * Get or create a TreasuryClient instance
 * 
 * This function creates a singleton instance of TreasuryClient using the
 * private key from environment variables.
 * 
 * WARNING: Only call this function in server-side code.
 * 
 * @returns TreasuryClient instance
 * @throws Error if private key is not configured
 */
export function getTreasuryClient(): TreasuryClient {
  if (!treasuryClientInstance) {
    treasuryClientInstance = new TreasuryClient();
  }
  return treasuryClientInstance;
}
