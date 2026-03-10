#!/usr/bin/env tsx
/**
 * CreditCoin Treasury Wallet Test Script
 * 
 * This script tests the treasury wallet configuration to verify:
 * - Treasury address is a valid EVM address
 * - Treasury has sufficient CTC balance
 * - Transaction signing works with private key (dry run - no actual transaction)
 * 
 * Usage: npx tsx scripts/test-treasury-wallet.ts
 * 
 * Requirements: 15.2
 */

import { ethers } from 'ethers';
import { CreditCoinClient } from '../lib/ctc/client';
import { creditCoinTestnet } from '../lib/ctc/config';

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
 * Print test result with color
 */
function printResult(testName: string, success: boolean, details?: string) {
  const status = success ? `${colors.green}✓ PASS${colors.reset}` : `${colors.red}✗ FAIL${colors.reset}`;
  const detailsStr = details ? `\n  ${colors.cyan}${details}${colors.reset}` : '';
  console.log(`${status} ${testName}${detailsStr}`);
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
 * Test 1: Verify treasury address is valid EVM address
 */
function testTreasuryAddressValidity(): boolean {
  const address = creditCoinTestnet.treasuryAddress;
  
  // Check if address exists
  if (!address) {
    printResult('Treasury Address Validity', false, 'Treasury address is not configured');
    return false;
  }
  
  // Check if address is valid EVM address
  const isValid = ethers.isAddress(address);
  
  if (!isValid) {
    printResult(
      'Treasury Address Validity',
      false,
      `Invalid EVM address format: ${address}`
    );
    return false;
  }
  
  // Check address format (0x + 40 hex chars)
  const hasCorrectFormat = /^0x[0-9a-fA-F]{40}$/.test(address);
  
  if (!hasCorrectFormat) {
    printResult(
      'Treasury Address Validity',
      false,
      `Address has incorrect format: ${address}`
    );
    return false;
  }
  
  printResult(
    'Treasury Address Validity',
    true,
    `Valid EVM address: ${address}`
  );
  return true;
}

/**
 * Test 2: Check treasury CTC balance
 */
async function testTreasuryBalance(): Promise<{ success: boolean; balance?: bigint }> {
  try {
    const client = new CreditCoinClient();
    const address = creditCoinTestnet.treasuryAddress;
    
    printInfo(`Checking balance for: ${address}`);
    
    const balance = await client.getBalance(address);
    const formattedBalance = client.formatCTC(balance);
    
    // Check if balance is zero
    if (balance === 0n) {
      printWarning('Treasury balance is 0 CTC');
      printResult(
        'Treasury Balance Check',
        true,
        `Balance: ${formattedBalance} CTC (WARNING: Empty treasury)`
      );
      return { success: true, balance };
    }
    
    // Check if balance is very low (less than 0.1 CTC)
    const minRecommendedBalance = ethers.parseUnits('0.1', 18);
    if (balance < minRecommendedBalance) {
      printWarning(`Treasury balance is low (< 0.1 CTC)`);
    }
    
    printResult(
      'Treasury Balance Check',
      true,
      `Balance: ${formattedBalance} CTC`
    );
    return { success: true, balance };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Treasury Balance Check',
      false,
      `Error: ${errorMessage}`
    );
    return { success: false };
  }
}

/**
 * Test 3: Verify private key is configured
 */
function testPrivateKeyConfiguration(): { success: boolean; hasPrivateKey: boolean } {
  const privateKey = process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;
  
  if (!privateKey) {
    printResult(
      'Private Key Configuration',
      false,
      'CREDITCOIN_TREASURY_PRIVATE_KEY environment variable is not set'
    );
    return { success: false, hasPrivateKey: false };
  }
  
  // Validate private key format (64 hex chars, optionally prefixed with 0x)
  const cleanKey = privateKey.startsWith('0x') ? privateKey.slice(2) : privateKey;
  
  if (!/^[0-9a-fA-F]{64}$/.test(cleanKey)) {
    printResult(
      'Private Key Configuration',
      false,
      'Private key has invalid format (expected 64 hexadecimal characters)'
    );
    return { success: false, hasPrivateKey: false };
  }
  
  printResult(
    'Private Key Configuration',
    true,
    'Private key is configured and has valid format'
  );
  return { success: true, hasPrivateKey: true };
}

/**
 * Test 4: Verify private key matches treasury address
 */
async function testPrivateKeyMatchesAddress(): Promise<boolean> {
  try {
    const privateKey = process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;
    
    if (!privateKey) {
      printResult(
        'Private Key Address Match',
        false,
        'Private key not configured (skipped)'
      );
      return false;
    }
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    const derivedAddress = wallet.address;
    const configuredAddress = creditCoinTestnet.treasuryAddress;
    
    // Compare addresses (case-insensitive)
    const addressesMatch = derivedAddress.toLowerCase() === configuredAddress.toLowerCase();
    
    if (!addressesMatch) {
      printResult(
        'Private Key Address Match',
        false,
        `Private key derives to ${derivedAddress}, but configured address is ${configuredAddress}`
      );
      return false;
    }
    
    printResult(
      'Private Key Address Match',
      true,
      `Private key correctly derives to treasury address: ${derivedAddress}`
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Private Key Address Match',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 5: Test transaction signing (dry run - no actual transaction)
 */
async function testTransactionSigning(): Promise<boolean> {
  try {
    const privateKey = process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;
    
    if (!privateKey) {
      printResult(
        'Transaction Signing (Dry Run)',
        false,
        'Private key not configured (skipped)'
      );
      return false;
    }
    
    printInfo('Creating test transaction (will NOT be broadcast)...');
    
    // Create client with private key
    const client = new CreditCoinClient(undefined, privateKey);
    const wallet = new ethers.Wallet(privateKey);
    
    // Create a test transaction (to self, 0 value)
    const testTx = {
      to: creditCoinTestnet.treasuryAddress,
      value: 0n,
      gasLimit: 21000n,
      gasPrice: ethers.parseUnits('1', 'gwei'),
      nonce: 0, // Dummy nonce for dry run
      chainId: creditCoinTestnet.chainId,
    };
    
    // Sign the transaction (but don't send it)
    const signedTx = await wallet.signTransaction(testTx);
    
    // Verify the signed transaction can be parsed
    const parsedTx = ethers.Transaction.from(signedTx);
    
    if (!parsedTx.signature) {
      printResult(
        'Transaction Signing (Dry Run)',
        false,
        'Failed to parse signature from signed transaction'
      );
      return false;
    }
    
    // Verify signature is valid
    const recoveredAddress = parsedTx.from;
    const expectedAddress = creditCoinTestnet.treasuryAddress;
    
    if (recoveredAddress?.toLowerCase() !== expectedAddress.toLowerCase()) {
      printResult(
        'Transaction Signing (Dry Run)',
        false,
        `Signature verification failed: recovered ${recoveredAddress}, expected ${expectedAddress}`
      );
      return false;
    }
    
    printResult(
      'Transaction Signing (Dry Run)',
      true,
      `Successfully signed test transaction (signature verified, NOT broadcast)`
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Transaction Signing (Dry Run)',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 6: Test TreasuryClient initialization
 */
async function testTreasuryClientInitialization(): Promise<boolean> {
  try {
    const privateKey = process.env.CREDITCOIN_TREASURY_PRIVATE_KEY;
    
    if (!privateKey) {
      printResult(
        'TreasuryClient Initialization',
        false,
        'Private key not configured (skipped)'
      );
      return false;
    }
    
    // Dynamically import TreasuryClient (server-side only)
    const { TreasuryClient } = await import('../lib/ctc/backend-client');
    
    // Try to initialize TreasuryClient
    const treasuryClient = new TreasuryClient(privateKey);
    
    // Verify treasury address matches
    const clientAddress = treasuryClient.getTreasuryAddress();
    const configAddress = creditCoinTestnet.treasuryAddress;
    
    if (clientAddress.toLowerCase() !== configAddress.toLowerCase()) {
      printResult(
        'TreasuryClient Initialization',
        false,
        `Address mismatch: client has ${clientAddress}, config has ${configAddress}`
      );
      return false;
    }
    
    printResult(
      'TreasuryClient Initialization',
      true,
      'TreasuryClient initialized successfully'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'TreasuryClient Initialization',
      false,
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
  console.log(`${colors.blue}║  CreditCoin Treasury Wallet Test                          ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const results: { name: string; passed: boolean }[] = [];
  
  // Display treasury configuration
  printHeader('Treasury Configuration');
  console.log(`  Treasury Address: ${colors.cyan}${creditCoinTestnet.treasuryAddress}${colors.reset}`);
  console.log(`  Chain ID: ${colors.cyan}${creditCoinTestnet.chainId}${colors.reset}`);
  console.log(`  Network: ${colors.cyan}${creditCoinTestnet.chainName}${colors.reset}`);
  console.log(`  RPC URL: ${colors.cyan}${creditCoinTestnet.rpcUrls[0]}${colors.reset}`);
  
  // Test 1: Treasury address validity
  printHeader('Address Validation');
  const addressValid = testTreasuryAddressValidity();
  results.push({ name: 'Treasury Address Validity', passed: addressValid });
  
  if (!addressValid) {
    console.log(`\n${colors.red}✗ Treasury address is invalid. Cannot proceed with further tests.${colors.reset}`);
    printSummary(results);
    process.exit(1);
  }
  
  // Test 2: Treasury balance
  printHeader('Balance Check');
  const balanceResult = await testTreasuryBalance();
  results.push({ name: 'Treasury Balance Check', passed: balanceResult.success });
  
  // Test 3: Private key configuration
  printHeader('Private Key Tests');
  const privateKeyResult = testPrivateKeyConfiguration();
  results.push({ name: 'Private Key Configuration', passed: privateKeyResult.success });
  
  if (!privateKeyResult.hasPrivateKey) {
    printWarning('Private key not configured. Skipping signing tests.');
    printInfo('Set CREDITCOIN_TREASURY_PRIVATE_KEY environment variable to enable withdrawal operations.');
  } else {
    // Test 4: Private key matches address
    const addressMatch = await testPrivateKeyMatchesAddress();
    results.push({ name: 'Private Key Address Match', passed: addressMatch });
    
    // Test 5: Transaction signing (dry run)
    printHeader('Transaction Signing Tests');
    const signingWorks = await testTransactionSigning();
    results.push({ name: 'Transaction Signing (Dry Run)', passed: signingWorks });
    
    // Test 6: TreasuryClient initialization
    const clientWorks = await testTreasuryClientInitialization();
    results.push({ name: 'TreasuryClient Initialization', passed: clientWorks });
  }
  
  // Print summary
  printSummary(results, balanceResult.balance);
  
  // Exit with appropriate code
  const criticalTests = results.filter(r => 
    r.name !== 'Treasury Balance Check' || balanceResult.balance !== 0n
  );
  const allCriticalPassed = criticalTests.every(r => r.passed);
  
  process.exit(allCriticalPassed ? 0 : 1);
}

/**
 * Print test summary
 */
function printSummary(results: { name: string; passed: boolean }[], balance?: bigint) {
  printHeader('Test Summary');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);
  
  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${total - passed}${colors.reset}`);
  console.log(`  Success Rate: ${percentage}%\n`);
  
  if (passed === total) {
    console.log(`${colors.green}✓ All tests passed! Treasury wallet is properly configured.${colors.reset}\n`);
    
    if (balance !== undefined && balance === 0n) {
      printWarning('Treasury balance is 0 CTC. Fund the treasury to enable withdrawals.');
      console.log(`  ${colors.cyan}Treasury Address: ${creditCoinTestnet.treasuryAddress}${colors.reset}\n`);
    }
  } else {
    console.log(`${colors.red}✗ Some tests failed. Please check the treasury configuration.${colors.reset}\n`);
    
    // Provide helpful error messages
    const failedTests = results.filter(r => !r.passed);
    
    if (failedTests.some(t => t.name === 'Treasury Address Validity')) {
      printInfo('Fix: Update CREDITCOIN_TREASURY_ADDRESS in your .env file with a valid EVM address.');
    }
    
    if (failedTests.some(t => t.name === 'Private Key Configuration')) {
      printInfo('Fix: Set CREDITCOIN_TREASURY_PRIVATE_KEY in your .env file.');
    }
    
    if (failedTests.some(t => t.name === 'Private Key Address Match')) {
      printInfo('Fix: Ensure the private key corresponds to the configured treasury address.');
    }
    
    console.log();
  }
}

// Run tests
main().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
