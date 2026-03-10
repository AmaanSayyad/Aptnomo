/**
 * Wagmi v2 Configuration for CreditCoin Testnet
 * 
 * This module configures Wagmi for wallet connections on CreditCoin testnet.
 * Supports MetaMask (injected), WalletConnect v2, and Privy embedded wallet.
 * 
 * Requirements: 8.1, 8.2, 8.3
 */

import { getDefaultConfig } from 'connectkit';
import { createConfig, http } from 'wagmi';
import { defineChain } from 'viem';
import { creditCoinTestnet } from './config';

/**
 * Define CreditCoin Testnet as a Wagmi-compatible chain
 * 
 * Wagmi requires chains to be defined in a specific format.
 * We convert our CreditCoinConfig to Wagmi's chain format.
 */
export const creditCoinTestnetChain = defineChain({
  id: creditCoinTestnet.chainId,
  name: creditCoinTestnet.chainName,
  nativeCurrency: {
    name: creditCoinTestnet.nativeCurrency.name,
    symbol: creditCoinTestnet.nativeCurrency.symbol,
    decimals: creditCoinTestnet.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: {
      http: creditCoinTestnet.rpcUrls,
    },
  },
  blockExplorers: {
    default: {
      name: 'CreditCoin Explorer',
      url: creditCoinTestnet.blockExplorerUrls[0],
    },
  },
  testnet: true,
});

/**
 * Wagmi Configuration for CreditCoin Testnet
 * 
 * Configures wallet connectors:
 * - MetaMask (injected provider)
 * - WalletConnect v2
 * - Privy embedded wallet (configured separately in app)
 * 
 * ConnectKit's getDefaultConfig automatically sets up MetaMask and WalletConnect.
 */
export const config = createConfig(
  getDefaultConfig({
    // CreditCoin testnet chain
    chains: [creditCoinTestnetChain],
    transports: {
      [creditCoinTestnetChain.id]: http(),
    },

    // WalletConnect Project ID (required for WalletConnect v2)
    walletConnectProjectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'dummy-id',

    // App Info
    appName: 'CreditNomo',
    appDescription: 'Binary Options Trading on CreditCoin Testnet',
    appUrl: 'https://creditnomo.app',
    appIcon: 'https://creditnomo.app/logo.png',
  }),
);
