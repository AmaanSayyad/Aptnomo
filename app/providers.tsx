'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import { useBynomoStore } from '@/lib/store';
import { ToastProvider } from '@/components/ui/ToastProvider';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PrivyProvider, usePrivy, useWallets } from '@privy-io/react-auth';
import { bsc } from 'viem/chains';
import { WagmiProvider, useAccount } from 'wagmi';
import { ConnectKitProvider } from 'connectkit';
import { config as wagmiConfig } from '@/lib/ctc/wagmi';
import { creditCoinTestnetChain } from '@/lib/ctc/wagmi';

// Custom Components
import { WalletConnectModal } from '@/components/wallet/WalletConnectModal';
import { ReferralSync } from './ReferralSync';

// Wallet Sync component to bridge all wallet states with our Zustand store
function WalletSync() {
  const { user, authenticated, ready: privyReady } = usePrivy();
  const { wallets: privyWallets } = useWallets();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();

  const {
    address,
    accountType,
    setAddress,
    setIsConnected,
    setNetwork,
    refreshWalletBalance,
    fetchProfile,
    fetchBalance,
    preferredNetwork
  } = useBynomoStore();


  // 1. Sync Wallet Address & Connection Status
  useEffect(() => {
    // Check Demo Mode
    if (accountType === 'demo') {
      if (address !== '0xDEMO_1234567890') {
        setAddress('0xDEMO_1234567890');
        setIsConnected(true);
        setNetwork('CTC');
      }
      return;
    }

    const effectiveAddress = wagmiAddress || (authenticated && privyWallets[0] ? privyWallets[0].address : null);
    const effectiveConnected = wagmiConnected || (authenticated && !!privyWallets[0]);

    if (effectiveConnected && effectiveAddress) {
      if (address !== effectiveAddress) {
        setAddress(effectiveAddress);
        setIsConnected(true);
        setNetwork('CTC');

        // Initial fetch
        refreshWalletBalance();
        fetchProfile(effectiveAddress);
        fetchBalance(effectiveAddress);
      }
    } else if (address !== null && address !== '0xDEMO_1234567890') {
      setAddress(null);
      setIsConnected(false);
      setNetwork(null);
    }
  }, [
    authenticated, privyWallets, privyReady, wagmiAddress, wagmiConnected, address, accountType,
    setAddress, setIsConnected, setNetwork, refreshWalletBalance, fetchProfile, fetchBalance
  ]);

  // 2. Poll House Balance
  useEffect(() => {
    if (!address || address === '0xDEMO_1234567890' || accountType === 'demo') return;

    const interval = setInterval(() => {
      fetchBalance(address);
    }, 10000);

    return () => clearInterval(interval);
  }, [address, accountType, fetchBalance]);

  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);
  const [isReady, setIsReady] = useState(false);
  const [queryClient] = useState(() => new QueryClient());

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const initializeApp = async () => {
      try {
        const { updateAllPrices, loadTargetCells, startGlobalPriceFeed } = useBynomoStore.getState();

        await loadTargetCells().catch(console.error);
        const stopPriceFeed = startGlobalPriceFeed(updateAllPrices);
        setIsReady(true);
        return () => { if (stopPriceFeed) stopPriceFeed(); };
      } catch (error) {
        console.error('Error initializing app:', error);
        setIsReady(true);
      }
    };

    initializeApp();
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || 'cm7377f0a00gup9u2w4m3v6be';

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <ConnectKitProvider mode="dark">
          <PrivyProvider
            appId={PRIVY_APP_ID}
            config={{
              appearance: {
                theme: 'dark',
                accentColor: '#A855F7',
                showWalletLoginFirst: true,
              },
              supportedChains: [bsc, creditCoinTestnetChain],
              defaultChain: creditCoinTestnetChain,
              embeddedWallets: {
                createOnLogin: 'users-without-wallets',
              },
            }}
          >
            <WalletSync />
            <ReferralSync />
            {children}
            <WalletConnectModal />
            <ToastProvider />
          </PrivyProvider>
        </ConnectKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
