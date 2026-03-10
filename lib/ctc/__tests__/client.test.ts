/**
 * Unit tests for CreditCoinClient
 */

import { CreditCoinClient } from '../client';

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

  });

  describe('formatCTC', () => {
    it('should format 1 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = 100000000n;
      expect(client.formatCTC(amount)).toBe('1');
    });

    it('should format 0 CTC correctly', () => {
      const client = new CreditCoinClient();
      expect(client.formatCTC(0n)).toBe('0');
    });

    it('should format fractional CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = 150000000n;
      expect(client.formatCTC(amount)).toBe('1.5');
    });

    it('should format very small amounts correctly', () => {
      const client = new CreditCoinClient();
      const amount = 1n; // 1 octa
      expect(client.formatCTC(amount)).toBe('0.00000001');
    });

    it('should format large amounts correctly', () => {
      const client = new CreditCoinClient();
      const amount = 1000000n * 100000000n;
      expect(client.formatCTC(amount)).toBe('1000000');
    });
  });

  describe('parseCTC', () => {
    it('should parse 1 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('1');
      expect(amount).toBe(100000000n);
    });

    it('should parse 0 CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('0');
      expect(amount).toBe(0n);
    });

    it('should parse fractional CTC correctly', () => {
      const client = new CreditCoinClient();
      const amount = client.parseCTC('1.5');
      expect(amount).toBe(150000000n);
    });

    it('should throw error for invalid format', () => {
      const client = new CreditCoinClient();
      expect(() => client.parseCTC('invalid')).toThrow('Invalid APT amount format: invalid');
    });

    it('should throw error for empty string', () => {
      const client = new CreditCoinClient();
      expect(() => client.parseCTC('')).toThrow('Invalid APT amount format: empty');
    });

    it('should throw error for too many decimals', () => {
      const client = new CreditCoinClient();
      expect(() => client.parseCTC('1.000000001')).toThrow('APT amount has too many decimals');
    });
  });

  describe('formatCTC and parseCTC round-trip', () => {
    it('should maintain precision for round-trip conversion', () => {
      const client = new CreditCoinClient();
      const original = 12345678901n; // 123.45678901 APT
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
    });

    it('should maintain precision for very small amounts', () => {
      const client = new CreditCoinClient();
      const original = 1n; // 1 octa
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
    });

    it('should maintain precision for very large amounts', () => {
      const client = new CreditCoinClient();
      const original = 99999999999999999n; // 999,999,999.99999999 APT
      const formatted = client.formatCTC(original);
      const parsed = client.parseCTC(formatted);
      expect(parsed).toBe(original);
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
