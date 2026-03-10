/**
 * Unit tests for Deposit API endpoint
 * 
 * Tests cover:
 * - Request validation (missing fields, invalid formats)
 * - Transaction verification (status, recipient, amount, sender)
 * - House balance updates
 * - Error handling
 */

import { POST } from '../route';
import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { CreditCoinClient } from '@/lib/ctc/client';
import { updateHouseBalance } from '@/lib/ctc/database';
import { creditCoinTestnet } from '@/lib/ctc/config';

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
jest.mock('@/lib/ctc/client');
jest.mock('@/lib/ctc/database');
jest.mock('@/lib/ctc/config', () => ({
  creditCoinTestnet: {
    treasuryAddress: '0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123',
  },
}));

describe('POST /api/deposit', () => {
  let mockClient: jest.Mocked<CreditCoinClient>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock client
    mockClient = {
      waitForTransaction: jest.fn(),
      formatCTC: jest.fn((amount: bigint) => (Number(amount) / 1e18).toString()),
    } as any;

    (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => mockClient);
  });

  const createRequest = (body: any): NextRequest => {
    return {
      json: async () => body,
    } as NextRequest;
  };

  describe('Request Validation', () => {
    it('should reject request with missing userAddress', async () => {
      const request = createRequest({
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: '1.0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Missing required fields');
    });

    it('should reject request with missing txHash', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
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
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
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
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
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
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
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
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
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
        txHash: '0x1234567890123456789012345678901234567890123456789012345678901234',
        amount: 'not-a-number',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid amount format');
    });

    it('should reject invalid transaction hash format', async () => {
      const request = createRequest({
        userAddress: '0x1234567890123456789012345678901234567890',
        txHash: 'invalid-hash',
        amount: '1.0',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid transaction hash format');
    });
  });

  describe('Transaction Verification', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      amount: '1.5',
    };

    it('should reject if transaction fetch fails', async () => {
      mockClient.waitForTransaction.mockRejectedValue(new Error('RPC error'));

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to verify transaction');
    });

    it('should reject if transaction failed on blockchain', async () => {
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: validRequest.userAddress,
        to: creditCoinTestnet.treasuryAddress,
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'failed',
        gasUsed: BigInt(21000),
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Transaction failed on blockchain');
    });

    it('should reject if recipient is not treasury address', async () => {
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: validRequest.userAddress,
        to: '0x9999999999999999999999999999999999999999', // Wrong address
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'success',
        gasUsed: BigInt(21000),
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('not the treasury address');
    });

    it('should reject if amount does not match', async () => {
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: validRequest.userAddress,
        to: creditCoinTestnet.treasuryAddress,
        value: ethers.parseUnits('2.0', 18), // Different amount
        status: 'success',
        gasUsed: BigInt(21000),
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('amount does not match');
    });

    it('should reject if sender does not match user address', async () => {
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: '0x9999999999999999999999999999999999999999', // Different sender
        to: creditCoinTestnet.treasuryAddress,
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'success',
        gasUsed: BigInt(21000),
      });

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('sender does not match');
    });
  });

  describe('Successful Deposit', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      amount: '1.5',
    };

    it('should credit house balance on valid deposit', async () => {
      // Mock successful transaction verification
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: validRequest.userAddress,
        to: creditCoinTestnet.treasuryAddress,
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'success',
        gasUsed: BigInt(21000),
      });

      // Mock balance update
      (updateHouseBalance as jest.Mock).mockResolvedValue('10.5');

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.newBalance).toBe('10.5');

      // Verify updateHouseBalance was called correctly
      expect(updateHouseBalance).toHaveBeenCalledWith(
        validRequest.userAddress,
        validRequest.amount,
        'deposit',
        validRequest.txHash
      );
    });

    it('should handle case-insensitive address comparison', async () => {
      const requestWithUpperCase = {
        ...validRequest,
        userAddress: '0xABCD567890123456789012345678901234567890',
      };

      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: requestWithUpperCase.userAddress.toLowerCase(),
        to: creditCoinTestnet.treasuryAddress.toUpperCase(), // Different case
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'success',
        gasUsed: BigInt(21000),
      });

      (updateHouseBalance as jest.Mock).mockResolvedValue('10.5');

      const request = createRequest(requestWithUpperCase);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });

  describe('Database Error Handling', () => {
    const validRequest = {
      userAddress: '0x1234567890123456789012345678901234567890',
      txHash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
      amount: '1.5',
    };

    it('should return 503 if database connection fails', async () => {
      mockClient.waitForTransaction.mockResolvedValue({
        transactionHash: validRequest.txHash,
        blockNumber: 12345,
        from: validRequest.userAddress,
        to: creditCoinTestnet.treasuryAddress,
        value: ethers.parseUnits(validRequest.amount, 18),
        status: 'success',
        gasUsed: BigInt(21000),
      });

      (updateHouseBalance as jest.Mock).mockRejectedValue(new Error('Database connection failed'));

      const request = createRequest(validRequest);
      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Database temporarily unavailable');
    });
  });
});
