/**
 * Environment Variable Validation
 *
 * This module validates required environment variables for Aptos integration
 * and logs warnings for missing or invalid configurations.
 */

interface EnvVariable {
  name: string;
  required: boolean;
  description: string;
  serverSideOnly?: boolean;
}

/**
 * Required environment variables for Aptos integration
 */
const ENV_VARIABLES: EnvVariable[] = [
  // Aptos Network Configuration
  {
    name: 'NEXT_PUBLIC_APTOS_MAINNET_RPC',
    required: false,
    description: 'Aptos mainnet RPC endpoint (defaults to https://fullnode.mainnet.aptoslabs.com/v1)',
  },
  {
    name: 'NEXT_PUBLIC_APTOS_MAINNET_CHAIN_ID',
    required: false,
    description: 'Aptos mainnet chain ID (defaults to 1)',
  },
  {
    name: 'NEXT_PUBLIC_APTOS_MAINNET_EXPLORER',
    required: false,
    description: 'Aptos mainnet block explorer URL (defaults to https://explorer.aptoslabs.com)',
  },
  {
    name: 'NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_SYMBOL',
    required: false,
    description: 'Aptos currency symbol for display (defaults to APT)',
  },
  {
    name: 'NEXT_PUBLIC_APTOS_MAINNET_CURRENCY_DECIMALS',
    required: false,
    description: 'Aptos native token decimals (defaults to 8)',
  },

  // Treasury Configuration
  {
    name: 'APTOS_TREASURY_ADDRESS',
    required: false,
    description: 'Treasury wallet address for deposits',
    serverSideOnly: true,
  },
  {
    name: 'APTOS_TREASURY_PRIVATE_KEY',
    required: true,
    description: 'Treasury private key for withdrawals (REQUIRED for withdrawal operations)',
    serverSideOnly: true,
  },
  {
    name: 'NEXT_PUBLIC_APTOS_TREASURY_ADDRESS',
    required: false,
    description: 'Public treasury address for client-side display',
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

  // Application Configuration
  {
    name: 'NEXT_PUBLIC_APP_NAME',
    required: false,
    description: 'Application name displayed in UI (defaults to Nomo)',
  },
  {
    name: 'NEXT_PUBLIC_APTOS_NETWORK',
    required: false,
    description: 'Network mode: mainnet (defaults to mainnet)',
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
      console.error(`Missing required environment variable: ${result.name}`);
      console.error(`   ${result.message}`);
    } else if (result.status === 'warning') {
      warningCount++;
      console.warn(`Missing optional environment variable: ${result.name}`);
      console.warn(`   ${result.message}`);
    }
  }

  // Log summary
  if (missingCount > 0) {
    console.error(`\n${missingCount} required environment variable(s) missing`);
    console.error('   Please check .env.example for required configuration\n');
  }

  if (warningCount > 0) {
    console.warn(`\n${warningCount} optional environment variable(s) missing`);
    console.warn('   Application will use default values\n');
  }

  if (missingCount === 0 && warningCount === 0) {
    console.log('All environment variables configured correctly\n');
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
  console.log('Validating Aptos environment configuration...\n');
  validateEnvironment();
}
