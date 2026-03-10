import React, { useEffect, useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useAccount, useChainId, useSwitchChain, useDisconnect } from 'wagmi';
import { useBynomoStore } from '@/lib/store';
import { creditCoinTestnet } from '@/lib/ctc/config';
import { getCTCBalance } from '@/lib/ctc/client';

export const WalletConnect: React.FC = () => {
  const { logout: logoutPrivy, authenticated, user, ready } = usePrivy();
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const { disconnect: disconnectWagmi } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const { network, address, setConnectModalOpen, disconnect: disconnectStore, setPreferredNetwork, setAddress, setIsConnected } = useBynomoStore();

  const [ctcBalance, setCtcBalance] = useState<string>('0');
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [showNetworkPrompt, setShowNetworkPrompt] = useState(false);

  // Check if connected to correct chain (CreditCoin testnet: 102031)
  const isCorrectChain = chainId === creditCoinTestnet.chainId;

  // Fetch CTC balance when wallet is connected
  useEffect(() => {
    const fetchBalance = async () => {
      const activeAddress = wagmiAddress || address;
      if (!activeAddress || !isCorrectChain) {
        setCtcBalance('0');
        return;
      }

      setIsLoadingBalance(true);
      try {
        const balance = await getCTCBalance(activeAddress);
        setCtcBalance(balance);

        // Sync to global store
        const balNum = parseFloat(balance);
        useBynomoStore.setState({ walletBalance: isNaN(balNum) ? 0 : balNum });
      } catch (error) {
        console.error('Failed to fetch CTC balance:', error);
        setCtcBalance('0');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();

    // Refresh balance every 10 seconds
    const interval = setInterval(fetchBalance, 10000);
    return () => clearInterval(interval);
  }, [wagmiAddress, address, isCorrectChain]);

  // Show network prompt when on wrong chain
  useEffect(() => {
    if (wagmiConnected && !isCorrectChain) {
      setShowNetworkPrompt(true);
    } else {
      setShowNetworkPrompt(false);
    }
  }, [wagmiConnected, isCorrectChain]);

  const formatAddress = (addr: string) => {
    if (!addr) return '';
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const handleDisconnect = () => {
    // Logout from all providers
    if (authenticated) logoutPrivy();
    if (wagmiConnected) disconnectWagmi();

    // Explicitly reset our store state
    disconnectStore();
    setPreferredNetwork(null);
    setAddress(null);
    setIsConnected(false);
  };

  const handleSwitchNetwork = async () => {
    try {
      await switchChain({ chainId: creditCoinTestnet.chainId });
      setShowNetworkPrompt(false);
    } catch (error) {
      console.error('Failed to switch network:', error);
    }
  };

  const getNetworkIcon = () => {
    return '/logos/ctc-logo.png';
  };

  const isConnected = !!address || wagmiConnected || authenticated;

  // No longer blocking the entire UI on Privy ready state
  // We only show loading if we are explicitly in an "isConnecting" state from WAGMI
  const showLoading = false;

  if (showLoading) {
    return (
      <div className="w-24 h-9 bg-white/5 animate-pulse rounded-xl border border-white/5 flex items-center justify-center">
        <span className="text-[10px] text-white/20 font-bold">LOADING</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Network Switch Prompt */}
      {showNetworkPrompt && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-[#1a1a1a] border border-white/10 rounded-xl p-6 max-w-md mx-4">
            <h3 className="text-white text-lg font-bold mb-2">Wrong Network</h3>
            <p className="text-gray-400 text-sm mb-4">
              Please switch to CreditCoin Testnet (Chain ID: {creditCoinTestnet.chainId}) to use this application.
            </p>
            <div className="flex gap-3">
              <button
                onClick={handleSwitchNetwork}
                className="flex-1 px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-sm font-bold transition-all"
              >
                Switch Network
              </button>
              <button
                onClick={handleDisconnect}
                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-sm font-bold transition-all"
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}

      {!isConnected ? (
        <button
          onClick={() => setConnectModalOpen(true)}
          data-tour="connect-button"
          className="px-4 py-1.5 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest border border-white/10 transition-all active:scale-95"
        >
          Connect
        </button>
      ) : (
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Balance Display */}
          {isCorrectChain && (
            <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
                  CTC Balance
                </span>
                <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                  {isLoadingBalance ? '...' : parseFloat(ctcBalance).toFixed(4)}
                </span>
              </div>
            </div>
          )}

          {/* Address Display */}
          <div className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-1.5 flex items-center gap-2 sm:gap-2.5">
            <div className="w-4 h-4 shrink-0">
              <img
                src={getNetworkIcon()}
                alt="Network"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex flex-col items-center sm:items-end">
              <span className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter">
                {isCorrectChain ? 'CreditCoin' : 'Wrong Network'}
              </span>
              <span className="text-white text-[10px] sm:text-[11px] font-mono leading-none">
                {address ? `${address.slice(0, 4)}...${address.slice(-3)}` : '...'}
              </span>
            </div>
          </div>

          <button
            onClick={handleDisconnect}
            className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 hover:bg-red-500/20 transition-all"
            title="Disconnect"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
};
