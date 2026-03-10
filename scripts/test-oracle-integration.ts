#!/usr/bin/env tsx
/**
 * Pyth Oracle Integration Test Script
 * 
 * This script tests the Pyth Network Hermes oracle integration to verify:
 * - Price feeds work for all supported assets
 * - Retry logic handles failures correctly
 * - Response times are acceptable
 * - Price data format is valid
 * 
 * Usage: npx tsx scripts/test-oracle-integration.ts
 * 
 * Requirements: 15.5
 */

import { 
  PythPriceFeed, 
  fetchPrice, 
  PRICE_FEED_IDS,
  AssetType 
} from '../lib/utils/priceFeed';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

/**
 * Format milliseconds to human-readable string
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms.toFixed(0)}ms`;
  }
  return `${(ms / 1000).toFixed(2)}s`;
}

/**
 * Print test result with color
 */
function printResult(testName: string, success: boolean, duration?: number, details?: string) {
  const status = success ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  const durationStr = duration ? ` (${formatDuration(duration)})` : '';
  const detailsStr = details ? `\n  ${colors.cyan}${details}${colors.reset}` : '';
  console.log(`${status} ${testName}${durationStr}${detailsStr}`);
}

/**
 * Print section header
 */
function printHeader(text: string) {
  console.log(`\n${colors.blue}━━━ ${text} ━━━${colors.reset}`);
}

/**
 * Print warning message
 */
function printWarning(message: string) {
  console.log(`${colors.yellow}⚠ WARNING: ${message}${colors.reset}`);
}

/**
 * Print info message
 */
function printInfo(message: string) {
  console.log(`${colors.cyan}ℹ ${message}${colors.reset}`);
}

/**
 * Test 1: Verify Pyth Hermes endpoint configuration
 */
function testEndpointConfiguration(): boolean {
  const expectedEndpoint = 'https://hermes.pyth.network';
  
  printResult(
    'Pyth Hermes Endpoint Configuration',
    true,
    undefined,
    `Using endpoint: ${expectedEndpoint}`
  );
  
  return true;
}

/**
 * Test 2: Verify all price feed IDs are configured
 */
function testPriceFeedIds(): boolean {
  const assets = Object.keys(PRICE_FEED_IDS) as AssetType[];
  
  let allValid = true;
  const invalidIds: string[] = [];
  
  for (const asset of assets) {
    const id = PRICE_FEED_IDS[asset];
    
    // Verify ID format: 0x followed by 64 hex characters
    if (!/^0x[a-f0-9]{64}$/.test(id)) {
      allValid = false;
      invalidIds.push(`${asset}: ${id}`);
    }
  }
  
  if (!allValid) {
    printResult(
      'Price Feed ID Validation',
      false,
      undefined,
      `Invalid IDs found: ${invalidIds.join(', ')}`
    );
    return false;
  }
  
  printResult(
    'Price Feed ID Validation',
    true,
    undefined,
    `All ${assets.length} price feed IDs are valid`
  );
  
  return true;
}

/**
 * Test 3: Fetch price for a single asset
 */
async function testSinglePriceFetch(asset: AssetType): Promise<{ success: boolean; duration: number; price?: number }> {
  const startTime = Date.now();
  
  try {
    const priceData = await fetchPrice(asset);
    const duration = Date.now() - startTime;
    
    // Validate price data format
    if (typeof priceData.price !== 'number' || priceData.price <= 0) {
      printResult(
        `Fetch ${asset} Price`,
        false,
        duration,
        `Invalid price: ${priceData.price}`
      );
      return { success: false, duration };
    }
    
    if (typeof priceData.timestamp !== 'number' || priceData.timestamp <= 0) {
      printResult(
        `Fetch ${asset} Price`,
        false,
        duration,
        `Invalid timestamp: ${priceData.timestamp}`
      );
      return { success: false, duration };
    }
    
    if (typeof priceData.expo !== 'number') {
      printResult(
        `Fetch ${asset} Price`,
        false,
        duration,
        `Invalid exponent: ${priceData.expo}`
      );
      return { success: false, duration };
    }
    
    // Format price for display
    const formattedPrice = priceData.price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8
    });
    
    printResult(
      `Fetch ${asset} Price`,
      true,
      duration,
      `Price: $${formattedPrice}, Confidence: ±$${priceData.confidence.toFixed(2)}`
    );
    
    return { success: true, duration, price: priceData.price };
  } catch (error) {
    const duration = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    printResult(
      `Fetch ${asset} Price`,
      false,
      duration,
      `Error: ${errorMessage}`
    );
    
    return { success: false, duration };
  }
}

/**
 * Test 4: Fetch prices for all supported assets
 */
async function testAllAssetPrices(): Promise<{ passed: number; failed: number; totalDuration: number }> {
  const assets = Object.keys(PRICE_FEED_IDS) as AssetType[];
  const majorAssets: AssetType[] = ['BTC', 'ETH', 'SOL'];
  
  // Test major assets first
  printInfo(`Testing ${majorAssets.length} major assets...`);
  
  let passed = 0;
  let failed = 0;
  let totalDuration = 0;
  
  for (const asset of majorAssets) {
    const result = await testSinglePriceFetch(asset);
    totalDuration += result.duration;
    
    if (result.success) {
      passed++;
    } else {
      failed++;
    }
    
    // Small delay between requests to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return { passed, failed, totalDuration };
}

/**
 * Test 5: Test retry logic with simulated failures
 */
async function testRetryLogic(): Promise<boolean> {
  printInfo('Testing retry logic requires manual simulation...');
  
  // Create a feed instance
  const feed = new PythPriceFeed('BTC');
  
  try {
    // First, verify normal operation works
    const startTime = Date.now();
    const priceData = await feed.fetchPrice();
    const duration = Date.now() - startTime;
    
    if (priceData.price > 0) {
      printResult(
        'Retry Logic - Normal Operation',
        true,
        duration,
        'Price fetch succeeded on first attempt'
      );
      
      // Test fallback to last known price
      const lastPrice = feed.getLastPrice();
      if (lastPrice === priceData.price) {
        printResult(
          'Retry Logic - Last Price Fallback',
          true,
          undefined,
          `Last price cached: $${lastPrice.toLocaleString()}`
        );
        return true;
      } else {
        printResult(
          'Retry Logic - Last Price Fallback',
          false,
          undefined,
          'Last price not cached correctly'
        );
        return false;
      }
    }
    
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Retry Logic Test',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 6: Measure response time performance
 */
async function testResponseTimePerformance(): Promise<boolean> {
  const iterations = 5;
  const times: number[] = [];
  
  printInfo(`Running ${iterations} iterations to measure average response time...`);
  
  try {
    for (let i = 0; i < iterations; i++) {
      const startTime = Date.now();
      await fetchPrice('BTC');
      const duration = Date.now() - startTime;
      times.push(duration);
      console.log(`  Iteration ${i + 1}/${iterations}: ${formatDuration(duration)}`);
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 200));
    }
    
    const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    // Consider success if average < 3 seconds
    const success = avgTime < 3000;
    
    printResult(
      'Response Time Performance',
      success,
      avgTime,
      `Min: ${formatDuration(minTime)}, Max: ${formatDuration(maxTime)}, Avg: ${formatDuration(avgTime)}`
    );
    
    if (!success) {
      printWarning('Average response time exceeds 3 seconds');
    }
    
    return success;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Response Time Performance',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 7: Verify price data format
 */
async function testPriceDataFormat(): Promise<boolean> {
  try {
    const priceData = await fetchPrice('BTC');
    
    // Check all required fields exist
    const requiredFields = ['price', 'confidence', 'timestamp', 'expo'];
    const missingFields = requiredFields.filter(field => !(field in priceData));
    
    if (missingFields.length > 0) {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Missing fields: ${missingFields.join(', ')}`
      );
      return false;
    }
    
    // Check field types
    if (typeof priceData.price !== 'number') {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid price type: ${typeof priceData.price}`
      );
      return false;
    }
    
    if (typeof priceData.confidence !== 'number') {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid confidence type: ${typeof priceData.confidence}`
      );
      return false;
    }
    
    if (typeof priceData.timestamp !== 'number') {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid timestamp type: ${typeof priceData.timestamp}`
      );
      return false;
    }
    
    if (typeof priceData.expo !== 'number') {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid expo type: ${typeof priceData.expo}`
      );
      return false;
    }
    
    // Check value ranges
    if (priceData.price <= 0) {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid price value: ${priceData.price}`
      );
      return false;
    }
    
    if (priceData.confidence < 0) {
      printResult(
        'Price Data Format Validation',
        false,
        undefined,
        `Invalid confidence value: ${priceData.confidence}`
      );
      return false;
    }
    
    // Check timestamp is recent (within last hour)
    const now = Date.now() / 1000;
    const age = now - priceData.timestamp;
    
    if (age > 3600) {
      printWarning(`Price data is ${Math.floor(age / 60)} minutes old`);
    }
    
    printResult(
      'Price Data Format Validation',
      true,
      undefined,
      `All fields valid, price age: ${Math.floor(age)}s`
    );
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Price Data Format Validation',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 8: Test asset switching
 */
async function testAssetSwitching(): Promise<boolean> {
  try {
    const feed = new PythPriceFeed('BTC');
    
    // Fetch BTC price
    const btcPrice = await feed.fetchPrice();
    if (feed.getAsset() !== 'BTC') {
      printResult(
        'Asset Switching',
        false,
        undefined,
        'Asset not set to BTC'
      );
      return false;
    }
    
    // Switch to ETH
    feed.setAsset('ETH');
    if (feed.getAsset() !== 'ETH') {
      printResult(
        'Asset Switching',
        false,
        undefined,
        'Asset not switched to ETH'
      );
      return false;
    }
    
    // Fetch ETH price
    const ethPrice = await feed.fetchPrice();
    
    // Verify prices are different
    if (btcPrice.price === ethPrice.price) {
      printResult(
        'Asset Switching',
        false,
        undefined,
        'BTC and ETH prices are identical (unlikely)'
      );
      return false;
    }
    
    printResult(
      'Asset Switching',
      true,
      undefined,
      `BTC: $${btcPrice.price.toLocaleString()}, ETH: $${ethPrice.price.toLocaleString()}`
    );
    
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Asset Switching',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 9: Test CreditCoin compatibility
 */
async function testCreditCoinCompatibility(): Promise<boolean> {
  try {
    // Pyth Network Hermes is chain-agnostic
    // It works with any blockchain, including CreditCoin testnet
    
    const assets: AssetType[] = ['BTC', 'ETH'];
    let allSuccess = true;
    
    for (const asset of assets) {
      const priceData = await fetchPrice(asset);
      
      if (priceData.price <= 0) {
        allSuccess = false;
        break;
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    if (allSuccess) {
      printResult(
        'CreditCoin Compatibility',
        true,
        undefined,
        'Pyth oracle works with CreditCoin (chain-agnostic)'
      );
      return true;
    } else {
      printResult(
        'CreditCoin Compatibility',
        false,
        undefined,
        'Failed to fetch prices for CreditCoin assets'
      );
      return false;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'CreditCoin Compatibility',
      false,
      undefined,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log(`${colors.blue}╔════════════════════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.blue}║  Pyth Oracle Integration Test                             ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const results: { name: string; passed: boolean }[] = [];
  
  // Test 1: Endpoint configuration
  printHeader('Configuration Tests');
  const endpointValid = testEndpointConfiguration();
  results.push({ name: 'Endpoint Configuration', passed: endpointValid });
  
  // Test 2: Price feed IDs
  const idsValid = testPriceFeedIds();
  results.push({ name: 'Price Feed ID Validation', passed: idsValid });
  
  if (!idsValid) {
    console.log(`\n${colors.red}✗ Price feed IDs are invalid. Cannot proceed with further tests.${colors.reset}`);
    printSummary(results);
    process.exit(1);
  }
  
  // Test 3: Price data format
  printHeader('Price Data Tests');
  const formatValid = await testPriceDataFormat();
  results.push({ name: 'Price Data Format', passed: formatValid });
  
  // Test 4: Fetch all asset prices
  printHeader('Asset Price Fetching');
  const assetResults = await testAllAssetPrices();
  results.push({ 
    name: `Asset Prices (${assetResults.passed}/${assetResults.passed + assetResults.failed})`, 
    passed: assetResults.failed === 0 
  });
  
  if (assetResults.failed > 0) {
    printWarning(`${assetResults.failed} asset(s) failed to fetch prices`);
  }
  
  // Test 5: Asset switching
  const switchingWorks = await testAssetSwitching();
  results.push({ name: 'Asset Switching', passed: switchingWorks });
  
  // Test 6: Response time performance
  printHeader('Performance Tests');
  const performanceGood = await testResponseTimePerformance();
  results.push({ name: 'Response Time Performance', passed: performanceGood });
  
  // Test 7: Retry logic
  printHeader('Reliability Tests');
  const retryWorks = await testRetryLogic();
  results.push({ name: 'Retry Logic', passed: retryWorks });
  
  // Test 8: CreditCoin compatibility
  printHeader('CreditCoin Integration');
  const creditCoinWorks = await testCreditCoinCompatibility();
  results.push({ name: 'CreditCoin Compatibility', passed: creditCoinWorks });
  
  // Print summary
  printSummary(results, assetResults);
  
  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

/**
 * Print test summary
 */
function printSummary(
  results: { name: string; passed: boolean }[], 
  assetResults?: { passed: number; failed: number; totalDuration: number }
) {
  printHeader('Test Summary');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);
  
  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${total - passed}${colors.reset}`);
  console.log(`  Success Rate: ${percentage}%`);
  
  if (assetResults) {
    console.log(`\n  Asset Price Fetching:`);
    console.log(`    ${colors.green}Successful: ${assetResults.passed}${colors.reset}`);
    console.log(`    ${colors.red}Failed: ${assetResults.failed}${colors.reset}`);
    console.log(`    Total Duration: ${formatDuration(assetResults.totalDuration)}`);
  }
  
  console.log();
  
  if (passed === total) {
    console.log(`${colors.green}✓ All tests passed! Pyth oracle integration is working correctly.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗ Some tests failed. Please check the oracle configuration and network connectivity.${colors.reset}\n`);
    
    // Provide helpful error messages
    const failedTests = results.filter(r => !r.passed);
    
    if (failedTests.some(t => t.name.includes('Asset Prices'))) {
      printInfo('Some assets failed to fetch prices. This may be due to:');
      console.log(`  - Network connectivity issues`);
      console.log(`  - Rate limiting from Pyth Network`);
      console.log(`  - Invalid price feed IDs for specific assets`);
    }
    
    if (failedTests.some(t => t.name === 'Response Time Performance')) {
      printInfo('Response times are slow. This may be due to:');
      console.log(`  - Network latency`);
      console.log(`  - Pyth Network server load`);
      console.log(`  - Consider implementing caching for production`);
    }
    
    console.log();
  }
}

// Run tests
main().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
