/**
 * Deposit API Endpoint
 * 
 * This endpoint handles user deposit operations by:
 * 1. Validating the deposit request (userAddress, txHash, amount)
 * 2. Verifying the transaction on Aptos mainnet
 * 3. Crediting the user's house balance in Supabase
 * 4. Creating an audit log entry
 * 
 * Error Handling:
 * - All transaction failures are logged with details (no sensitive data)
 * - User-friendly error messages are returned to clients
 * - Appropriate HTTP status codes for different error types
 * 
 * Requirements: 5.3, 5.4, 5.6, 14.2, 14.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccountAddress } from '@aptos-labs/ts-sdk';
import { CreditCoinClient, parseAptToOctas, formatOctasToApt } from '@/lib/ctc/client';
import { updateHouseBalance, getHouseBalance } from '@/lib/ctc/database';
import { creditCoinTestnet } from '@/lib/ctc/config';

/**
 * Sanitize error messages to prevent sensitive data leakage
 */
function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';
  
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();
  
  // Check for sensitive keywords
  const sensitiveKeywords = ['private', 'key', 'secret', 'password', 'mnemonic', 'seed'];
  if (sensitiveKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'An internal error occurred. Please contact support.';
  }
  
  return message;
}

/**
 * Request body interface
 */
interface DepositRequest {
  userAddress: string;
  txHash: string;
  amount: string; // APT amount as string
}

/**
 * Success response interface
 */
interface DepositSuccessResponse {
  success: true;
  newBalance: string;
}

/**
 * Error response interface
 */
interface DepositErrorResponse {
  success: false;
  error: string;
}

type DepositResponse = DepositSuccessResponse | DepositErrorResponse;

/**
 * POST /api/deposit
 * 
 * Process a deposit transaction by verifying it on-chain and crediting the user's house balance.
 */
export async function POST(request: NextRequest): Promise<NextResponse<DepositResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // Parse request body
    const body: DepositRequest = await request.json();
    const { userAddress, txHash, amount } = body;

    // Validate required fields
    if (!userAddress || !txHash || !amount) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Missing required fields`, {
        hasUserAddress: !!userAddress,
        hasTxHash: !!txHash,
        hasAmount: !!amount,
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userAddress, txHash, amount' },
        { status: 400 }
      );
    }

    // Validate user address format
    let normalizedUserAddress: string;
    try {
      normalizedUserAddress = AccountAddress.from(userAddress).toString();
    } catch {
      console.error(`[${timestamp}] [Deposit API] Validation error: Invalid address format`, {
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid user address format' },
        { status: 400 }
      );
    }

    // Validate amount
    let amountBigInt: bigint;
    try {
      amountBigInt = parseAptToOctas(amount);
      if (amountBigInt <= BigInt(0)) {
        console.error(`[${timestamp}] [Deposit API] Validation error: Invalid amount`, {
          amount,
          userAddress,
        });
        return NextResponse.json(
          { success: false, error: 'Deposit amount must be greater than 0' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Amount parsing failed`, {
        amount,
        userAddress,
        error: sanitizeError(error),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    // Validate transaction hash format
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) {
      console.error(`[${timestamp}] [Deposit API] Validation error: Invalid txHash format`, {
        txHash,
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid transaction hash format' },
        { status: 400 }
      );
    }

    console.log(`[${timestamp}] [Deposit API] Processing deposit:`, {
      userAddress,
      txHash,
      amount,
    });

    // Initialize Aptos client
    const client = new CreditCoinClient();

    // Verify transaction on blockchain
    let tx;
    try {
      tx = await client.getTransactionByHash(txHash);
    } catch (error) {
      console.error(`[${timestamp}] [Deposit API] Transaction verification failed:`, {
        txHash,
        userAddress,
        amount,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });
      return NextResponse.json(
        { success: false, error: 'Failed to verify transaction on blockchain. Please try again.' },
        { status: 400 }
      );
    }

    // Check transaction type and status
    if (tx?.type && tx.type !== 'user_transaction') {
      console.error(`[${timestamp}] [Deposit API] Unsupported transaction type:`, {
        txHash,
        userAddress,
        type: tx.type,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction is not a user transaction' },
        { status: 400 }
      );
    }

    if (!tx?.success) {
      console.error(`[${timestamp}] [Deposit API] Transaction failed on blockchain:`, {
        txHash,
        userAddress,
        amount,
        version: tx?.version,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction failed on blockchain' },
        { status: 400 }
      );
    }

    const treasuryAddress = AccountAddress.from(creditCoinTestnet.treasuryAddress).toString();
    const payload = tx?.payload || {};
    const fn = payload?.function;
    const typeArgs = payload?.type_arguments || [];
    const args = Array.isArray(payload?.arguments) ? payload.arguments : [];
    let recipient = '';
    if (args[0]) {
      try {
        recipient = AccountAddress.from(args[0]).toString();
      } catch {
        recipient = '';
      }
    }
    const onChainAmount = args[1] ? BigInt(args[1]) : 0n;

    const isAptosAccountTransfer = fn === '0x1::aptos_account::transfer';
    const isCoinTransfer =
      fn === '0x1::coin::transfer' &&
      Array.isArray(typeArgs) &&
      (typeArgs[0] === '0x1::aptos_coin::AptosCoin');

    if (!isAptosAccountTransfer && !isCoinTransfer) {
      console.error(`[${timestamp}] [Deposit API] Unsupported transaction payload:`, {
        txHash,
        userAddress,
        function: fn,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction is not an APT transfer' },
        { status: 400 }
      );
    }

    // Verify transaction recipient is treasury address
    if (recipient !== treasuryAddress) {
      console.error(`[${timestamp}] [Deposit API] Transaction recipient mismatch:`, {
        txHash,
        expected: treasuryAddress,
        actual: recipient,
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction recipient is not the treasury address' },
        { status: 400 }
      );
    }

    // Verify transaction amount matches
    if (onChainAmount !== amountBigInt) {
      console.error(`[${timestamp}] [Deposit API] Transaction amount mismatch:`, {
        txHash,
        expected: amount,
        actual: formatOctasToApt(onChainAmount),
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction amount does not match deposit amount' },
        { status: 400 }
      );
    }

    // Verify transaction sender is the user
    const sender = AccountAddress.from(tx?.sender || '').toString();
    if (sender !== normalizedUserAddress) {
      console.error(`[${timestamp}] [Deposit API] Transaction sender mismatch:`, {
        txHash,
        expected: normalizedUserAddress,
        actual: sender,
      });
      return NextResponse.json(
        { success: false, error: 'Transaction sender does not match user address' },
        { status: 400 }
      );
    }

    // Credit user's house balance
    try {
      const newBalance = await updateHouseBalance(
        userAddress,
        amount, // Positive amount to add
        'deposit',
        txHash
      );

      console.log(`[${timestamp}] [Deposit API] Deposit successful:`, {
        userAddress,
        txHash,
        amount,
        newBalance,
      });

      return NextResponse.json({
        success: true,
        newBalance,
      });
    } catch (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Failed to update house balance. Please contact support.';
      
      if (error instanceof Error) {
        // Database connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
        // Constraint violations or validation errors
        else if (error.message.includes('constraint') || error.message.includes('validation')) {
          statusCode = 400; // Bad Request
          errorMessage = 'Invalid data format. Please check your request.';
        }
      }
      
      console.error(`[${timestamp}] [Database Error] Failed to update house balance:`, {
        operation: 'deposit',
        txHash,
        userAddress,
        amount,
        statusCode,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }
  } catch (error) {
    console.error(`[${timestamp}] [Deposit API] Unexpected error:`, {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: sanitizeError(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
