/**
 * Main Zustand store for BYNOMO dApp
 * Combines wallet, game, and history slices
 * 
 * Note: After Aptos migration, blockchain events are handled
 * by the Aptos backend client for deposit/withdrawal confirmation.
 * Game logic remains off-chain.
 */

import { create } from "zustand";
import { WalletState, createWalletSlice } from "./walletSlice";
import { GameState, createGameSlice, startPriceFeed, startGlobalPriceFeed } from "./gameSlice";
import { HistoryState, createHistorySlice, restoreBetHistory } from "./historySlice";
import { BalanceState, createBalanceSlice } from "./balanceSlice";
import { ReferralState, createReferralSlice } from "./referralSlice";
import { ProfileState, createProfileSlice } from "./profileSlice";

/**
 * Combined store type
 */
export type AptnomoStore = WalletState & GameState & HistoryState & BalanceState & ReferralState & ProfileState;

/**
 * Create the main Zustand store
 * Combines all slices into a single store
 */
export const useAptnomoStore = create<AptnomoStore>()((...args) => ({
  ...createWalletSlice(...args),
  ...createGameSlice(...args),
  ...createHistorySlice(...args),
  ...createBalanceSlice(...args),
  ...createReferralSlice(...args),
  ...createProfileSlice(...args)
}));

/**
 * Initialize the store
 * Restores sessions, loads data
 * Should be called once on app initialization
 */
export const initializeStore = async (): Promise<void> => {
  const store = useAptnomoStore.getState();

  try {
    // Restore bet history from localStorage
    restoreBetHistory((bets) => {
      useAptnomoStore.setState({ bets });
    });

    // Load target cells
    await store.loadTargetCells();

    // Fetch house balance if wallet is connected
    if (store.address) {
      await store.fetchBalance(store.address);
    }

    // Start price feed polling
    const stopPriceFeed = store.startGlobalPriceFeed(store.updateAllPrices);

    // Store cleanup function for later use
    (window as any).__aptnomoCleanup = () => {
      stopPriceFeed();
    };


    console.log("APTNOMO store initialized successfully");
  } catch (error) {
    console.error("Error initializing store:", error);
  }
};

/**
 * Cleanup function
 * Stops price feed
 * Should be called when app is unmounted
 */
export const cleanupStore = (): void => {
  if ((window as any).__aptnomoCleanup) {
    (window as any).__aptnomoCleanup();
    delete (window as any).__aptnomoCleanup;
  }
};

/**
 * Export individual selectors for optimized re-renders
 */
export const useWalletAddress = () => useAptnomoStore(state => state.address);
export const useWalletBalance = () => useAptnomoStore(state => state.walletBalance);
export const useIsConnected = () => useAptnomoStore(state => state.isConnected);
export const useCurrentPrice = () => useAptnomoStore(state => state.currentPrice);
export const usePriceHistory = () => useAptnomoStore(state => state.priceHistory);
export const useActiveRound = () => useAptnomoStore(state => state.activeRound);
export const useTargetCells = () => useAptnomoStore(state => state.targetCells);
export const useBetHistory = () => useAptnomoStore(state => state.bets);
export const useIsPlacingBet = () => useAptnomoStore(state => state.isPlacingBet);
export const useIsSettling = () => useAptnomoStore(state => state.isSettling);
export const useHouseBalance = () => useAptnomoStore(state => state.houseBalance);
export const useIsLoadingBalance = () => useAptnomoStore(state => state.isLoading);
export const useUserTier = () => useAptnomoStore(state => state.userTier);

/**
 * Export main store hook (alias for convenience)
 */
export const useStore = useAptnomoStore;
export const useNOMOStore = useAptnomoStore;
export const useBynomoStore = useAptnomoStore;

/**
 * Export actions
 * Note: These selectors return new objects on each call, which can cause infinite loops.
 * Use direct store access (useBynomoStore(state => state.actionName)) instead.
 */
export const useWalletActions = () => {
  const connect = useBynomoStore(state => state.connect);
  const disconnect = useBynomoStore(state => state.disconnect);
  const refreshWalletBalance = useBynomoStore(state => state.refreshWalletBalance);
  return { connect, disconnect, refreshWalletBalance };
};

export const useGameActions = () => {
  const placeBet = useBynomoStore(state => state.placeBet);
  const placeBetFromHouseBalance = useBynomoStore(state => state.placeBetFromHouseBalance);
  const settleRound = useBynomoStore(state => state.settleRound);
  const updatePrice = useBynomoStore(state => state.updatePrice);
  return { placeBet, placeBetFromHouseBalance, settleRound, updatePrice };
};

export const useHistoryActions = () => {
  const fetchHistory = useBynomoStore(state => state.fetchHistory);
  const addBet = useBynomoStore(state => state.addBet);
  const clearHistory = useBynomoStore(state => state.clearHistory);
  return { fetchHistory, addBet, clearHistory };
};

export const useBalanceActions = () => {
  const fetchBalance = useBynomoStore(state => state.fetchBalance);
  const setBalance = useBynomoStore(state => state.setBalance);
  const updateBalance = useBynomoStore(state => state.updateBalance);
  const depositFunds = useBynomoStore(state => state.depositFunds);
  const withdrawFunds = useBynomoStore(state => state.withdrawFunds);
  const clearError = useBynomoStore(state => state.clearError);
  return { fetchBalance, setBalance, updateBalance, depositFunds, withdrawFunds, clearError };
};
