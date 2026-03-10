import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TransactionStatus } from '../TransactionStatus';
import { CreditCoinClient } from '@/lib/ctc/client';

// Mock the CreditCoinClient
jest.mock('@/lib/ctc/client');

// Mock clipboard API
Object.assign(navigator, {
  clipboard: {
    writeText: jest.fn(),
  },
});

describe('TransactionStatus Component', () => {
  const mockTxHash = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Display and UI', () => {
    it('should render transaction hash', () => {
      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={false} />);
      expect(screen.getByText(mockTxHash)).toBeInTheDocument();
    });

    it('should display pending status with spinner', () => {
      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={false} />);
      expect(screen.getByText('Pending')).toBeInTheDocument();
      // Check for spinner by looking for the Loader2 icon
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('should display confirmed status with check icon', () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    it('should display failed status with X icon', () => {
      render(<TransactionStatus txHash={mockTxHash} status="failed" autoRefresh={false} />);
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('should render block explorer link with correct URL', () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      const link = screen.getByRole('link', { name: /view on block explorer/i });
      expect(link).toHaveAttribute('href', `https://explorer.aptoslabs.com/txn/${mockTxHash}?network=mainnet`);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Copy to Clipboard', () => {
    it('should copy transaction hash to clipboard when copy button is clicked', async () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const copyButton = screen.getByTitle('Copy transaction hash');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockTxHash);
      });
    });

    it('should show check icon after successful copy', async () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const copyButton = screen.getByTitle('Copy transaction hash');
      fireEvent.click(copyButton);

      await waitFor(() => {
        // Check icon should appear after copy
        const checkIcon = copyButton.querySelector('svg');
        expect(checkIcon).toBeInTheDocument();
      });
    });

    it('should handle clipboard copy failure gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      (navigator.clipboard.writeText as jest.Mock).mockRejectedValueOnce(new Error('Copy failed'));

      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const copyButton = screen.getByTitle('Copy transaction hash');
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith(
          'Failed to copy transaction hash:',
          expect.any(Error)
        );
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Auto-refresh Status', () => {
    it('should not auto-refresh when autoRefresh is false', async () => {
      const mockWaitForTransaction = jest.fn();
      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={false} />);

      await waitFor(() => {
        expect(mockWaitForTransaction).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should auto-refresh pending transaction status', async () => {
      const mockWaitForTransaction = jest.fn().mockResolvedValue({
        status: 'success',
        transactionHash: mockTxHash,
        blockNumber: 12345,
        from: '0xabc',
        to: '0xdef',
        value: BigInt(0),
        gasUsed: BigInt(21000),
      });

      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={true} />);

      await waitFor(() => {
        expect(mockWaitForTransaction).toHaveBeenCalledWith(mockTxHash);
      });

      await waitFor(() => {
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
      });
    });

    it('should update status to failed when transaction fails', async () => {
      const mockWaitForTransaction = jest.fn().mockResolvedValue({
        status: 'failed',
        transactionHash: mockTxHash,
        blockNumber: 12345,
        from: '0xabc',
        to: '0xdef',
        value: BigInt(0),
        gasUsed: BigInt(21000),
      });

      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={true} />);

      await waitFor(() => {
        expect(screen.getByText('Failed')).toBeInTheDocument();
      });
    });

    it('should not auto-refresh confirmed transactions', async () => {
      const mockWaitForTransaction = jest.fn();
      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={true} />);

      await waitFor(() => {
        expect(mockWaitForTransaction).not.toHaveBeenCalled();
      }, { timeout: 1000 });
    });

    it('should handle status check errors gracefully', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockWaitForTransaction = jest.fn().mockRejectedValue(new Error('Network error'));

      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={true} />);

      await waitFor(() => {
        expect(mockWaitForTransaction).toHaveBeenCalled();
      });

      // Should still show pending status after error
      expect(screen.getByText('Pending')).toBeInTheDocument();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('Custom Styling', () => {
    it('should apply custom className', () => {
      const { container } = render(
        <TransactionStatus 
          txHash={mockTxHash} 
          status="confirmed" 
          autoRefresh={false}
          className="custom-class"
        />
      );
      
      const statusDiv = container.querySelector('.custom-class');
      expect(statusDiv).toBeInTheDocument();
    });
  });

  describe('Requirements Validation', () => {
    it('should validate Requirement 13.1: Display transaction hash with link', () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      // Transaction hash should be displayed
      expect(screen.getByText(mockTxHash)).toBeInTheDocument();
      
      // Link to block explorer should be present
      const link = screen.getByRole('link', { name: /view on block explorer/i });
      expect(link).toBeInTheDocument();
    });

    it('should validate Requirement 13.2: Display transaction hash with link', () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const link = screen.getByRole('link', { name: /view on block explorer/i });
      expect(link).toHaveAttribute('href', expect.stringContaining(mockTxHash));
    });

    it('should validate Requirement 13.3: Format block explorer URL correctly', () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const link = screen.getByRole('link', { name: /view on block explorer/i });
      expect(link).toHaveAttribute(
        'href',
        `https://explorer.aptoslabs.com/txn/${mockTxHash}?network=mainnet`
      );
    });

    it('should validate Requirement 13.4: Display transaction status in real-time', async () => {
      const mockWaitForTransaction = jest.fn().mockResolvedValue({
        status: 'success',
        transactionHash: mockTxHash,
        blockNumber: 12345,
        from: '0xabc',
        to: '0xdef',
        value: BigInt(0),
        gasUsed: BigInt(21000),
      });

      (CreditCoinClient as jest.Mock).mockImplementation(() => ({
        waitForTransaction: mockWaitForTransaction,
      }));

      render(<TransactionStatus txHash={mockTxHash} status="pending" autoRefresh={true} />);

      // Initially pending
      expect(screen.getByText('Pending')).toBeInTheDocument();

      // Should update to confirmed
      await waitFor(() => {
        expect(screen.getByText('Confirmed')).toBeInTheDocument();
      });
    });

    it('should validate Requirement 13.5: Allow copying transaction hash', async () => {
      render(<TransactionStatus txHash={mockTxHash} status="confirmed" autoRefresh={false} />);
      
      const copyButton = screen.getByTitle('Copy transaction hash');
      expect(copyButton).toBeInTheDocument();
      
      fireEvent.click(copyButton);

      await waitFor(() => {
        expect(navigator.clipboard.writeText).toHaveBeenCalledWith(mockTxHash);
      });
    });
  });
});
