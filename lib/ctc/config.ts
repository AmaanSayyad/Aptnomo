/**
 * Aptos Mainnet Configuration
 *
 * This module provides the network configuration for Aptos mainnet,
 * including RPC endpoints, explorer URLs, and treasury wallet address.
 *
 * Environment variables are used with fallback values for development.
 */

// Import environment validation (runs on server-side only)
import './env-validation';

export interface AptosConfig {
  chainId: number;
  chainName: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  rpcUrls: string[];
  blockExplorerUrls: string[];
  treasuryAddress: string;
  network: 'mainnet' | 'testnet' | 'devnet';
}

/**
 * Aptos Mainnet Configuration
 *
 * Chain ID: 1
 * Native Token: APT (8 decimals)
 * RPC: https://fullnode.mainnet.aptoslabs.com/v1
 * Explorer: https://explorer.aptoslabs.com
 * Treasury: set via NEXT_PUBLIC_APTOS_TREASURY_ADDRESS
 */
export const creditCoinTestnet: AptosConfig = {
  chainId: Number(process.env.NEXT_PUBLIC_APTOS_MAINNET_CHAIN_ID) || 1,
  chainName: "Aptos Mainnet",
  nativeCurrency: {
    name: "Aptos",
    symbol: process.env.NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_SYMBOL || "APT",
    decimals: Number(process.env.NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_DECIMALS) || 8,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_APTOS_MAINNET_RPC || "https://fullnode.mainnet.aptoslabs.com/v1"
  ],
  blockExplorerUrls: [
    process.env.NEXT_PUBLIC_APTOS_MAINNET_EXPLORER || "https://explorer.aptoslabs.com"
  ],
  treasuryAddress:
    process.env.NEXT_PUBLIC_APTOS_TREASURY_ADDRESS ||
    process.env.APTOS_TREASURY_ADDRESS ||
    "0x0000000000000000000000000000000000000000000000000000000000000000",
  network: 'mainnet',
};

/**
 * Get the full Aptos Mainnet Configuration
 */
export function getCTCConfig(): AptosConfig {
  return creditCoinTestnet;
}

/**
 * Get the primary RPC URL for Aptos mainnet
 */
export function getRpcUrl(): string {
  return creditCoinTestnet.rpcUrls[0];
}

/**
 * Get the Aptos explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${creditCoinTestnet.blockExplorerUrls[0]}/txn/${txHash}?network=mainnet`;
}

/**
 * Get the Aptos explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${creditCoinTestnet.blockExplorerUrls[0]}/account/${address}?network=mainnet`;
}
