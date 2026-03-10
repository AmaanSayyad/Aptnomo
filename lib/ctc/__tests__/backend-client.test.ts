/**
 * Treasury Backend Client Tests
 * 
 * Unit tests for TreasuryClient class functionality including:
 * - Constructor validation
 * - Withdrawal processing
 * - Treasury balance checking
 * - Withdrawal validation
 */

import { TreasuryClient } from '../backend-client';
import { CreditCoinClient } from '../client';
import { ethers } from 'ethers';

// Mock the CreditCoinClient
jest.mock('../client');

// Mock ethers module
jest.mock('ethers', () => ({
  ethers: {
    isAddress: jest.fn(),
  },
}));

// Mock the config module
jest.mock('../config', () => ({
  creditCoinTestnet: {
    treasuryAddress: '0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123',
  },
}));

describe('TreasuryClient', () => {
  const mockPrivateKey = '0x' + '1'.repeat(64); // Valid format private key
  const mockUserAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variable
    delete process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;
  });

  describe('Constructor', () => {
    it('should initialize with private key from parameter', () => {
      const client = new TreasuryClient(mockPrivateKey);
      expect(client).toBeInstanceOf(TreasuryClient);
      expect(client.getTreasuryAddress()).toBe('0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123');
    });

    it('should initialize with private key from environment variable', () => {
      process.env.CREDITCOIN_TREASURY_PRIVATE_KEY = mockPrivateKey;
      const client = new TreasuryClient();
      expect(client).toBeInstanceOf(TreasuryClient);
    });

    it('should throw error when private key is missing', () => {
      expect(() => new TreasuryClient()).toThrow('Treasury private key not found');
    });

    it('should throw error for invalid private key format', () => {
      expect(() => new TreasuryClient('invalid-key')).toThrow('Invalid treasury private key format');
    });

    it('should accept private key without 0x prefix', () => {
      const keyWithoutPrefix = '1'.repeat(64);
      const client = new TreasuryClient(keyWithoutPrefix);
      expect(client).toBeInstanceOf(TreasuryClient);
    });
  });

  describe('getTreasuryBalance', () => {
    it('should return treasury balance', async () => {
      const mockBalance = BigInt('1000000000000000000'); // 1 CTC
      const mockGetBalance = jest.fn().mockResolvedValue(mockBalance);
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const balance = await client.getTreasuryBalance();

      expect(balance).toBe(mockBalance);
      expect(mockGetBalance).toHaveBeenCalledWith('0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123');
    });

    it('should throw error when balance check fails', async () => {
      const mockGetBalance = jest.fn().mockRejectedValue(new Error('RPC error'));

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      await expect(client.getTreasuryBalance()).rejects.toThrow('Failed to get treasury balance');
    });
  });

  describe('validateWithdrawal', () => {
    it('should return true when treasury has sufficient balance', () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('500000000000000000'); // 0.5 CTC
      const treasuryBalance = BigInt('1000000000000000000'); // 1 CTC

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(true);
    });

    it('should return false when treasury has insufficient balance', () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('2000000000000000000'); // 2 CTC
      const treasuryBalance = BigInt('1000000000000000000'); // 1 CTC

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(false);
    });

    it('should return true when amount equals treasury balance', () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('1000000000000000000'); // 1 CTC
      const treasuryBalance = BigInt('1000000000000000000'); // 1 CTC

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(true);
    });
  });

  describe('processWithdrawal', () => {
    beforeEach(() => {
      // Mock ethers.isAddress to return true by default
      (ethers.isAddress as jest.Mock).mockReturnValue(true);
    });

    it('should return error for invalid user address', async () => {
      // Override mock for this test
      (ethers.isAddress as jest.Mock).mockReturnValue(false);

      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal('invalid-address', BigInt('1000000000000000000'));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user address');
    });

    it('should return error for zero amount', async () => {
      const mockFormatCTC = jest.fn().mockReturnValue('0.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt(0));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Withdrawal amount must be greater than 0');
    });

    it('should return error when treasury has insufficient balance', async () => {
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('500000000000000000')); // 0.5 CTC
      const mockFormatCTC = jest.fn()
        .mockReturnValueOnce('1.0') // For amount in processWithdrawal
        .mockReturnValueOnce('0.5') // For treasuryBalance in getTreasuryBalance
        .mockReturnValueOnce('0.5') // For treasuryBalance in error message
        .mockReturnValueOnce('1.0'); // For amount in error message

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('1000000000000000000')); // 1 CTC

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient treasury balance');
    });

    it('should successfully process withdrawal', async () => {
      const mockTxHash = '0xabc123';
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('2000000000000000000')); // 2 CTC
      const mockSendTransaction = jest.fn().mockResolvedValue(mockTxHash);
      const mockWaitForTransaction = jest.fn().mockResolvedValue({
        transactionHash: mockTxHash,
        blockNumber: 12345,
        from: '0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123',
        to: mockUserAddress,
        value: BigInt('1000000000000000000'),
        status: 'success',
        gasUsed: BigInt('21000'),
      });
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        sendTransaction: mockSendTransaction,
        waitForTransaction: mockWaitForTransaction,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('1000000000000000000'));

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(mockTxHash);
      expect(mockSendTransaction).toHaveBeenCalledWith(mockUserAddress, BigInt('1000000000000000000'));
    });

    it('should return error when transaction fails on blockchain', async () => {
      const mockTxHash = '0xabc123';
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('2000000000000000000'));
      const mockSendTransaction = jest.fn().mockResolvedValue(mockTxHash);
      const mockWaitForTransaction = jest.fn().mockResolvedValue({
        transactionHash: mockTxHash,
        blockNumber: 12345,
        status: 'failed',
        gasUsed: BigInt('21000'),
      });
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        sendTransaction: mockSendTransaction,
        waitForTransaction: mockWaitForTransaction,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('1000000000000000000'));

      expect(result.success).toBe(false);
      expect(result.txHash).toBe(mockTxHash);
      expect(result.error).toBe('Transaction failed on blockchain');
    });

    it('should handle transaction sending errors', async () => {
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('2000000000000000000'));
      const mockSendTransaction = jest.fn().mockRejectedValue(new Error('Network error'));
      const mockFormatCTC = jest.fn().mockReturnValue('1.0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        sendTransaction: mockSendTransaction,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('1000000000000000000'));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Withdrawal failed');
    });
  });

  describe('getTreasuryClient singleton', () => {
    it('should create and return singleton instance', () => {
      process.env.CREDITCOIN_TREASURY_PRIVATE_KEY = mockPrivateKey;
      
      const { getTreasuryClient } = require('../backend-client');
      const client1 = getTreasuryClient();
      const client2 = getTreasuryClient();

      expect(client1).toBe(client2); // Same instance
    });
  });
});
