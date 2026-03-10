# CreditNomo Test Scripts

This directory contains test scripts for validating the CreditCoin migration implementation.

## Available Scripts

### 1. test-rpc-connectivity.ts
Tests CreditCoin testnet RPC endpoint connectivity and performance.

**Usage:**
```bash
npx tsx scripts/test-rpc-connectivity.ts
```

**Requirements:**
- None (uses default RPC endpoint from config)

**Tests:**
- Network configuration validation
- RPC endpoint reachability
- getBlockNumber() call
- getBalance() call
- Response time performance

---

### 2. test-treasury-wallet.ts
Tests treasury wallet configuration and signing capabilities.

**Usage:**
```bash
npx tsx scripts/test-treasury-wallet.ts
```

**Requirements:**
- `CREDITCOIN_TREASURY_PRIVATE_KEY` (optional, for signing tests)

**Tests:**
- Treasury address validity
- Treasury CTC balance check
- Private key configuration
- Private key matches treasury address
- Transaction signing (dry run - no broadcast)
- TreasuryClient initialization

---

### 3. test-database-schema.ts
Tests Supabase database schema and configuration.

**Usage:**
```bash
npx tsx scripts/test-database-schema.ts
```

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Tests:**
- Table existence (user_balances, bet_history, balance_audit_log)
- Column verification
- Constraints (CHECK, DEFAULT)
- Indexes (indirect verification)
- Row Level Security policies
- Decimal precision (18 decimals)

---

### 4. test-deposit-withdrawal.ts
Tests complete deposit and withdrawal flows end-to-end.

**Usage:**
```bash
npx tsx scripts/test-deposit-withdrawal.ts
```

**Requirements:**
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `CREDITCOIN_TREASURY_PRIVATE_KEY` (optional, for treasury client tests)

**Tests:**
1. **Deposit Flow (Database Simulation)**
   - Creates test user with deposit
   - Verifies balance update
   - Verifies audit log creation
   - Validates audit log values

2. **Withdrawal Flow (Database Simulation)**
   - Creates initial balance
   - Processes withdrawal
   - Verifies balance deduction
   - Verifies audit log creation

3. **Insufficient Balance Error**
   - Attempts withdrawal exceeding balance
   - Verifies error is thrown
   - Verifies balance remains unchanged

4. **Multiple Operations**
   - Performs multiple deposits and withdrawals
   - Verifies balance calculations
   - Verifies audit log sequence

5. **Decimal Precision (18 decimals)**
   - Tests 18 decimal place precision
   - Verifies precision in balance storage
   - Verifies precision in audit logs

6. **Treasury Client Initialization**
   - Initializes treasury client
   - Verifies address matches config
   - Checks treasury balance

7. **Withdrawal Validation**
   - Tests valid withdrawal amounts
   - Tests invalid withdrawal amounts
   - Verifies validation logic

8. **Audit Log Performance**
   - Creates multiple audit log entries
   - Measures query performance
   - Verifies query returns correct results

---

### 5. test-oracle-integration.ts
Tests Pyth Network Hermes oracle integration for price feeds.

**Usage:**
```bash
npx tsx scripts/test-oracle-integration.ts
```

**Requirements:**
- None (uses public Pyth Hermes endpoint)

**Tests:**
- Pyth Hermes endpoint configuration
- Price feed ID validation for all supported assets
- Price data format validation
- Fetch prices for major assets (BTC, ETH, SOL, CTC)
- Asset switching functionality
- Response time performance (5 iterations)
- Retry logic and last price fallback
- CreditCoin compatibility (chain-agnostic oracle)

---

## Setup Instructions

### 1. Configure Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# CreditCoin Testnet Configuration (optional - uses defaults)
NEXT_PUBLIC_CREDITCOIN_TESTNET_RPC=https://rpc.cc3-testnet.creditcoin.network
NEXT_PUBLIC_CREDITCOIN_TESTNET_CHAIN_ID=102031
NEXT_PUBLIC_CREDITCOIN_TESTNET_EXPLORER=https://creditcoin-testnet.blockscout.com

# Treasury Configuration
CREDITCOIN_TREASURY_ADDRESS=0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123
CREDITCOIN_TREASURY_PRIVATE_KEY=your_private_key_here
NEXT_PUBLIC_CREDITCOIN_TREASURY_ADDRESS=0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123

# Supabase Configuration (REQUIRED for database tests)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

### 2. Setup Supabase Database

Before running database tests, ensure your Supabase database has the required schema:

1. Go to your Supabase project: https://app.supabase.com
2. Navigate to SQL Editor
3. Run the migration scripts in order:
   - `supabase/migrations/009_creditcoin_user_balances.sql`
   - `supabase/migrations/010_creditcoin_bet_history.sql`
   - `supabase/migrations/011_creditcoin_balance_audit_log.sql`

### 3. Fund Treasury Wallet (Optional)

For withdrawal tests to work with actual blockchain transactions, fund the treasury wallet with CTC tokens:

1. Get CTC testnet tokens from a faucet
2. Send tokens to: `0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123`

---

## Running All Tests

To run all test scripts in sequence:

```bash
# Test 1: RPC Connectivity
npx tsx scripts/test-rpc-connectivity.ts

# Test 2: Treasury Wallet
npx tsx scripts/test-treasury-wallet.ts

# Test 3: Database Schema
npx tsx scripts/test-database-schema.ts

# Test 4: Deposit & Withdrawal
npx tsx scripts/test-deposit-withdrawal.ts

# Test 5: Oracle Integration
npx tsx scripts/test-oracle-integration.ts
```

---

## Troubleshooting

### Error: Missing Supabase environment variables

**Solution:** Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in your `.env` file.

Get these values from: https://app.supabase.com/project/_/settings/api

### Error: Table does not exist

**Solution:** Run the database migration scripts in your Supabase SQL Editor.

### Error: Treasury has insufficient balance

**Solution:** Fund the treasury wallet with CTC testnet tokens.

### Warning: Treasury balance is 0 CTC

**Solution:** This is expected if you haven't funded the treasury yet. The tests will still pass, but withdrawal operations won't work until the treasury is funded.

---

## Test Output

All test scripts provide colored output:
- ✓ PASS (green) - Test passed successfully
- ✗ FAIL (red) - Test failed
- ⚠ WARNING (yellow) - Non-critical issue
- ℹ INFO (cyan) - Informational message

Each script exits with:
- Exit code 0 - All tests passed
- Exit code 1 - One or more tests failed

---

## Requirements Validation

These test scripts validate the following requirements from the CreditNomo migration spec:

- **Requirement 15.1**: RPC connectivity test
- **Requirement 15.2**: Treasury wallet test
- **Requirement 15.3**: Database schema test
- **Requirement 15.4**: Deposit and withdrawal flow test
- **Requirement 15.5**: Oracle integration test

---

## Notes

- All tests use database simulation (no actual blockchain transactions) except for treasury client initialization
- Test data is automatically cleaned up after each test
- Tests use randomly generated addresses to avoid conflicts
- Decimal precision is tested at 18 decimal places (CTC standard)
- Audit logging is verified for all balance-changing operations
