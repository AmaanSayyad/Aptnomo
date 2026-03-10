/**
 * CreditCoin Testnet Client Module
 * 
 * This module provides a client wrapper for interacting with CreditCoin testnet
 * using ethers.js. It includes balance operations, transaction handling, and
 * utility methods for CTC token formatting.
 * 
 * Features:
 * - Automatic retry logic for RPC failures (3 attempts)
 * - Transaction status tracking
 * - CTC amount formatting (18 decimals)
 * - Comprehensive error handling and logging
 * - Sensitive data protection in logs
 */

import { ethers } from 'ethers';
import { getRpcUrl } from './config';

/**
 * Sanitize log data to prevent sensitive information leakage
 * @param data - Data object to sanitize
 * @returns Sanitized data object
 */
function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }

  const sanitized = { ...data };
  const sensitiveKeys = ['privateKey', 'private_key', 'password', 'secret', 'mnemonic', 'seed'];

  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  }

  return sanitized;
}

/**
 * Transaction receipt interface
 */
export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: bigint;
  status: 'success' | 'failed';
  gasUsed: bigint;
}

/**
 * CreditCoin Client for blockchain interactions
 */
export class CreditCoinClient {
  private provider: ethers.JsonRpcProvider;
  private signer?: ethers.Wallet;
  private rpcUrl: string;

  /**
   * Create a new CreditCoinClient instance
   * @param rpcUrl - RPC endpoint URL (defaults to config)
   * @param privateKey - Optional private key for signing transactions
   */
  constructor(rpcUrl?: string, privateKey?: string) {
    this.rpcUrl = rpcUrl || getRpcUrl();
    this.provider = new ethers.JsonRpcProvider(this.rpcUrl);

    if (privateKey) {
      this.signer = new ethers.Wallet(privateKey, this.provider);
    }
  }

  /**
   * Execute RPC call with retry logic
   * @param operation - Name of the operation for logging
   * @param fn - Function to execute
   * @returns Result of the function
   */
  private async executeWithRetry<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const timestamp = new Date().toISOString();
        console.error(
          `[${timestamp}] RPC ${operation} failed (attempt ${attempt}/${maxRetries}):`,
          sanitizeLogData({
            endpoint: this.rpcUrl,
            error: lastError.message,
            errorType: lastError.constructor.name,
          })
        );

        if (attempt < maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    const timestamp = new Date().toISOString();
    const errorMessage = `RPC connection failed after ${maxRetries} attempts. Please check your network connection and try again.`;
    console.error(
      `[${timestamp}] ${errorMessage}`,
      sanitizeLogData({
        endpoint: this.rpcUrl,
        lastError: lastError?.message,
      })
    );
    throw new Error(errorMessage);
  }

  /**
   * Get CTC balance for an address with retry logic
   * @param address - Wallet address to check
   * @returns Balance in wei (bigint)
   */
  async getBalance(address: string): Promise<bigint> {
    return this.executeWithRetry('getBalance', () => this.provider.getBalance(address));
  }

  /**
   * Send CTC transaction with error handling
   * @param to - Recipient address
   * @param amount - Amount in wei (bigint)
   * @returns Transaction hash
   */
  async sendTransaction(to: string, amount: bigint): Promise<string> {
    if (!this.signer) {
      throw new Error('No signer configured. Private key required for sending transactions.');
    }

    const timestamp = new Date().toISOString();
    const senderAddress = await this.signer.getAddress();

    try {
      // Validate recipient address
      if (!ethers.isAddress(to)) {
        const error = `Invalid recipient address: ${to}`;
        console.error(`[${timestamp}] Transaction validation failed:`, {
          error,
          from: senderAddress,
          to,
          amount: this.formatCTC(amount),
        });
        throw new Error(error);
      }

      // Validate amount
      if (amount <= BigInt(0)) {
        const error = 'Transaction amount must be greater than 0';
        console.error(`[${timestamp}] Transaction validation failed:`, {
          error,
          from: senderAddress,
          to,
          amount: this.formatCTC(amount),
        });
        throw new Error(error);
      }

      // Check sender balance (with retry logic)
      const balance = await this.getBalance(senderAddress);

      if (balance < amount) {
        const error = `Insufficient balance. Have: ${this.formatCTC(balance)} CTC, Need: ${this.formatCTC(amount)} CTC`;
        console.error(`[${timestamp}] Transaction validation failed:`, {
          error,
          from: senderAddress,
          to,
          requestedAmount: this.formatCTC(amount),
          currentBalance: this.formatCTC(balance),
        });
        throw new Error(error);
      }

      // Send transaction (with retry logic for RPC call)
      const tx = await this.executeWithRetry('sendTransaction', () =>
        this.signer!.sendTransaction({
          to,
          value: amount,
        })
      );

      console.log(`[${timestamp}] Transaction sent successfully:`, sanitizeLogData({
        txHash: tx.hash,
        from: senderAddress,
        to,
        amount: this.formatCTC(amount),
      }));
      return tx.hash;
    } catch (error) {
      // Log detailed error information (excluding sensitive data)
      const errorDetails = sanitizeLogData({
        timestamp,
        from: senderAddress,
        to,
        amount: this.formatCTC(amount),
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      console.error('[Transaction Error] Failed to send transaction:', errorDetails);
      throw this.handleTransactionError(error);
    }
  }

  /**
   * Wait for transaction confirmation with status tracking
   * @param txHash - Transaction hash to wait for
   * @param confirmations - Number of confirmations to wait for (default: 1)
   * @returns Transaction receipt
   */
  async waitForTransaction(txHash: string, confirmations: number = 1): Promise<TransactionReceipt> {
    const timestamp = new Date().toISOString();

    try {
      return await this.executeWithRetry('waitForTransaction', async () => {
        console.log(`[${timestamp}] Waiting for transaction ${txHash} (${confirmations} confirmations)...`);

        const receipt = await this.provider.waitForTransaction(txHash, confirmations);

        if (!receipt) {
          const error = `Transaction ${txHash} not found or timed out`;
          console.error(`[${timestamp}] Transaction wait failed:`, {
            txHash,
            confirmations,
            error,
          });
          throw new Error(error);
        }

        const status = receipt.status === 1 ? 'success' : 'failed';

        if (status === 'failed') {
          console.error(`[${timestamp}] Transaction failed on blockchain:`, sanitizeLogData({
            txHash,
            blockNumber: receipt.blockNumber,
            from: receipt.from,
            to: receipt.to,
            gasUsed: receipt.gasUsed.toString(),
          }));
        } else {
          console.log(`[${timestamp}] Transaction confirmed:`, sanitizeLogData({
            txHash,
            status,
            blockNumber: receipt.blockNumber,
            gasUsed: receipt.gasUsed.toString(),
          }));
        }

        return {
          transactionHash: receipt.hash,
          blockNumber: receipt.blockNumber,
          from: receipt.from,
          to: receipt.to || '',
          value: 0n, // Value is not available in receipt, would need to fetch transaction details
          status,
          gasUsed: receipt.gasUsed,
        };
      });
    } catch (error) {
      // Log detailed error for transaction wait failures
      console.error(`[${timestamp}] Failed to wait for transaction:`, sanitizeLogData({
        txHash,
        confirmations,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  /**
   * Format CTC amount from wei to human-readable string (18 decimals)
   * @param amount - Amount in wei (bigint)
   * @returns Formatted string (e.g., "1.5" for 1.5 CTC)
   */
  formatCTC(amount: bigint): string {
    return ethers.formatUnits(amount, 18);
  }

  /**
   * Parse CTC amount from string to wei (18 decimals)
   * @param amount - Amount as string (e.g., "1.5")
   * @returns Amount in wei (bigint)
   */
  parseCTC(amount: string): bigint {
    try {
      return ethers.parseUnits(amount, 18);
    } catch (error) {
      throw new Error(`Invalid CTC amount format: ${amount}`);
    }
  }

  /**
   * Handle transaction errors with user-friendly messages
   * @param error - Error object
   * @returns User-friendly error
   */
  private handleTransactionError(error: any): Error {
    const errorMessage = error?.message?.toLowerCase() || '';

    // User cancellation
    if (
      errorMessage.includes('user rejected') ||
      errorMessage.includes('action_rejected') ||
      errorMessage.includes('user_rejected')
    ) {
      return new Error('Transaction was cancelled by user.');
    }

    // Insufficient funds
    if (errorMessage.includes('insufficient funds') || errorMessage.includes('insufficient balance')) {
      return new Error('Insufficient CTC balance for this transaction.');
    }

    // Nonce issues
    if (errorMessage.includes('nonce')) {
      return new Error('Transaction nonce conflict. Please try again.');
    }

    // Gas estimation issues
    if (errorMessage.includes('gas')) {
      return new Error('Gas estimation failed. Please check transaction parameters.');
    }

    // Network/RPC issues
    if (errorMessage.includes('network') || errorMessage.includes('timeout') || errorMessage.includes('connection')) {
      return new Error('Network connection issue. Please check your connection and try again.');
    }

    // Transaction reverted
    if (errorMessage.includes('revert') || errorMessage.includes('execution reverted')) {
      return new Error('Transaction was reverted by the network. Please try again.');
    }

    // Generic error with original message
    if (error instanceof Error) {
      return new Error(`Transaction failed: ${error.message}`);
    }

    return new Error('Transaction failed. Please try again.');
  }
}

/**
 * Singleton instance for convenience
 */
let clientInstance: CreditCoinClient | null = null;

/**
 * Get or create a CreditCoinClient instance
 * @param privateKey - Optional private key for signing transactions
 * @returns CreditCoinClient instance
 */
export function getCreditCoinClient(privateKey?: string): CreditCoinClient {
  if (!clientInstance || (privateKey && !clientInstance['signer'])) {
    clientInstance = new CreditCoinClient(undefined, privateKey);
  }
  return clientInstance;
}

/**
 * Get CTC balance for an address (convenience function)
 * @param address - Wallet address
 * @returns Balance as formatted string
 */
export async function getCTCBalance(address: string): Promise<string> {
  const client = getCreditCoinClient();
  const balance = await client.getBalance(address);
  return client.formatCTC(balance);
}

/**
 * Get treasury CTC balance (convenience function)
 * @returns Balance as formatted string
 */
export async function getTreasuryCTCBalance(): Promise<string> {
  const { creditCoinTestnet } = await import('./config');
  return getCTCBalance(creditCoinTestnet.treasuryAddress);
}
