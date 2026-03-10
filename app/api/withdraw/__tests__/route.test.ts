/**
 * Unit tests for Withdraw API endpoint
 * 
 * Tests cover:
 * - Request validation (missing fields, invalid formats)
 * - Balance checking (sufficient/insufficient)
 * - House balance debit
 * - Treasury withdrawal processing
 * - Balance revert on failure
 * - Error handling
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import { ethers } from 'ethers';
import { getTreasuryClient } from '@/lib/ctc/backend-client';
import { updateHouseBalance, getHouseBalance } from '@/lib/ctc/database';

// Mock NextResponse.json
jest.mock('next/server', () => ({
  NextRequest: jest.fn(),
  NextResponse: {
    json: jest.fn((body, init) => ({
      json: async () => body,
      status: init?.status || 200,
    })),
  },
}));

// Mock dependencies
jest.mock('@/lib/ctc/backend-client');
jest.mock('@/lib/ctc/database');

describe('POST /api/withdraw', () => {
  let mockTreasuryClient: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock treasury client
    mockTreasuryClient = {
      processWithdrawal: jest.fn(),
    };

    (getTreasuryClient as jest.Mock).mockReturnValue(mockTreasuryClient);
  });

  const createRequest = (body: any): NextRequest => {
    return {
      json: async () => body,
    } as NextRequest;
  };

  describe('Request Validation', () => {
    it('should reject request with missing userAddress', async () => {
      const request = createRequest({
        amount: '1.0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject request with missing amount', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject invalid user address format', async () => {
      const request = createRequest({
        userAddress: 'invalid-address',
        amount: '1.0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid user address format');
    });

    it('should reject zero amount', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        amount: '0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('must be greater than 0');
    });

    it('should reject negative amount', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        amount: '-1.0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('must be greater than 0');
    });

    it('should reject invalid amount format', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        amount: 'not-a-number',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid amount format');
    });
  });

  describe('Balance Checking', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: '1.5',
    };

    it('should reject withdrawal if house balance is insufficient', async () => {
      // Mock insufficient balance
      (getHouseBalance as jest.Mock).mockResolvedValue('1.0');

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Insufficient house balance');
    });

    it('should reject withdrawal if house balance equals amount (edge case)', async () => {
      // Mock exact balance (should allow withdrawal)
      (getHouseBalance as jest.Mock).mockResolvedValue('1.5');
      (updateHouseBalance as jest.Mock).mockResolvedValue('0.0');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      // Should succeed when balance equals amount
      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should allow withdrawal if house balance is greater than amount', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('8.5');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('House Balance Debit', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: '1.5',
    };

    it('should debit house balance with transaction hash after withdrawal', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('8.5');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest(validRequest);
      await POST(request);

      // Verify updateHouseBalance was called with negative amount and txHash
      expect(updateHouseBalance).toHaveBeenCalledWith(
        validRequest.userAddress,
        '-1.5',
        'withdraw',
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      );
    });

    it('should return 500 if balance debit fails', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });
      (updateHouseBalance as jest.Mock).mockRejectedValue(new Error('Database error'));

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to update house balance');
    });
  });

  describe('Treasury Withdrawal Processing', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: '1.5',
    };

    it('should process withdrawal via TreasuryClient', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('8.5');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest(validRequest);
      await POST(request);

      // Verify processWithdrawal was called with correct parameters
      expect(mockTreasuryClient.processWithdrawal).toHaveBeenCalledWith(
        validRequest.userAddress,
        ethers.parseUnits(validRequest.amount, 18)
      );
    });

    it('should return success response with txHash on successful withdrawal', async () => {
      const txHash = '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890';
      
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('8.5');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash,
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.txHash).toBe(txHash);
      expect(data.newBalance).toBe('8.5');
    });
  });

  describe('Balance Revert on Failure', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: '1.5',
    };

    it('should revert balance if withdrawal fails', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock)
        .mockResolvedValueOnce('8.5') // First call: debit
        .mockResolvedValueOnce('10.0'); // Second call: revert
      
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: false,
        error: 'Insufficient treasury balance',
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Insufficient treasury balance');

      // Verify balance was reverted (second call to updateHouseBalance)
      expect(updateHouseBalance).toHaveBeenCalledTimes(2);
      expect(updateHouseBalance).toHaveBeenNthCalledWith(
        2,
        validRequest.userAddress,
        '1.5', // Positive amount to add back
        'withdraw_revert'
      );
    });

    it('should revert balance if withdrawal throws unexpected error', async () => {
      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock)
        .mockResolvedValueOnce('8.5') // First call: debit
        .mockResolvedValueOnce('10.0'); // Second call: revert
      
      mockTreasuryClient.processWithdrawal.mockRejectedValue(new Error('Network error'));

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);

      // Verify balance was reverted
      expect(updateHouseBalance).toHaveBeenCalledTimes(2);
      expect(updateHouseBalance).toHaveBeenNthCalledWith(
        2,
        validRequest.userAddress,
        '1.5',
        'withdraw_revert'
      );
    });

    it('should log critical error if balance revert fails', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock)
        .mockResolvedValueOnce('8.5') // First call: debit
        .mockRejectedValueOnce(new Error('Database connection lost')); // Second call: revert fails
      
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: false,
        error: 'Transaction failed',
      });

      const request = createRequest(validRequest);
      await POST(request);

      // Verify critical error was logged
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('CRITICAL'),
        expect.any(Object)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      amount: '1.5',
    };

    it('should handle unexpected errors gracefully', async () => {
      (getHouseBalance as jest.Mock).mockRejectedValue(new Error('Unexpected database error'));

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });

    it('should handle malformed JSON request', async () => {
      const request = {
        json: async () => {
          throw new Error('Invalid JSON');
        },
      } as unknown as NextRequest;

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Internal server error');
    });
  });

  describe('Edge Cases', () => {
    it('should handle very large withdrawal amounts', async () => {
      const largeAmount = '1000000.123456789012345678'; // 1M CTC with full precision
      
      (getHouseBalance as jest.Mock).mockResolvedValue('2000000.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('999999.876543210987654322');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        amount: largeAmount,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle very small withdrawal amounts', async () => {
      const smallAmount = '0.000000000000000001'; // 1 wei
      
      (getHouseBalance as jest.Mock).mockResolvedValue('1.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('0.999999999999999999');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        amount: smallAmount,
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should handle case-insensitive address comparison', async () => {
      const requestWithUpperCase = {
        userAddress: '0xABCD567890123456789012345678901234567890',
        amount: '1.5',
      };

      (getHouseBalance as jest.Mock).mockResolvedValue('10.0');
      (updateHouseBalance as jest.Mock).mockResolvedValue('8.5');
      mockTreasuryClient.processWithdrawal.mockResolvedValue({
        success: true,
        txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      });

      const request = createRequest(requestWithUpperCase);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
