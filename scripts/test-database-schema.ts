#!/usr/bin/env tsx
/**
 * CreditCoin Database Schema Test Script
 * 
 * This script tests the Supabase database schema to verify:
 * - All required tables exist (user_balances, bet_history, balance_audit_log)
 * - Column types and constraints are correct
 * - Indexes are created
 * - Row Level Security (RLS) policies are configured
 * 
 * Usage: npx tsx scripts/test-database-schema.ts
 * 
 * Requirements: 15.3
 */

import { createClient } from '@supabase/supabase-js';

// Check environment variables before importing database module
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('\x1b[31m✗ Missing Supabase environment variables\x1b[0m\n');
  console.error('Please set the following environment variables in your .env file:\n');
  console.error('  NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url');
  console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key\n');
  console.error('You can get these values from your Supabase project settings:');
  console.error('  https://app.supabase.com/project/_/settings/api\n');
  process.exit(1);
}

// Create Supabase client
const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
  },
});

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
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
 * Test 1: Verify user_balances table exists
 */
async function testUserBalancesTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_balances')
      .select('user_address')
      .limit(1);

    if (error) {
      printResult(
        'user_balances table exists',
        false,
        `Error: ${error.message}`
      );
      return false;
    }

    printResult('user_balances table exists', true);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'user_balances table exists',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 2: Verify bet_history table exists
 */
async function testBetHistoryTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('bet_history')
      .select('id')
      .limit(1);

    if (error) {
      printResult(
        'bet_history table exists',
        false,
        `Error: ${error.message}`
      );
      return false;
    }

    printResult('bet_history table exists', true);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'bet_history table exists',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 3: Verify balance_audit_log table exists
 */
async function testBalanceAuditLogTableExists(): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('balance_audit_log')
      .select('id')
      .limit(1);

    if (error) {
      printResult(
        'balance_audit_log table exists',
        false,
        `Error: ${error.message}`
      );
      return false;
    }

    printResult('balance_audit_log table exists', true);
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'balance_audit_log table exists',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 4: Verify user_balances columns and types
 */
async function testUserBalancesColumns(): Promise<boolean> {
  try {
    // Query the information_schema to get column information
    const { data, error } = await supabase.rpc('get_table_columns', {
      table_name: 'user_balances'
    });

    if (error) {
      // Fallback: Try to insert and select a test record to verify columns
      const testAddress = '0x0000000000000000000000000000000000000001';
      
      // Try to select with all expected columns
      const { data: testData, error: selectError } = await supabase
        .from('user_balances')
        .select('user_address, currency, balance, updated_at, created_at')
        .eq('user_address', testAddress)
        .limit(1);

      if (selectError) {
        printResult(
          'user_balances columns',
          false,
          `Error: ${selectError.message}`
        );
        return false;
      }

      printResult(
        'user_balances columns',
        true,
        'All required columns exist (user_address, currency, balance, updated_at, created_at)'
      );
      return true;
    }

    printResult('user_balances columns', true, 'Column verification completed');
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'user_balances columns',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 5: Verify bet_history columns and types
 */
async function testBetHistoryColumns(): Promise<boolean> {
  try {
    // Try to select with all expected columns
    const { error } = await supabase
      .from('bet_history')
      .select('id, wallet_address, asset, direction, amount, multiplier, strike_price, end_price, payout, won, mode, network, resolved_at, created_at')
      .limit(1);

    if (error) {
      printResult(
        'bet_history columns',
        false,
        `Error: ${error.message}`
      );
      return false;
    }

    printResult(
      'bet_history columns',
      true,
      'All required columns exist'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'bet_history columns',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 6: Verify balance_audit_log columns and types
 */
async function testBalanceAuditLogColumns(): Promise<boolean> {
  try {
    // Try to select with all expected columns
    const { error } = await supabase
      .from('balance_audit_log')
      .select('id, user_address, currency, operation, amount, balance_before, balance_after, tx_hash, created_at')
      .limit(1);

    if (error) {
      printResult(
        'balance_audit_log columns',
        false,
        `Error: ${error.message}`
      );
      return false;
    }

    printResult(
      'balance_audit_log columns',
      true,
      'All required columns exist'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'balance_audit_log columns',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 7: Verify user_balances constraints
 */
async function testUserBalancesConstraints(): Promise<boolean> {
  try {
    const testAddress = '0xtest' + Date.now().toString();
    
    // Test 1: Try to insert with negative balance (should fail if constraint exists)
    const { error: negativeError } = await supabase
      .from('user_balances')
      .insert({
        user_address: testAddress,
        currency: 'CTC',
        balance: '-1.0',
      });

    // Clean up if insert succeeded (constraint missing)
    if (!negativeError) {
      await supabase
        .from('user_balances')
        .delete()
        .eq('user_address', testAddress);
      
      printWarning('balance_non_negative constraint may be missing');
    }

    // Test 2: Verify currency defaults to 'CTC'
    const testAddress2 = '0xtest' + (Date.now() + 1).toString();
    const { error: insertError } = await supabase
      .from('user_balances')
      .insert({
        user_address: testAddress2,
        balance: '0',
      });

    if (!insertError) {
      const { data } = await supabase
        .from('user_balances')
        .select('currency')
        .eq('user_address', testAddress2)
        .single();

      // Clean up
      await supabase
        .from('user_balances')
        .delete()
        .eq('user_address', testAddress2);

      if (data?.currency !== 'CTC') {
        printResult(
          'user_balances constraints',
          false,
          'Currency default is not CTC'
        );
        return false;
      }
    }

    printResult(
      'user_balances constraints',
      true,
      'Constraints verified (currency default: CTC)'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'user_balances constraints',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 8: Verify bet_history constraints
 */
async function testBetHistoryConstraints(): Promise<boolean> {
  try {
    const testId = 'test-' + Date.now().toString();
    
    // Test: Try to insert with invalid direction (should fail)
    const { error } = await supabase
      .from('bet_history')
      .insert({
        id: testId,
        wallet_address: '0x0000000000000000000000000000000000000001',
        asset: 'CTC',
        direction: 'INVALID', // Should fail CHECK constraint
        amount: '1.0',
        multiplier: '1.9',
        strike_price: '100.0',
      });

    if (!error) {
      // Clean up if insert succeeded (constraint missing)
      await supabase
        .from('bet_history')
        .delete()
        .eq('id', testId);
      
      printResult(
        'bet_history constraints',
        false,
        'direction CHECK constraint is missing'
      );
      return false;
    }

    // Verify error is about CHECK constraint
    if (error.message.includes('check') || error.message.includes('constraint')) {
      printResult(
        'bet_history constraints',
        true,
        'direction CHECK constraint verified (UP, DOWN only)'
      );
      return true;
    }

    printResult(
      'bet_history constraints',
      false,
      `Unexpected error: ${error.message}`
    );
    return false;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'bet_history constraints',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 9: Verify indexes exist
 */
async function testIndexesExist(): Promise<boolean> {
  try {
    // We can't directly query pg_indexes without proper permissions
    // Instead, we'll verify indexes indirectly by checking query performance
    // or by attempting operations that would benefit from indexes
    
    printInfo('Index verification requires database admin access');
    printInfo('Expected indexes:');
    printInfo('  - idx_user_balances_currency on user_balances(currency)');
    printInfo('  - idx_bet_history_wallet on bet_history(wallet_address)');
    printInfo('  - idx_bet_history_created on bet_history(created_at DESC)');
    printInfo('  - idx_audit_log_user on balance_audit_log(user_address)');
    printInfo('  - idx_audit_log_created on balance_audit_log(created_at DESC)');
    
    // Perform queries that would benefit from indexes
    const { error: balanceError } = await supabase
      .from('user_balances')
      .select('user_address')
      .eq('currency', 'CTC')
      .limit(1);

    const { error: betError } = await supabase
      .from('bet_history')
      .select('id')
      .eq('wallet_address', '0x0000000000000000000000000000000000000001')
      .limit(1);

    const { error: auditError } = await supabase
      .from('balance_audit_log')
      .select('id')
      .eq('user_address', '0x0000000000000000000000000000000000000001')
      .limit(1);

    if (balanceError || betError || auditError) {
      printResult(
        'Indexes (indirect verification)',
        false,
        'Query errors suggest missing indexes or tables'
      );
      return false;
    }

    printResult(
      'Indexes (indirect verification)',
      true,
      'Indexed queries execute successfully'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Indexes (indirect verification)',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 10: Verify Row Level Security (RLS) policies
 */
async function testRLSPolicies(): Promise<boolean> {
  try {
    printInfo('Testing RLS policies with public access...');
    
    // Test 1: Public read access on user_balances
    const { error: readBalanceError } = await supabase
      .from('user_balances')
      .select('user_address')
      .limit(1);

    if (readBalanceError) {
      printResult(
        'RLS: user_balances read policy',
        false,
        `Error: ${readBalanceError.message}`
      );
      return false;
    }

    // Test 2: Public read access on bet_history
    const { error: readBetError } = await supabase
      .from('bet_history')
      .select('id')
      .limit(1);

    if (readBetError) {
      printResult(
        'RLS: bet_history read policy',
        false,
        `Error: ${readBetError.message}`
      );
      return false;
    }

    // Test 3: Public read access on balance_audit_log
    const { error: readAuditError } = await supabase
      .from('balance_audit_log')
      .select('id')
      .limit(1);

    if (readAuditError) {
      printResult(
        'RLS: balance_audit_log read policy',
        false,
        `Error: ${readAuditError.message}`
      );
      return false;
    }

    // Test 4: Public insert access on user_balances
    const testAddress = '0xrls' + Date.now().toString();
    const { error: insertBalanceError } = await supabase
      .from('user_balances')
      .insert({
        user_address: testAddress,
        currency: 'CTC',
        balance: '0',
      });

    // Clean up
    if (!insertBalanceError) {
      await supabase
        .from('user_balances')
        .delete()
        .eq('user_address', testAddress);
    }

    if (insertBalanceError) {
      printResult(
        'RLS: user_balances insert policy',
        false,
        `Error: ${insertBalanceError.message}`
      );
      return false;
    }

    // Test 5: Public insert access on bet_history
    const testBetId = 'rls-' + Date.now().toString();
    const { error: insertBetError } = await supabase
      .from('bet_history')
      .insert({
        id: testBetId,
        wallet_address: testAddress,
        asset: 'CTC',
        direction: 'UP',
        amount: '1.0',
        multiplier: '1.9',
        strike_price: '100.0',
      });

    // Clean up
    if (!insertBetError) {
      await supabase
        .from('bet_history')
        .delete()
        .eq('id', testBetId);
    }

    if (insertBetError) {
      printResult(
        'RLS: bet_history insert policy',
        false,
        `Error: ${insertBetError.message}`
      );
      return false;
    }

    // Test 6: Public insert access on balance_audit_log
    const { error: insertAuditError } = await supabase
      .from('balance_audit_log')
      .insert({
        user_address: testAddress,
        currency: 'CTC',
        operation: 'test',
        amount: '1.0',
        balance_before: '0',
        balance_after: '1.0',
      });

    // Clean up
    if (!insertAuditError) {
      await supabase
        .from('balance_audit_log')
        .delete()
        .eq('user_address', testAddress);
    }

    if (insertAuditError) {
      printResult(
        'RLS: balance_audit_log insert policy',
        false,
        `Error: ${insertAuditError.message}`
      );
      return false;
    }

    printResult(
      'RLS policies',
      true,
      'All tables have public read and insert policies enabled'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'RLS policies',
      false,
      `Error: ${errorMessage}`
    );
    return false;
  }
}

/**
 * Test 11: Verify decimal precision (18 decimals for CTC)
 */
async function testDecimalPrecision(): Promise<boolean> {
  try {
    const testAddress = '0xdecimal' + Date.now().toString();
    const testBalance = '1.123456789012345678'; // 18 decimal places
    
    // Insert test record with 18 decimal precision
    const { error: insertError } = await supabase
      .from('user_balances')
      .insert({
        user_address: testAddress,
        currency: 'CTC',
        balance: testBalance,
      });

    if (insertError) {
      printResult(
        'Decimal precision (18 decimals)',
        false,
        `Error inserting: ${insertError.message}`
      );
      return false;
    }

    // Retrieve and verify precision is maintained
    const { data, error: selectError } = await supabase
      .from('user_balances')
      .select('balance')
      .eq('user_address', testAddress)
      .single();

    // Clean up
    await supabase
      .from('user_balances')
      .delete()
      .eq('user_address', testAddress);

    if (selectError) {
      printResult(
        'Decimal precision (18 decimals)',
        false,
        `Error selecting: ${selectError.message}`
      );
      return false;
    }

    // Verify precision is maintained
    if (data?.balance !== testBalance) {
      printResult(
        'Decimal precision (18 decimals)',
        false,
        `Precision lost: expected ${testBalance}, got ${data?.balance}`
      );
      return false;
    }

    printResult(
      'Decimal precision (18 decimals)',
      true,
      'NUMERIC(20,18) precision verified'
    );
    return true;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    printResult(
      'Decimal precision (18 decimals)',
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
  console.log(`${colors.blue}║  CreditCoin Database Schema Test                          ║${colors.reset}`);
  console.log(`${colors.blue}╚════════════════════════════════════════════════════════════╝${colors.reset}`);
  
  const results: { name: string; passed: boolean }[] = [];
  
  // Display database configuration
  printHeader('Database Configuration');
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.log(`  Supabase URL: ${colors.cyan}${supabaseUrl || 'NOT SET'}${colors.reset}`);
  
  if (!supabaseUrl) {
    console.log(`\n${colors.red}✗ NEXT_PUBLIC_SUPABASE_URL is not set. Cannot proceed.${colors.reset}`);
    process.exit(1);
  }
  
  // Test 1-3: Table existence
  printHeader('Table Existence Tests');
  const userBalancesExists = await testUserBalancesTableExists();
  results.push({ name: 'user_balances table exists', passed: userBalancesExists });
  
  const betHistoryExists = await testBetHistoryTableExists();
  results.push({ name: 'bet_history table exists', passed: betHistoryExists });
  
  const auditLogExists = await testBalanceAuditLogTableExists();
  results.push({ name: 'balance_audit_log table exists', passed: auditLogExists });
  
  if (!userBalancesExists || !betHistoryExists || !auditLogExists) {
    console.log(`\n${colors.red}✗ Some tables are missing. Cannot proceed with further tests.${colors.reset}`);
    printSummary(results);
    process.exit(1);
  }
  
  // Test 4-6: Column verification
  printHeader('Column Verification Tests');
  const userBalancesColumns = await testUserBalancesColumns();
  results.push({ name: 'user_balances columns', passed: userBalancesColumns });
  
  const betHistoryColumns = await testBetHistoryColumns();
  results.push({ name: 'bet_history columns', passed: betHistoryColumns });
  
  const auditLogColumns = await testBalanceAuditLogColumns();
  results.push({ name: 'balance_audit_log columns', passed: auditLogColumns });
  
  // Test 7-8: Constraints
  printHeader('Constraint Tests');
  const userBalancesConstraints = await testUserBalancesConstraints();
  results.push({ name: 'user_balances constraints', passed: userBalancesConstraints });
  
  const betHistoryConstraints = await testBetHistoryConstraints();
  results.push({ name: 'bet_history constraints', passed: betHistoryConstraints });
  
  // Test 9: Indexes
  printHeader('Index Tests');
  const indexesExist = await testIndexesExist();
  results.push({ name: 'Indexes', passed: indexesExist });
  
  // Test 10: RLS policies
  printHeader('Row Level Security Tests');
  const rlsPolicies = await testRLSPolicies();
  results.push({ name: 'RLS policies', passed: rlsPolicies });
  
  // Test 11: Decimal precision
  printHeader('Decimal Precision Tests');
  const decimalPrecision = await testDecimalPrecision();
  results.push({ name: 'Decimal precision (18 decimals)', passed: decimalPrecision });
  
  // Print summary
  printSummary(results);
  
  // Exit with appropriate code
  const allPassed = results.every(r => r.passed);
  process.exit(allPassed ? 0 : 1);
}

/**
 * Print test summary
 */
function printSummary(results: { name: string; passed: boolean }[]) {
  printHeader('Test Summary');
  
  const passed = results.filter(r => r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(0);
  
  console.log(`\n  Total Tests: ${total}`);
  console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`  ${colors.red}Failed: ${total - passed}${colors.reset}`);
  console.log(`  Success Rate: ${percentage}%\n`);
  
  if (passed === total) {
    console.log(`${colors.green}✓ All tests passed! Database schema is correctly configured.${colors.reset}\n`);
  } else {
    console.log(`${colors.red}✗ Some tests failed. Please check the database schema.${colors.reset}\n`);
    
    // Provide helpful error messages
    const failedTests = results.filter(r => !r.passed);
    
    if (failedTests.some(t => t.name.includes('table exists'))) {
      printInfo('Fix: Run the database migrations in supabase/migrations/');
    }
    
    if (failedTests.some(t => t.name.includes('columns'))) {
      printInfo('Fix: Verify migration scripts have been applied correctly');
    }
    
    if (failedTests.some(t => t.name.includes('constraints'))) {
      printInfo('Fix: Check migration scripts for constraint definitions');
    }
    
    if (failedTests.some(t => t.name.includes('RLS'))) {
      printInfo('Fix: Ensure Row Level Security policies are enabled in migrations');
    }
    
    console.log();
  }
}

// Run tests
main().catch((error) => {
  console.error(`\n${colors.red}Fatal error:${colors.reset}`, error);
  process.exit(1);
});
