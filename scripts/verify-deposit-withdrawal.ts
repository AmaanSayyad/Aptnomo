/**
 * Verification script for CTC deposit and withdrawal.
 * Ensures CTC config, components, and env are present.
 */

import * as fs from 'fs';
import * as path from 'path';

const results: { name: string; passed: boolean; message: string }[] = [];

console.log('=== CTC Deposit & Withdrawal Verification ===\n');

// CTC config and client
const ctcFiles = ['lib/ctc/config.ts', 'lib/ctc/client.ts', 'lib/ctc/backend-client.ts'];
for (const file of ctcFiles) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  results.push({
    name: `${file} exists`,
    passed: exists,
    message: exists ? '✓' : '✗ Not found',
  });
}

// UI components
const uiFiles = ['components/balance/DepositModal.tsx', 'components/balance/WithdrawModal.tsx', 'components/balance/BalanceDisplay.tsx'];
for (const file of uiFiles) {
  const exists = fs.existsSync(path.join(process.cwd(), file));
  results.push({ name: `${file} exists`, passed: exists, message: exists ? '✓' : '✗ Not found' });
}

// DepositModal uses CTC (getCTCConfig / wagmi / privy)
const depositPath = path.join(process.cwd(), 'components/balance/DepositModal.tsx');
if (fs.existsSync(depositPath)) {
  const content = fs.readFileSync(depositPath, 'utf-8');
  results.push({
    name: 'DepositModal uses CTC (getCTCConfig or wagmi)',
    passed: content.includes('getCTCConfig') || content.includes('wagmi'),
    message: content.includes('getCTCConfig') ? '✓ CTC deposit' : '✗ Missing CTC integration',
  });
}

// Withdraw API uses CTC backend
const withdrawRoutePath = path.join(process.cwd(), 'app/api/balance/withdraw/route.ts');
if (fs.existsSync(withdrawRoutePath)) {
  const content = fs.readFileSync(withdrawRoutePath, 'utf-8');
  results.push({
    name: 'Withdraw API uses transferCTCFromTreasury',
    passed: content.includes('transferCTCFromTreasury'),
    message: content.includes('transferCTCFromTreasury') ? '✓' : '✗ Missing',
  });
}

// .env.example has CTC vars
const envExamplePath = path.join(process.cwd(), '.env.example');
if (fs.existsSync(envExamplePath)) {
  const content = fs.readFileSync(envExamplePath, 'utf-8');
  const hasTreasury = content.includes('CREDITCOIN_TREASURY_ADDRESS');
  const hasSupabase = content.includes('NEXT_PUBLIC_SUPABASE');
  results.push({
    name: '.env.example has CTC treasury and Supabase',
    passed: hasTreasury && hasSupabase,
    message: hasTreasury && hasSupabase ? '✓' : '✗ Missing vars',
  });
}

// Print
let passed = 0;
results.forEach((r) => {
  if (r.passed) passed++;
  console.log(`${r.passed ? '✓' : '✗'} ${r.name}: ${r.message}`);
});
console.log(`\n${passed}/${results.length} checks passed.`);
process.exit(passed === results.length ? 0 : 1);
