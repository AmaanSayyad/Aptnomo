/**
 * CreditCoin Testnet Configuration
 * 
 * This module provides the network configuration for CreditCoin testnet,
 * including chain parameters, RPC endpoints, and treasury wallet address.
 * 
 * Environment variables are used with fallback values for development.
 */

// Import environment validation (runs on server-side only)
import './env-validation';

export interface CreditCoinConfig {
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
}

/**
 * CreditCoin Testnet Configuration
 * 
 * Chain ID: 102031
 * Native Token: CTC (18 decimals)
 * RPC: https://rpc.cc3-testnet.creditcoin.network
 * Explorer: https://creditcoin-testnet.blockscout.com
 * Treasury: 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123
 */
export const creditCoinTestnet: CreditCoinConfig = {
  chainId: Number(process.env.NEXT_PUBLIC_CREDITCOIN_TESTNET_CHAIN_ID) || 102031,
  chainName: "CreditCoin Testnet",
  nativeCurrency: {
    name: "CreditCoin",
    symbol: process.env.NEXT_PUBLIC_CREDITCOIN_TESTNET_CURRENCY_SYMBOL || "CTC",
    decimals: Number(process.env.NEXT_PUBLIC_CREDITCOIN_TESTNET_CURRENCY_DECIMALS) || 18,
  },
  rpcUrls: [
    process.env.NEXT_PUBLIC_CREDITCOIN_TESTNET_RPC || "https://rpc.cc3-testnet.creditcoin.network"
  ],
  blockExplorerUrls: [
    process.env.NEXT_PUBLIC_CREDITCOIN_TESTNET_EXPLORER || "https://creditcoin-testnet.blockscout.com"
  ],
  treasuryAddress: process.env.NEXT_PUBLIC_CREDITCOIN_TREASURY_ADDRESS || "0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123",
};

/**
 * Get the full CreditCoin Testnet Configuration
 */
export function getCTCConfig(): CreditCoinConfig {
  return creditCoinTestnet;
}

/**
 * Get the primary RPC URL for CreditCoin testnet
 */
export function getRpcUrl(): string {
  return creditCoinTestnet.rpcUrls[0];
}

/**
 * Get the block explorer URL for a transaction
 */
export function getExplorerTxUrl(txHash: string): string {
  return `${creditCoinTestnet.blockExplorerUrls[0]}/tx/${txHash}`;
}

/**
 * Get the block explorer URL for an address
 */
export function getExplorerAddressUrl(address: string): string {
  return `${creditCoinTestnet.blockExplorerUrls[0]}/address/${address}`;
}
