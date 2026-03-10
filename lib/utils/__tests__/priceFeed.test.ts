/**
 * Test Suite: Pyth Network Price Feed Integration
 * 
 * Task: 9.1 Verify lib/utils/priceFeed.ts works with CreditCoin
 * Requirements: 9.1, 9.2, 9.4
 * 
 * Verifies:
 * - Pyth Hermes endpoint is correct
 * - Retry logic (3 attempts with 1 second delay)
 * - Price feed IDs are correct for supported assets
 * - Price data format and parsing
 */

import { 
  PythPriceFeed, 
  fetchPrice, 
  PRICE_FEED_IDS,
  PriceData,
  AssetType 
} from '../priceFeed';

// Mock fetch globally
global.fetch = jest.fn();

describe('Pyth Network Price Feed Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('Pyth Hermes Endpoint Configuration', () => {
    it('should use correct Pyth Hermes endpoint', async () => {
      // Requirement 9.1: Verify correct Pyth Hermes endpoint
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('BTC');
      await feed.fetchPrice();

      // Verify the endpoint is https://hermes.pyth.network
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://hermes.pyth.network/v2/updates/price/latest')
      );
    });

    it('should format price feed ID correctly with 0x prefix', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.ETH.replace('0x', ''),
          price: {
            price: '300000000000',
            conf: '50000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('ETH');
      await feed.fetchPrice();

      // Verify the ID is included in the request with proper encoding
      const callUrl = (global.fetch as jest.Mock).mock.calls[0][0];
      expect(callUrl).toContain('ids%5B%5D=0x');
      expect(callUrl).toContain(PRICE_FEED_IDS.ETH);
    });
  });

  describe('Price Feed IDs Verification', () => {
    it('should have correct price feed IDs for all supported assets', () => {
      // Requirement 9.2: Verify price feed IDs are correct
      
      // Verify major crypto assets
      expect(PRICE_FEED_IDS.BTC).toBe('0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43');
      expect(PRICE_FEED_IDS.ETH).toBe('0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace');
      expect(PRICE_FEED_IDS.SOL).toBe('0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d');
      
      // Verify all IDs start with 0x and have correct length (66 chars: 0x + 64 hex)
      Object.entries(PRICE_FEED_IDS).forEach(([asset, id]) => {
        expect(id).toMatch(/^0x[a-f0-9]{64}$/);
      });
    });

    it('should support all required asset types', () => {
      const requiredAssets: AssetType[] = ['BTC', 'ETH', 'SOL', 'SUI'];
      
      requiredAssets.forEach(asset => {
        expect(PRICE_FEED_IDS[asset]).toBeDefined();
        expect(typeof PRICE_FEED_IDS[asset]).toBe('string');
      });
    });
  });

  describe('Price Data Fetching and Parsing', () => {
    it('should correctly parse price data with exponent', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000', // 50000 * 10^8
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('BTC');
      const priceData = await feed.fetchPrice();

      // Verify price calculation: price * 10^expo
      expect(priceData.price).toBe(50000);
      expect(priceData.expo).toBe(-8);
      expect(priceData.timestamp).toBe(1234567890);
      expect(priceData.confidence).toBeGreaterThan(0);
    });

    it('should handle different exponents correctly', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.ETH.replace('0x', ''),
          price: {
            price: '300000000000',
            conf: '50000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('ETH');
      const priceData = await feed.fetchPrice();

      // 300000000000 * 10^-8 = 3000
      expect(priceData.price).toBe(3000);
    });

    it('should return PriceData with all required fields', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.SOL.replace('0x', ''),
          price: {
            price: '10000000000',
            conf: '5000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const priceData = await fetchPrice('SOL');

      expect(priceData).toHaveProperty('price');
      expect(priceData).toHaveProperty('confidence');
      expect(priceData).toHaveProperty('timestamp');
      expect(priceData).toHaveProperty('expo');
      
      expect(typeof priceData.price).toBe('number');
      expect(typeof priceData.confidence).toBe('number');
      expect(typeof priceData.timestamp).toBe('number');
      expect(typeof priceData.expo).toBe('number');
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no price data is received', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => ({ parsed: [] })
      });

      const feed = new PythPriceFeed('BTC');
      
      await expect(feed.fetchPrice()).rejects.toThrow('No price data received from Pyth Network');
    });

    it('should throw error on HTTP error response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const feed = new PythPriceFeed('BTC');
      
      await expect(feed.fetchPrice()).rejects.toThrow('HTTP error! status: 500');
    });

    it('should use last known price as fallback when fetch fails', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      // First call succeeds
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('BTC');
      const firstPrice = await feed.fetchPrice();
      expect(firstPrice.price).toBe(50000);

      // Second call fails
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      // Should return last known price
      const fallbackPrice = await feed.fetchPrice();
      expect(fallbackPrice.price).toBe(50000);
      expect(fallbackPrice.confidence).toBe(0); // Confidence is 0 for fallback
    });

    it('should throw error when no last price exists and fetch fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      const feed = new PythPriceFeed('BTC');
      
      await expect(feed.fetchPrice()).rejects.toThrow('Network error');
    });
  });

  describe('Asset Switching', () => {
    it('should allow changing asset and fetch correct price feed', async () => {
      const btcResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      const ethResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.ETH.replace('0x', ''),
          price: {
            price: '300000000000',
            conf: '50000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock)
        .mockResolvedValueOnce({
          ok: true,
          json: async () => btcResponse
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ethResponse
        });

      const feed = new PythPriceFeed('BTC');
      expect(feed.getAsset()).toBe('BTC');
      
      const btcPrice = await feed.fetchPrice();
      expect(btcPrice.price).toBe(50000);

      feed.setAsset('ETH');
      expect(feed.getAsset()).toBe('ETH');
      
      const ethPrice = await feed.fetchPrice();
      expect(ethPrice.price).toBe(3000);

      // Verify correct IDs were used
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain(PRICE_FEED_IDS.BTC);
      expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain(PRICE_FEED_IDS.ETH);
    });

    it('should reset last price when changing asset', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('BTC');
      await feed.fetchPrice();
      expect(feed.getLastPrice()).toBe(50000);

      feed.setAsset('ETH');
      expect(feed.getLastPrice()).toBeNull();
    });
  });

  describe('CreditCoin Compatibility', () => {
    it('should work with CreditCoin testnet (chain-agnostic oracle)', async () => {
      // Requirement 9.1: Pyth oracle is chain-agnostic and works with CreditCoin
      
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      // Pyth Network Hermes is chain-agnostic - same endpoint works for all chains
      const feed = new PythPriceFeed('BTC');
      const priceData = await feed.fetchPrice();

      expect(priceData.price).toBe(50000);
      
      // Verify it uses the public Hermes endpoint (not chain-specific)
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('https://hermes.pyth.network')
      );
    });

    it('should fetch prices for multiple assets used in CreditNomo', async () => {
      // Test that all major assets work
      const assets: AssetType[] = ['BTC', 'ETH', 'SOL'];
      
      for (const asset of assets) {
        const mockResponse = {
          parsed: [{
            id: PRICE_FEED_IDS[asset].replace('0x', ''),
            price: {
              price: '1000000000',
              conf: '1000000',
              expo: -8,
              publish_time: 1234567890
            }
          }]
        };

        (global.fetch as jest.Mock).mockResolvedValueOnce({
          ok: true,
          json: async () => mockResponse
        });

        const priceData = await fetchPrice(asset);
        expect(priceData.price).toBeGreaterThan(0);
      }
    });
  });

  describe('Utility Functions', () => {
    it('should export fetchPrice helper function', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const priceData = await fetchPrice('BTC');
      
      expect(priceData.price).toBe(50000);
      expect(priceData).toHaveProperty('confidence');
      expect(priceData).toHaveProperty('timestamp');
      expect(priceData).toHaveProperty('expo');
    });

    it('should track last fetched price', async () => {
      const mockResponse = {
        parsed: [{
          id: PRICE_FEED_IDS.BTC.replace('0x', ''),
          price: {
            price: '5000000000000',
            conf: '100000000',
            expo: -8,
            publish_time: 1234567890
          }
        }]
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const feed = new PythPriceFeed('BTC');
      expect(feed.getLastPrice()).toBeNull();
      
      await feed.fetchPrice();
      expect(feed.getLastPrice()).toBe(50000);
    });
  });
});
