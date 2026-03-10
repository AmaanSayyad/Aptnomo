/**
 * Unit tests for CreditCoinClient
 */

import { CreditCoinClient } from '../client';
import { ethers } from 'ethers';

describe('CreditCoinClient', () => {
  describe('constructor', () => {
    it('should create client with default RPC URL', () => {
      const client = new CreditCoinClient();
      expect(client).toBeInstanceOf(CreditCoinClient);
    });

    it('should create client with custom RPC URL', () => {
      const client = new CreditCoinClient('https://custom-rpc.example.com');
      expect(client).toBeInstanceOf(CreditCoinClient);
    });

    it('should create client with private key for signing', () => {
      const privateKey = '0x' + '1'.repeat(64); // Valid private key format
      const client = new CreditCoinClient(undefined, privateKey);
      expect(client).toBeInstanceOf(CreditCoinClient);
    });
  });

  describe('formatCTC', () => {
    it('should format 1 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = ethers.parseUnits('1', 18);
      expect(client.formatCTC(amount)).toBe('1.0');
    });

    it('should format 0 CTC correctly', () => {
      const client = new CreditCoinClient();
      expect(client.formatCTC(0n)).toBe('0.0');
    });

    it('should format fractional CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = ethers.parseUnits('1.5', 18);
      expect(client.formatCTC(amount)).toBe('1.5');
    });

    it('should format very small amounts correctly', () => {
      const client = new CreditCoinClient();
      const amount = 1n; // 1 wei
      expect(client.formatCTC(amount)).toBe('0.000000000000000001');
    });

    it('should format large amounts correctly', () => {
      const client = new CreditCoinClient();
      const amount = ethers.parseUnits('1000000', 18);
      expect(client.formatCTC(amount)).toBe('1000000.0');
    });
  });

  describe('parseCTC', () => {
    it('should parse 1 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('1');
      expect(amount).toBe(ethers.parseUnits('1', 18));
    });

    it('should parse 0 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('0');
      expect(amount).toBe(0n);
    });

    it('should parse fractional CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('1.5');
      expect(amount).toBe(ethers.parseUnits('1.5', 18));
    });

    it('should throw error for invalid format', () => {
      const client = new CreditCoinClient();
      expect(() => client.parseCTC('invalid')).toThrow('Invalid CTC amount format');
    });

    it('should throw error for empty string', () => {
      const client = new CreditCoinClient();
      expect(() => client.parseCTC('')).toThrow('Invalid CTC amount format');
    });
  });

  describe('formatCTC and parseCTC round-trip', () => {
    it('should maintain precision for round-trip conversion', () => {
      const client = new CreditCoinClient();
      const original = ethers.parseUnits('123.456789012345678', 18);
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
    });

    it('should maintain precision for very small amounts', () => {
      const client = new CreditCoinClient();
      const original = 1n; // 1 wei
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
    });

    it('should maintain precision for very large amounts', () => {
      const client = new CreditCoinClient();
      const original = ethers.parseUnits('999999999.999999999999999999', 18);
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
    });
  });

  describe('sendTransaction validation', () => {
    it('should throw error when no signer configured', async () => {
      const client = new CreditCoinClient();
      await expect(
        client.sendTransaction('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb', 1000n)
      ).rejects.toThrow('No signer configured');
    });

    it('should throw error for invalid recipient address', async () => {
      const privateKey = '0x' + '1'.repeat(64);
      const client = new CreditCoinClient(undefined, privateKey);
      await expect(
        client.sendTransaction('invalid-address', 1000n)
      ).rejects.toThrow('Invalid recipient address');
    });

    it('should throw error for zero amount', async () => {
      const privateKey = '0x' + '1'.repeat(64);
      const client = new CreditCoinClient(undefined, privateKey);
      await expect(
        client.sendTransaction('0x1234567890123456789012345678901234567890', 0n)
      ).rejects.toThrow('Transaction amount must be greater than 0');
    });

    it('should throw error for negative amount', async () => {
      const privateKey = '0x' + '1'.repeat(64);
      const client = new CreditCoinClient(undefined, privateKey);
      await expect(
        client.sendTransaction('0x1234567890123456789012345678901234567890', -1n)
      ).rejects.toThrow('Transaction amount must be greater than 0');
    });
  });

  describe('RPC error handling with retry logic', () => {
    it('should retry RPC calls up to 3 times on failure', async () => {
      // Create client with invalid RPC endpoint to trigger failures
      const client = new CreditCoinClient('https://invalid-rpc-endpoint.example.com');
      
      // Mock console.error to capture logs
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        client.getBalance('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('RPC connection failed after 3 attempts');

      // Verify retry attempts were logged (new structured format)
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\] RPC getBalance failed \(attempt 1\/3\):/),
        expect.objectContaining({
          endpoint: 'https://invalid-rpc-endpoint.example.com',
          error: expect.any(String),
          errorType: 'Error'
        })
      );

      consoleErrorSpy.mockRestore();
    }, 15000); // Increase timeout for retry delays

    it('should log RPC endpoint and timestamp on errors', async () => {
      const client = new CreditCoinClient('https://test-rpc.example.com');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        client.getBalance('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow();

      // Verify timestamp format and endpoint are logged (new structured format)
      const errorCalls = consoleErrorSpy.mock.calls;
      expect(errorCalls.length).toBeGreaterThan(0);
      
      const firstCall = errorCalls[0];
      expect(firstCall[0]).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/); // ISO timestamp
      expect(firstCall[1]).toMatchObject({
        endpoint: 'https://test-rpc.example.com',
        error: expect.any(String),
        errorType: 'Error'
      });

      consoleErrorSpy.mockRestore();
    }, 15000);

    it('should display user-friendly error message after all retries fail', async () => {
      const client = new CreditCoinClient('https://invalid-rpc.example.com');
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

      await expect(
        client.getBalance('0x1234567890123456789012345678901234567890')
      ).rejects.toThrow('RPC connection failed after 3 attempts. Please check your network connection and try again.');

      consoleErrorSpy.mockRestore();
    }, 15000);
  });
});
