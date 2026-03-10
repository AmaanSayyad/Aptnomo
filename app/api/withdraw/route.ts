/**
 * Withdraw API Endpoint
 * 
 * This endpoint handles user withdrawal operations by:
 * 1. Validating the withdrawal request (userAddress, amount)
 * 2. Checking user's house balance is sufficient
 * 3. Processing withdrawal via TreasuryClient.processWithdrawal()
 * 4. Debiting house balance with transaction hash
 * 5. Creating audit log entry with operation='withdraw' and txHash
 * 
 * Error Handling:
 * - All transaction failures are logged with details (no sensitive data)
 * - User-friendly error messages are returned to clients
 * - Appropriate HTTP status codes for different error types
 * 
 * Requirements: 6.2, 6.3, 6.4, 6.5, 6.6, 14.2, 14.5
 */

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';
import { getTreasuryClient } from '@/lib/ctc/backend-client';
import { updateHouseBalance, getHouseBalance } from '@/lib/ctc/database';

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
interface WithdrawRequest {
  userAddress: string;
  amount: string; // CTC amount as string
}

/**
 * Success response interface
 */
interface WithdrawSuccessResponse {
  success: true;
  txHash: string;
  newBalance: string;
}

/**
 * Error response interface
 */
interface WithdrawErrorResponse {
  success: false;
  error: string;
}

type WithdrawResponse = WithdrawSuccessResponse | WithdrawErrorResponse;

/**
 * POST /api/withdraw
 * 
 * Process a withdrawal request by debiting the user's house balance and
 * transferring CTC from treasury to user wallet.
 */
export async function POST(request: NextRequest): Promise<NextResponse<WithdrawResponse>> {
  const timestamp = new Date().toISOString();

  try {
    // Parse request body
    const body: WithdrawRequest = await request.json();
    const { userAddress, amount } = body;

    // Validate required fields
    if (!userAddress || !amount) {
      console.error(`[${timestamp}] [Withdraw API] Validation error: Missing required fields`, {
        hasUserAddress: !!userAddress,
        hasAmount: !!amount,
      });
      return NextResponse.json(
        { success: false, error: 'Missing required fields: userAddress, amount' },
        { status: 400 }
      );
    }

    // Validate user address format
    if (!ethers.isAddress(userAddress)) {
      console.error(`[${timestamp}] [Withdraw API] Validation error: Invalid address format`, {
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
      amountBigInt = ethers.parseUnits(amount, 18);
      if (amountBigInt <= BigInt(0)) {
        console.error(`[${timestamp}] [Withdraw API] Validation error: Invalid amount`, {
          amount,
          userAddress,
        });
        return NextResponse.json(
          { success: false, error: 'Withdrawal amount must be greater than 0' },
          { status: 400 }
        );
      }
    } catch (error) {
      console.error(`[${timestamp}] [Withdraw API] Validation error: Amount parsing failed`, {
        amount,
        userAddress,
        error: sanitizeError(error),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid amount format' },
        { status: 400 }
      );
    }

    console.log(`[${timestamp}] [Withdraw API] Processing withdrawal:`, {
      userAddress,
      amount,
    });

    // Check user's house balance is sufficient
    let currentBalance: string;
    try {
      currentBalance = await getHouseBalance(userAddress);
    } catch (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Internal server error. Please try again later.';
      
      if (error instanceof Error) {
        // Database connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
      }
      
      console.error(`[${timestamp}] [Database Error] Failed to get balance:`, {
        operation: 'withdraw',
        userAddress,
        statusCode,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });
      
      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }

    const currentBalanceBigInt = ethers.parseUnits(currentBalance, 18);

    if (currentBalanceBigInt < amountBigInt) {
      console.error(`[${timestamp}] [Withdraw API] Insufficient balance:`, {
        userAddress,
        currentBalance,
        requestedAmount: amount,
        shortfall: ethers.formatUnits(amountBigInt - currentBalanceBigInt, 18),
      });
      return NextResponse.json(
        { success: false, error: 'Insufficient house balance' },
        { status: 400 }
      );
    }

    // Debit house balance optimistically (before processing withdrawal)
    const negativeAmount = `-${amount}`;
    try {
      await updateHouseBalance(
        userAddress,
        negativeAmount,
        'withdraw_pending'
      );
      console.log(`[${timestamp}] [Withdraw API] Balance debited optimistically:`, {
        userAddress,
        amount,
      });
    } catch (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Failed to update house balance';
      
      if (error instanceof Error) {
        // Database connection errors
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
        // Insufficient balance error
        else if (error.message.includes('Insufficient balance')) {
          statusCode = 400; // Bad Request
          errorMessage = 'Insufficient house balance';
        }
      }
      
      console.error(`[${timestamp}] [Database Error] Failed to debit balance:`, {
        operation: 'withdraw',
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

    // Process withdrawal via TreasuryClient
    let txHash: string;
    try {
      const treasuryClient = getTreasuryClient();
      const result = await treasuryClient.processWithdrawal(userAddress, amountBigInt);

      if (!result.success) {
        console.error(`[${timestamp}] [Withdraw API] Withdrawal transaction failed:`, {
          userAddress,
          amount,
          error: result.error,
          txHash: result.txHash,
        });

        // Revert balance debit
        try {
          await updateHouseBalance(
            userAddress,
            amount, // Positive amount to add back
            'withdraw_revert'
          );
          console.log(`[${timestamp}] [Withdraw API] Balance reverted after withdrawal failure:`, {
            userAddress,
            amount,
          });
        } catch (revertError) {
          // CRITICAL: Balance revert failed - user's balance is now incorrect
          console.error(`[${timestamp}] [Withdraw API] CRITICAL: Failed to revert balance after withdrawal failure:`, {
            userAddress,
            amount,
            originalError: result.error,
            revertErrorType: revertError instanceof Error ? revertError.constructor.name : 'Unknown',
            revertErrorMessage: sanitizeError(revertError),
          });
        }

        // Determine appropriate status code based on error
        const statusCode = result.error?.includes('Treasury has insufficient balance') ? 503 : 500;

        return NextResponse.json(
          { success: false, error: result.error || 'Withdrawal transaction failed' },
          { status: statusCode }
        );
      }

      txHash = result.txHash!;
      console.log(`[${timestamp}] [Withdraw API] Withdrawal transaction successful:`, {
        userAddress,
        txHash,
        amount,
      });
    } catch (error) {
      console.error(`[${timestamp}] [Withdraw API] Unexpected withdrawal error:`, {
        userAddress,
        amount,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });

      // Revert balance debit
      try {
        await updateHouseBalance(
          userAddress,
          amount, // Positive amount to add back
          'withdraw_revert'
        );
        console.log(`[${timestamp}] [Withdraw API] Balance reverted after unexpected error:`, {
          userAddress,
          amount,
        });
      } catch (revertError) {
        // CRITICAL: Balance revert failed
        console.error(`[${timestamp}] [Withdraw API] CRITICAL: Failed to revert balance after unexpected error:`, {
          userAddress,
          amount,
          originalErrorType: error instanceof Error ? error.constructor.name : 'Unknown',
          originalErrorMessage: sanitizeError(error),
          revertErrorType: revertError instanceof Error ? revertError.constructor.name : 'Unknown',
          revertErrorMessage: sanitizeError(revertError),
        });
      }

      return NextResponse.json(
        { success: false, error: 'Internal server error during withdrawal. Please try again.' },
        { status: 500 }
      );
    }

    // Update audit log with transaction hash (balance already debited)
    let newBalance: string;
    try {
      newBalance = await updateHouseBalance(
        userAddress,
        negativeAmount,
        'withdraw',
        txHash
      );

      console.log(`[${timestamp}] [Withdraw API] Withdrawal successful:`, {
        userAddress,
        txHash,
        amount,
        newBalance,
      });

      return NextResponse.json({
        success: true,
        txHash,
        newBalance,
      });
    } catch (error) {
      console.error(`[${timestamp}] [Withdraw API] Failed to update audit log:`, {
        userAddress,
        txHash,
        amount,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });
      
      // Withdrawal succeeded but audit log failed - still return success
      // The balance was already debited optimistically
      newBalance = await getHouseBalance(userAddress);
      
      return NextResponse.json({
        success: true,
        txHash,
        newBalance,
      });
    }
  } catch (error) {
    console.error(`[${timestamp}] [Withdraw API] Unexpected error:`, {
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: sanitizeError(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error. Please try again later.' },
      { status: 500 }
    );
  }
}
