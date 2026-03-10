'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Copy, CheckCircle, XCircle, Loader2, Check } from 'lucide-react';
import { getExplorerTxUrl } from '@/lib/ctc/config';
import { CreditCoinClient } from '@/lib/ctc/client';

export type TransactionStatus = 'pending' | 'confirmed' | 'failed';

interface TransactionStatusProps {
  txHash: string;
  status?: TransactionStatus;
  autoRefresh?: boolean;
  className?: string;
}

/**
 * TransactionStatus Component
 * 
 * Displays transaction hash with copy-to-clipboard functionality,
 * real-time transaction status, and a clickable link to the
 * Aptos mainnet block explorer.
 * 
 * Features:
 * - Copy transaction hash to clipboard
 * - Display transaction status (pending, confirmed, failed)
 * - Generate and display Aptos block explorer link
 * - Auto-refresh status for pending transactions
 * 
 * Requirements: 13.1, 13.2, 13.3, 13.4, 13.5
 */
export const TransactionStatus: React.FC<TransactionStatusProps> = ({
  txHash,
  status: initialStatus,
  autoRefresh = true,
  className = '',
}) => {
  const [status, setStatus] = useState<TransactionStatus>(initialStatus || 'pending');
  const [copied, setCopied] = useState(false);
  const [isChecking, setIsChecking] = useState(false);

  // Auto-refresh transaction status for pending transactions
  useEffect(() => {
    if (!autoRefresh || status !== 'pending') return;

    let isMounted = true;
    const checkStatus = async () => {
      if (!isMounted) return;
      
      try {
        setIsChecking(true);
        const client = new CreditCoinClient();
        const receipt = await client.waitForTransaction(txHash);
        
        if (!isMounted) return;
        
        if (receipt.status === 'success') {
          setStatus('confirmed');
        } else if (receipt.status === 'failed') {
          setStatus('failed');
        }
      } catch (error) {
        console.error('Error checking transaction status:', error);
        // Keep status as pending if check fails
      } finally {
        if (isMounted) {
          setIsChecking(false);
        }
      }
    };

    // Check immediately
    checkStatus();

    // Set up polling for pending transactions
    const interval = setInterval(checkStatus, 5000); // Check every 5 seconds

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [txHash, status, autoRefresh]);

  // Copy transaction hash to clipboard
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(txHash);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy transaction hash:', error);
    }
  };

  // Generate block explorer URL
  const explorerUrl = getExplorerTxUrl(txHash);

  // Render status icon and text
  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-yellow-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-xs font-mono">Pending</span>
          </div>
        );
      case 'confirmed':
        return (
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-mono">Confirmed</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-red-400">
            <XCircle className="w-4 h-4" />
            <span className="text-xs font-mono">Failed</span>
          </div>
        );
    }
  };

  return (
    <div className={`p-3 rounded-lg border bg-black/30 space-y-2 ${className}`}>
      {/* Status */}
      <div className="flex items-center justify-between">
        {renderStatus()}
        {isChecking && status === 'pending' && (
          <span className="text-[10px] text-gray-500 font-mono">Checking...</span>
        )}
      </div>

      {/* Transaction Hash with Copy Button */}
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-gray-500 font-mono uppercase mb-1">Transaction Hash</p>
          <p className="text-xs text-gray-300 font-mono truncate" title={txHash}>
            {txHash}
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 p-2 rounded hover:bg-white/10 transition-colors"
          title="Copy transaction hash"
        >
          {copied ? (
            <Check className="w-4 h-4 text-green-400" />
          ) : (
            <Copy className="w-4 h-4 text-gray-400" />
          )}
        </button>
      </div>

      {/* Block Explorer Link */}
      <a
        href={explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-[#00f5ff] hover:text-cyan-400 transition-colors text-xs font-mono group"
      >
        <span>View on Block Explorer</span>
        <ExternalLink className="w-3 h-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
      </a>
    </div>
  );
};
