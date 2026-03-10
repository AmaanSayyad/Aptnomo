/**
 * Environment Variable Validation
 * 
 * This module validates required environment variables for CreditCoin integration
 * and logs warnings for missing or invalid configurations.
 */

interface EnvVariable {
  name: string;
  required: boolean;
  description: string;
  serverSideOnly?: boolean;
}

/**
 * Required environment variables for CreditCoin integration
 */
const ENV_VARIABLES: EnvVariable[] = [
  // CreditCoin Network Configuration
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_RPC',
    required: false,
    description: 'CreditCoin testnet RPC endpoint (defaults to https://rpc.cc3-testnet.creditcoin.network)',
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_CHAIN_ID',
    required: false,
    description: 'CreditCoin testnet chain ID (defaults to 102031)',
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_EXPLORER',
    required: false,
    description: 'CreditCoin testnet block explorer URL (defaults to https://creditcoin-testnet.blockscout.com)',
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_CURRENCY',
    required: false,
    description: 'CreditCoin native currency name (defaults to CTC)',
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_CURRENCY_SYMBOL',
    required: false,
    description: 'CreditCoin currency symbol for display (defaults to CTC)',
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TESTNET_CURRENCY_DECIMALS',
    required: false,
    description: 'CreditCoin native token decimals (defaults to 18)',
  },

  // Treasury Configuration
  {
    name: 'CREDITCOIN_TREASURY_ADDRESS',
    required: false,
    description: 'Treasury wallet address for deposits (defaults to 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123)',
    serverSideOnly: true,
  },
  {
    name: 'CREDITCOIN_TREASURY_PRIVATE_KEY',
    required: true,
    description: 'Treasury private key for withdrawals (REQUIRED for withdrawal operations)',
    serverSideOnly: true,
  },
  {
    name: 'NEXT_PUBLIC_CREDITCOIN_TREASURY_ADDRESS',
    required: false,
    description: 'Public treasury address for client-side display (defaults to 0x71197e7a1CA5A2cb2AD82432B924F69B1E3dB123)',
  },

  // Supabase Configuration
  {
    name: 'NEXT_PUBLIC_SUPABASE_URL',
    required: true,
    description: 'Supabase project URL (REQUIRED for database operations)',
  },
  {
    name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    required: true,
    description: 'Supabase anonymous key (REQUIRED for database operations)',
  },

  // Wallet Connection Configuration
  {
    name: 'NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID',
    required: false,
    description: 'WalletConnect project ID (recommended for WalletConnect support)',
  },

  // Privy Configuration (Optional)
  {
    name: 'NEXT_PUBLIC_PRIVY_APP_ID',
    required: false,
    description: 'Privy app ID for social login (optional)',
  },
  {
    name: 'PRIVY_APP_SECRET',
    required: false,
    description: 'Privy app secret for server-side operations (optional)',
    serverSideOnly: true,
  },

  // Application Configuration
  {
    name: 'NEXT_PUBLIC_APP_NAME',
    required: false,
    description: 'Application name displayed in UI (defaults to CreditNomo)',
  },
  {
    name: 'NEXT_PUBLIC_CTC_NETWORK',
    required: false,
    description: 'Network mode: testnet or mainnet (defaults to testnet)',
  },
  {
    name: 'NEXT_PUBLIC_ROUND_DURATION',
    required: false,
    description: 'Default round duration in seconds (defaults to 30)',
  },
  {
    name: 'NEXT_PUBLIC_PRICE_UPDATE_INTERVAL',
    required: false,
    description: 'Price update interval in milliseconds (defaults to 1000)',
  },
  {
    name: 'NEXT_PUBLIC_CHART_TIME_WINDOW',
    required: false,
    description: 'Chart time window in milliseconds (defaults to 300000)',
  },
];

/**
 * Validation result for a single environment variable
 */
interface ValidationResult {
  name: string;
  status: 'ok' | 'missing' | 'warning';
  message?: string;
}

/**
 * Check if code is running on the server side
 */
function isServerSide(): boolean {
  return typeof window === 'undefined';
}

/**
 * Validate a single environment variable
 */
function validateEnvVariable(envVar: EnvVariable): ValidationResult {
  const value = process.env[envVar.name];

  // Skip server-side only variables on client
  if (envVar.serverSideOnly && !isServerSide()) {
    return {
      name: envVar.name,
      status: 'ok',
      message: 'Server-side only (skipped on client)',
    };
  }

  // Check if required variable is missing
  if (envVar.required && !value) {
    return {
      name: envVar.name,
      status: 'missing',
      message: `REQUIRED: ${envVar.description}`,
    };
  }

  // Warn about optional but recommended variables
  if (!envVar.required && !value) {
    return {
      name: envVar.name,
      status: 'warning',
      message: `Optional: ${envVar.description}`,
    };
  }

  return {
    name: envVar.name,
    status: 'ok',
  };
}

/**
 * Validate all environment variables and log warnings
 * 
 * This function checks all required and optional environment variables
 * and logs appropriate warnings for missing configurations.
 * 
 * @returns Object with validation results and counts
 */
export function validateEnvironment(): {
  valid: boolean;
  results: ValidationResult[];
  missingCount: number;
  warningCount: number;
} {
  const results: ValidationResult[] = [];
  let missingCount = 0;
  let warningCount = 0;

  // Validate each environment variable
  for (const envVar of ENV_VARIABLES) {
    const result = validateEnvVariable(envVar);
    results.push(result);

    if (result.status === 'missing') {
      missingCount++;
      console.error(`❌ Missing required environment variable: ${result.name}`);
      console.error(`   ${result.message}`);
    } else if (result.status === 'warning') {
      warningCount++;
      console.warn(`⚠️  Missing optional environment variable: ${result.name}`);
      console.warn(`   ${result.message}`);
    }
  }

  // Log summary
  if (missingCount > 0) {
    console.error(`\n❌ ${missingCount} required environment variable(s) missing`);
    console.error('   Please check .env.example for required configuration\n');
  }

  if (warningCount > 0) {
    console.warn(`\n⚠️  ${warningCount} optional environment variable(s) missing`);
    console.warn('   Application will use default values\n');
  }

  if (missingCount === 0 && warningCount === 0) {
    console.log('✅ All environment variables configured correctly\n');
  }

  return {
    valid: missingCount === 0,
    results,
    missingCount,
    warningCount,
  };
}

/**
 * Validate environment variables on module load (server-side only)
 * 
 * This runs automatically when the module is imported on the server side.
 * On the client side, validation is skipped to avoid exposing server-side variables.
 */
if (isServerSide() && process.env.NODE_ENV !== 'test') {
  console.log('🔍 Validating CreditCoin environment configuration...\n');
  validateEnvironment();
}
