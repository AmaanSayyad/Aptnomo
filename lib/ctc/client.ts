/**
 * Aptos Mainnet Client Module
 *
 * This module provides a client wrapper for interacting with Aptos mainnet
 * using the Aptos TS SDK. It includes balance operations, transaction handling,
 * and utility methods for APT formatting (8 decimals).
 */

import {
  Account,
  AccountAddress,
  Aptos,
  AptosConfig,
  Ed25519PrivateKey,
  Network,
} from '@aptos-labs/ts-sdk';
import { getRpcUrl } from './config';

const APTOS_COIN_TYPE = '0x1::aptos_coin::AptosCoin';
const APTOS_COIN_STORE = `0x1::coin::CoinStore<${APTOS_COIN_TYPE}>`;
const APT_DECIMALS = 8n;
const APT_FACTOR = 10n ** APT_DECIMALS;

function normalizeAddress(address: string): string {
  try {
    return AccountAddress.from(address).toString();
  } catch {
    return address;
  }
}

function sanitizeLogData(data: any): any {
  if (!data || typeof data !== 'object') return data;
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

export interface TransactionReceipt {
  transactionHash: string;
  blockNumber: number;
  from: string;
  to: string;
  value: bigint;
  status: 'success' | 'failed';
  gasUsed: bigint;
}

export class CreditCoinClient {
  private aptos: Aptos;
  private rpcUrl: string;

  constructor(rpcUrl?: string) {
    this.rpcUrl = rpcUrl || getRpcUrl();
    const config = new AptosConfig({
      network: Network.MAINNET,
      fullnode: this.rpcUrl,
    });
    this.aptos = new Aptos(config);
  }

  getAptos(): Aptos {
    return this.aptos;
  }

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

  async getBalance(address: string): Promise<bigint> {
    const accountAddress = normalizeAddress(address);
    return this.executeWithRetry('getBalance', async () => {
      try {
        const resource = await this.aptos.getAccountResource({
          accountAddress,
          resourceType: APTOS_COIN_STORE,
        });
        const data: any = (resource as any).data || resource;
        const value = data?.coin?.value ?? data?.coin?.value?.toString?.();
        if (value === undefined || value === null) {
          throw new Error('Missing coin value in resource data');
        }
        return BigInt(value);
      } catch (error: any) {
        const message = error?.message || '';
        if (message.includes('resource') && message.includes('not found')) {
          return 0n;
        }
        throw error;
      }
    });
  }

  async getTransactionByHash(txHash: string): Promise<any> {
    return this.executeWithRetry('getTransactionByHash', () =>
      this.aptos.getTransactionByHash({ transactionHash: txHash })
    );
  }

  async waitForTransaction(txHash: string): Promise<TransactionReceipt> {
    const timestamp = new Date().toISOString();
    try {
      await this.executeWithRetry('waitForTransaction', () =>
        this.aptos.waitForTransaction({ transactionHash: txHash })
      );
      const tx: any = await this.getTransactionByHash(txHash);
      const status = tx?.success ? 'success' : 'failed';
      const payload = tx?.payload || {};
      const args = Array.isArray(payload?.arguments) ? payload.arguments : [];
      const to = typeof args[0] === 'string' ? args[0] : '';
      const value = args[1] ? BigInt(args[1]) : 0n;
      return {
        transactionHash: txHash,
        blockNumber: Number(tx?.version || 0),
        from: normalizeAddress(tx?.sender || ''),
        to: normalizeAddress(to),
        value,
        status,
        gasUsed: BigInt(tx?.gas_used || 0),
      };
    } catch (error) {
      console.error(`[${timestamp}] Failed to wait for transaction:`, sanitizeLogData({
        txHash,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
      }));
      throw error;
    }
  }

  formatCTC(amount: bigint): string {
    const sign = amount < 0n ? '-' : '';
    const abs = amount < 0n ? -amount : amount;
    const whole = abs / APT_FACTOR;
    const fraction = abs % APT_FACTOR;
    const fractionStr = fraction.toString().padStart(Number(APT_DECIMALS), '0').replace(/0+$/, '');
    return fractionStr.length ? `${sign}${whole}.${fractionStr}` : `${sign}${whole}`;
  }

  parseCTC(amount: string): bigint {
    const trimmed = amount.trim();
    if (!trimmed) throw new Error('Invalid APT amount format: empty');
    const [whole, fraction = ''] = trimmed.split('.');
    if (!/^\d+$/.test(whole) || (fraction && !/^\d+$/.test(fraction))) {
      throw new Error(`Invalid APT amount format: ${amount}`);
    }
    if (fraction.length > Number(APT_DECIMALS)) {
      throw new Error(`APT amount has too many decimals (max ${APT_DECIMALS})`);
    }
    const paddedFraction = fraction.padEnd(Number(APT_DECIMALS), '0');
    return BigInt(whole) * APT_FACTOR + BigInt(paddedFraction || '0');
  }
}

let clientInstance: CreditCoinClient | null = null;

export function getCreditCoinClient(): CreditCoinClient {
  if (!clientInstance) {
    clientInstance = new CreditCoinClient();
  }
  return clientInstance;
}

export async function getCTCBalance(address: string): Promise<string> {
  const client = getCreditCoinClient();
  const balance = await client.getBalance(address);
  return client.formatCTC(balance);
}

export async function getTreasuryCTCBalance(): Promise<string> {
  const { creditCoinTestnet } = await import('./config');
  return getCTCBalance(creditCoinTestnet.treasuryAddress);
}

export function parseAptToOctas(amount: string): bigint {
  const client = getCreditCoinClient();
  return client.parseCTC(amount);
}

export function formatOctasToApt(amount: bigint): string {
  const client = getCreditCoinClient();
  return client.formatCTC(amount);
}

export function buildAptosSigner(privateKey: string): Account {
  const clean = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  const pk = new Ed25519PrivateKey(clean);
  return Account.fromPrivateKey({ privateKey: pk });
}
