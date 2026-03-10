/**
 * Treasury Backend Client Module (Aptos)
 *
 * This module provides server-side treasury wallet operations for processing
 * withdrawals from the Aptos treasury wallet. It uses the treasury private
 * key to sign transactions and should NEVER be used in client-side code.
 */

import { CreditCoinClient, buildAptosSigner, formatOctasToApt } from './client';
import { creditCoinTestnet } from './config';

export interface WithdrawalResult {
  success: boolean;
  txHash?: string;
  error?: string;
}

export class TreasuryClient {
  private client: CreditCoinClient;
  private treasuryAddress: string;
  private treasuryPrivateKey: string;

  constructor(privateKey?: string) {
    let key = privateKey || process.env.APTOS_TREASURY_PRIVATE_KEY;
    if (!key) {
      const error = 'Treasury private key not found. Set APTOS_TREASURY_PRIVATE_KEY environment variable.';
      console.error('[TreasuryClient] ERROR:', error);
      throw new Error(error);
    }
    // Strip AIP-80 prefix (ed25519-priv-) if present
    if (key.startsWith('ed25519-priv-')) {
      key = key.replace('ed25519-priv-', '');
    }
    if (!/^(0x)?[0-9a-fA-F]{64}$/.test(key)) {
      const error = 'Invalid treasury private key format';
      console.error('[TreasuryClient] ERROR:', error);
      throw new Error(error);
    }

    this.client = new CreditCoinClient();
    this.treasuryAddress = creditCoinTestnet.treasuryAddress;
    this.treasuryPrivateKey = key;

    console.log('[TreasuryClient] Initialized with treasury address:', this.treasuryAddress);
  }

  async processWithdrawal(userAddress: string, amount: bigint): Promise<WithdrawalResult> {
    const timestamp = new Date().toISOString();
    try {
      console.log(`[${timestamp}] [TreasuryClient] Processing withdrawal:`, {
        userAddress,
        amount: formatOctasToApt(amount),
      });

      if (!userAddress || !userAddress.startsWith('0x')) {
        const error = `Invalid user address: ${userAddress}`;
        console.error(`[${timestamp}] [TreasuryClient] Validation error:`, { error, userAddress });
        return { success: false, error };
      }

      if (amount <= 0n) {
        const error = 'Withdrawal amount must be greater than 0';
        console.error(`[${timestamp}] [TreasuryClient] Validation error:`, {
          error,
          amount: formatOctasToApt(amount),
        });
        return { success: false, error };
      }

      const treasuryBalance = await this.getTreasuryBalance();
      if (!this.validateWithdrawal(amount, treasuryBalance)) {
        const error = `Insufficient treasury balance. Have: ${formatOctasToApt(treasuryBalance)} APT, Need: ${formatOctasToApt(amount)} APT`;
        console.error(`[${timestamp}] [TreasuryClient] Insufficient balance:`, {
          requestedAmount: formatOctasToApt(amount),
          treasuryBalance: formatOctasToApt(treasuryBalance),
        });
        return { success: false, error };
      }

      const signer = buildAptosSigner(this.treasuryPrivateKey);

      const aptos = this.client.getAptos();
      const transaction = await aptos.transaction.build.simple({
        sender: signer.accountAddress,
        data: {
          function: '0x1::aptos_account::transfer',
          functionArguments: [userAddress, amount.toString()],
        },
      });

      let txHash: string;
      try {
        const response = await aptos.signAndSubmitTransaction({
          signer,
          transaction,
        });
        txHash = response.hash;
        console.log(`[${timestamp}] [TreasuryClient] Transaction sent:`, {
          txHash,
          userAddress,
          amount: formatOctasToApt(amount),
        });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] [TreasuryClient] Transaction send failed:`, {
          userAddress,
          amount: formatOctasToApt(amount),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
        });
        return { success: false, error: `Withdrawal failed: ${errorMessage}` };
      }

      try {
        await aptos.waitForTransaction({ transactionHash: txHash });
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[${timestamp}] [TreasuryClient] Transaction confirmation failed:`, {
          txHash,
          userAddress,
          amount: formatOctasToApt(amount),
          errorType: error instanceof Error ? error.constructor.name : 'Unknown',
          errorMessage,
        });
        return { success: false, txHash, error: `Transaction confirmation failed: ${errorMessage}` };
      }

      console.log(`[${timestamp}] [TreasuryClient] Withdrawal successful:`, {
        txHash,
        userAddress,
        amount: formatOctasToApt(amount),
      });

      return { success: true, txHash };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`[${timestamp}] [TreasuryClient] Withdrawal processing error:`, {
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage,
        userAddress,
        amount: formatOctasToApt(amount),
      });
      return { success: false, error: `Withdrawal failed: ${errorMessage}` };
    }
  }

  async getTreasuryBalance(): Promise<bigint> {
    try {
      const balance = await this.client.getBalance(this.treasuryAddress);
      console.log('[TreasuryClient] Treasury balance:', formatOctasToApt(balance), 'APT');
      return balance;
    } catch (error) {
      console.error('[TreasuryClient] Failed to get treasury balance:', error);
      throw new Error(`Failed to get treasury balance: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  validateWithdrawal(amount: bigint, treasuryBalance: bigint): boolean {
    const isValid = treasuryBalance >= amount;
    if (!isValid) {
      console.warn('[TreasuryClient] Withdrawal validation failed:', {
        requestedAmount: formatOctasToApt(amount),
        treasuryBalance: formatOctasToApt(treasuryBalance),
      });
    }
    return isValid;
  }

  getTreasuryAddress(): string {
    return this.treasuryAddress;
  }
}

let treasuryClientInstance: TreasuryClient | null = null;

export function getTreasuryClient(): TreasuryClient {
  if (!treasuryClientInstance) {
    treasuryClientInstance = new TreasuryClient();
  }
  return treasuryClientInstance;
}
