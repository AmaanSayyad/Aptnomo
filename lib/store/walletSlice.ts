/**
 * Wallet state slice for Zustand store
 * Manages wallet connection status and address (CreditCoin Chain only).
 * Actual wallet connection is handled by CTC integration in lib/ctc/client.ts and Privy.
 */

import { StateCreator } from "zustand";

export type CtcNetwork = 'CTC' | null;

export interface WalletState {
  address: string | null;
  walletBalance: number;
  isConnected: boolean;
  isConnecting: boolean;
  network: CtcNetwork;
  preferredNetwork: CtcNetwork;
  error: string | null;
  isConnectModalOpen: boolean;

  connect: () => Promise<void>;
  disconnect: () => void;
  refreshWalletBalance: () => Promise<void>;
  clearError: () => void;
  setConnectModalOpen: (open: boolean) => void;

  setAddress: (address: string | null) => void;
  setIsConnected: (connected: boolean) => void;
  setNetwork: (network: CtcNetwork) => void;
  setPreferredNetwork: (network: CtcNetwork) => void;
}

export const createWalletSlice: StateCreator<WalletState> = (set, get) => ({
  address: null,
  walletBalance: 0,
  isConnected: false,
  isConnecting: false,
  network: null,
  preferredNetwork: typeof window !== 'undefined' ? (localStorage.getItem('bynomo_preferred_network') as CtcNetwork) || null : null,
  error: null,
  isConnectModalOpen: false,

  connect: async () => {
    set({ isConnectModalOpen: true });
  },

  disconnect: () => {
    const state = get() as any;
    const accountType = state.accountType;
    set({
      address: null,
      walletBalance: 0,
      isConnected: false,
      isConnecting: false,
      network: null,
      error: null
    } as any);
    const currentAccessCode = state.accessCode;
    if (accountType !== 'demo' && !currentAccessCode) {
      set({
        username: null,
        accessCode: null
      } as any);
    }
  },

  refreshWalletBalance: async () => {
    const { address, isConnected } = get();
    if (!isConnected || !address) return;
    try {
      const { getCTCBalance } = await import('@/lib/ctc/client');
      const balStr = await getCTCBalance(address);
      const balNum = parseFloat(balStr);
      set({ walletBalance: isNaN(balNum) ? 0 : balNum });
    } catch (error) {
      console.error("Error refreshing wallet balance:", error);
    }
  },

  clearError: () => set({ error: null }),
  setConnectModalOpen: (open: boolean) => set({ isConnectModalOpen: open }),
  setAddress: (address: string | null) => set({ address }),
  setIsConnected: (connected: boolean) => set({ isConnected: connected }),

  setNetwork: (network: CtcNetwork) => set({ network }),

  setPreferredNetwork: (network: CtcNetwork) => {
    set({ preferredNetwork: network });
    if (typeof window !== 'undefined') {
      if (network) localStorage.setItem('bynomo_preferred_network', network);
      else localStorage.removeItem('bynomo_preferred_network');
    }
  }
});
