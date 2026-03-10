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
import { CreditCoinClient, buildAptosSigner, formatOctasToApt } from '../client';

// Mock the CreditCoinClient
jest.mock('../client');

// Mock the config module
jest.mock('../config', () => ({
  creditCoinTestnet: {
    treasuryAddress: '0x1',
  },
}));

describe('TreasuryClient', () => {
  const mockPrivateKey = '0x' + '1'.repeat(64); // Valid format private key
  const mockUserAddress = '0x2';

  beforeEach(() => {
    jest.clearAllMocks();
    // Clear environment variable
    delete process.env.APTOS_TREASURY_PRIVATE_KEY;
    (buildAptosSigner as jest.Mock).mockReturnValue({ accountAddress: '0x1' });
    (formatOctasToApt as jest.Mock).mockImplementation((amount: bigint) => {
      return (Number(amount) / 1e8).toString();
    });
  });

  describe('Constructor', () => {
    it('should initialize with private key from parameter', () => {
      const client = new TreasuryClient(mockPrivateKey);
      expect(client).toBeInstanceOf(TreasuryClient);
      expect(client.getTreasuryAddress()).toBe('0x1');
    });

    it('should initialize with private key from environment variable', () => {
      process.env.APTOS_TREASURY_PRIVATE_KEY = mockPrivateKey;
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
      const mockBalance = BigInt('100000000'); // 1 APT
      const mockGetBalance = jest.fn().mockResolvedValue(mockBalance);
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const balance = await client.getTreasuryBalance();

      expect(balance).toBe(mockBalance);
      expect(mockGetBalance).toHaveBeenCalledWith('0x1');
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
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('50000000'); // 0.5 APT
      const treasuryBalance = BigInt('100000000'); // 1 APT

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(true);
    });

    it('should return false when treasury has insufficient balance', () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('200000000'); // 2 APT
      const treasuryBalance = BigInt('100000000'); // 1 APT

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(false);
    });

    it('should return true when amount equals treasury balance', () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const amount = BigInt('100000000'); // 1 APT
      const treasuryBalance = BigInt('100000000'); // 1 APT

      const isValid = client.validateWithdrawal(amount, treasuryBalance);
      expect(isValid).toBe(true);
    });
  });

  describe('processWithdrawal', () => {
    it('should return error for invalid user address', async () => {
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal('invalid-address', BigInt('100000000'));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid user address');
    });

    it('should return error for zero amount', async () => {
      const mockFormatCTC = jest.fn().mockReturnValue('0');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt(0));

      expect(result.success).toBe(false);
      expect(result.error).toBe('Withdrawal amount must be greater than 0');
    });

    it('should return error when treasury has insufficient balance', async () => {
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('50000000')); // 0.5 APT
      const mockFormatCTC = jest.fn()
        .mockReturnValueOnce('1') // For amount in processWithdrawal
        .mockReturnValueOnce('0.5') // For treasuryBalance in getTreasuryBalance
        .mockReturnValueOnce('0.5') // For treasuryBalance in error message
        .mockReturnValueOnce('1'); // For amount in error message

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('100000000')); // 1 APT

      expect(result.success).toBe(false);
      expect(result.error).toContain('Insufficient treasury balance');
    });

    it('should successfully process withdrawal', async () => {
      const mockTxHash = '0xabc123';
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('200000000')); // 2 APT
      const mockAptos = {
        transaction: {
          build: {
            simple: jest.fn().mockResolvedValue({}),
          },
        },
        signAndSubmitTransaction: jest.fn().mockResolvedValue({ hash: mockTxHash }),
        waitForTransaction: jest.fn().mockResolvedValue({}),
      };
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        getAptos: () => mockAptos,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('100000000'));

      expect(result.success).toBe(true);
      expect(result.txHash).toBe(mockTxHash);
      expect(mockAptos.signAndSubmitTransaction).toHaveBeenCalled();
    });

    it('should return error when transaction fails on blockchain', async () => {
      const mockTxHash = '0xabc123';
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('200000000'));
      const mockAptos = {
        transaction: {
          build: {
            simple: jest.fn().mockResolvedValue({}),
          },
        },
        signAndSubmitTransaction: jest.fn().mockResolvedValue({ hash: mockTxHash }),
        waitForTransaction: jest.fn().mockRejectedValue(new Error('Transaction failed')),
      };
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        getAptos: () => mockAptos,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('100000000'));

      expect(result.success).toBe(false);
      expect(result.txHash).toBe(mockTxHash);
      expect(result.error).toContain('Transaction confirmation failed');
    });

    it('should handle transaction sending errors', async () => {
      const mockGetBalance = jest.fn().mockResolvedValue(BigInt('200000000'));
      const mockAptos = {
        transaction: {
          build: {
            simple: jest.fn().mockResolvedValue({}),
          },
        },
        signAndSubmitTransaction: jest.fn().mockRejectedValue(new Error('Network error')),
        waitForTransaction: jest.fn().mockResolvedValue({}),
      };
      const mockFormatCTC = jest.fn().mockReturnValue('1');

      (CreditCoinClient as jest.MockedClass<typeof CreditCoinClient>).mockImplementation(() => ({
        getBalance: mockGetBalance,
        getAptos: () => mockAptos,
        formatCTC: mockFormatCTC,
      } as any));

      const client = new TreasuryClient(mockPrivateKey);
      const result = await client.processWithdrawal(mockUserAddress, BigInt('100000000'));

      expect(result.success).toBe(false);
      expect(result.error).toContain('Withdrawal failed');
    });
  });

  describe('getTreasuryClient singleton', () => {
    it('should create and return singleton instance', () => {
      process.env.APTOS_TREASURY_PRIVATE_KEY = mockPrivateKey;
      
      const { getTreasuryClient } = require('../backend-client');
      const client1 = getTreasuryClient();
      const client2 = getTreasuryClient();

      expect(client1).toBe(client2); // Same instance
    });
  });
});
