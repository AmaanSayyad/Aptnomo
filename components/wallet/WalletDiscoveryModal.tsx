'use client';

import React from 'react';
import { Modal } from '@/components/ui/Modal';
import { useModal } from 'connectkit';
import { useBynomoStore } from '@/lib/store';

interface WalletDiscoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const WalletDiscoveryModal: React.FC<WalletDiscoveryModalProps> = ({ isOpen, onClose }) => {
  const { setOpen: setCTCVisible } = useModal();
  const setPreferredNetwork = useBynomoStore(state => state.setPreferredNetwork);

  const handleCTCConnect = () => {
    setPreferredNetwork('CTC');
    onClose();
    setTimeout(() => setCTCVisible(true), 100);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Connect Wallet">
      <div className="relative">
        <div className="relative space-y-4">
          <p className="text-[9px] text-white/30 font-bold uppercase tracking-[0.25em] mb-2 px-1">
            CreditCoin Testnet
          </p>
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={handleCTCConnect}
              className="group relative w-full flex items-center gap-4 p-4 bg-gradient-to-r from-white/5 to-transparent border border-white/5 rounded-2xl hover:border-purple-500/30 transition-all duration-300 text-left overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/5 flex items-center justify-center border border-purple-500/20">
                <img src="/logos/ctc-logo.png" alt="CTC" className="w-7 h-7 object-contain rounded-sm" />
              </div>
              <div className="relative flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-white font-bold text-base tracking-tight">CreditCoin Testnet</h3>
                  <span className="text-[8px] bg-purple-500/10 text-purple-500 px-1.5 py-0.5 rounded border border-purple-500/20 font-bold uppercase">Testnet</span>
                </div>
                <p className="text-gray-500 text-[11px] mt-0.5 font-medium">MetaMask, Trust, Binance Wallet</p>
              </div>
              <svg className="w-5 h-5 text-purple-500/50 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
