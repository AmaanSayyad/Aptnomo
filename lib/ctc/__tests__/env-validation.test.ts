/**
 * Tests for environment variable validation
 */

import { validateEnvironment } from '../env-validation';

describe('Environment Validation', () => {
  const originalEnv = process.env;
  const originalConsoleLog = console.log;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeEach(() => {
    // Reset environment
    jest.resetModules();
    process.env = { ...originalEnv };
    
    // Mock console methods
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
  });

  afterEach(() => {
    // Restore environment and console
    process.env = originalEnv;
    console.log = originalConsoleLog;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;
  });

  describe('validateEnvironment', () => {
    it('should pass validation when all required variables are set', () => {
      // Set required variables
      process.env.APTOS_TREASURY_PRIVATE_KEY = '2a975a6e86c98d3e96927ba685f2e45a7df6363596e30df574c7901f2e2e6cc9';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.missingCount).toBe(0);
    });

    it('should fail validation when required variables are missing', () => {
      // Clear required variables
      delete process.env.APTOS_TREASURY_PRIVATE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const result = validateEnvironment();

      expect(result.valid).toBe(false);
      expect(result.missingCount).toBeGreaterThan(0);
      expect(console.error).toHaveBeenCalled();
    });

    it('should warn about missing optional variables', () => {
      // Set required variables
      process.env.APTOS_TREASURY_PRIVATE_KEY = '2a975a6e86c98d3e96927ba685f2e45a7df6363596e30df574c7901f2e2e6cc9';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      // Clear optional variables
      delete process.env.NEXT_PUBLIC_APTOS_MAINNET_RPC;
      delete process.env.NEXT_PUBLIC_APTOS_TREASURY_ADDRESS;

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.warningCount).toBeGreaterThan(0);
      expect(console.warn).toHaveBeenCalled();
    });

    it('should return validation results for all variables', () => {
      // Set required variables
      process.env.APTOS_TREASURY_PRIVATE_KEY = '2a975a6e86c98d3e96927ba685f2e45a7df6363596e30df574c7901f2e2e6cc9';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

      const result = validateEnvironment();

      expect(result.results).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
      expect(result.results.length).toBeGreaterThan(0);
      
      // Check that each result has required properties
      result.results.forEach(r => {
        expect(r).toHaveProperty('name');
        expect(r).toHaveProperty('status');
        expect(['ok', 'missing', 'warning']).toContain(r.status);
      });
    });

    it('should handle partial configuration', () => {
      // Set only treasury key, missing both Supabase variables
      process.env.APTOS_TREASURY_PRIVATE_KEY = '2a975a6e86c98d3e96927ba685f2e45a7df6363596e30df574c7901f2e2e6cc9';
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      const result = validateEnvironment();

      // Should fail because Supabase variables are required
      expect(result.valid).toBe(false);
      expect(result.missingCount).toBeGreaterThan(0);
    });

    it('should log success message when all variables are configured', () => {
      // Set all required and optional variables
      process.env.APTOS_TREASURY_PRIVATE_KEY = '2a975a6e86c98d3e96927ba685f2e45a7df6363596e30df574c7901f2e2e6cc9';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
      process.env.NEXT_PUBLIC_APTOS_MAINNET_RPC = 'https://fullnode.mainnet.aptoslabs.com/v1';
      process.env.NEXT_PUBLIC_APTOS_MAINNET_CHAIN_ID = '1';
      process.env.NEXT_PUBLIC_APTOS_MAINNET_EXPLORER = 'https://explorer.aptoslabs.com';
      process.env.NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_SYMBOL = 'APT';
      process.env.NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_DECIMALS = '8';
      process.env.APTOS_TREASURY_ADDRESS = '0x1';
      process.env.NEXT_PUBLIC_APTOS_TREASURY_ADDRESS = '0x1';
      process.env.NEXT_PUBLIC_APP_NAME = 'Nomo';
      process.env.NEXT_PUBLIC_APTOS_NETWORK = 'mainnet';
      process.env.NEXT_PUBLIC_ROUND_DURATION = '30';
      process.env.NEXT_PUBLIC_PRICE_UPDATE_INTERVAL = '1000';
      process.env.NEXT_PUBLIC_CHART_TIME_WINDOW = '300000';

      const result = validateEnvironment();

      expect(result.valid).toBe(true);
      expect(result.missingCount).toBe(0);
      expect(result.warningCount).toBe(0);
      expect(console.log).toHaveBeenCalledWith(expect.stringContaining('All environment variables configured correctly'));
    });
  });
});
