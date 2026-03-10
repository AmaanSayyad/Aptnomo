/**
 * Withdraw API Endpoint
 *
 * This endpoint handles user withdrawal operations by:
 * 1. Validating the withdrawal request (userAddress, amount)
 * 2. Checking user's house balance is sufficient
 * 3. Processing withdrawal via TreasuryClient.processWithdrawal()
 * 4. Debiting house balance with transaction hash
 * 5. Creating audit log entry with operation='withdraw' and txHash
 */

import { NextRequest, NextResponse } from 'next/server';
import { AccountAddress } from '@aptos-labs/ts-sdk';
import { getTreasuryClient } from '@/lib/ctc/backend-client';
import { updateHouseBalance, getHouseBalance } from '@/lib/ctc/database';
import { parseAptToOctas, formatOctasToApt } from '@/lib/ctc/client';

function sanitizeError(error: any): string {
  if (!error) return 'Unknown error';
  const message = error?.message || String(error);
  const lowerMessage = message.toLowerCase();
  const sensitiveKeywords = ['private', 'key', 'secret', 'password', 'mnemonic', 'seed'];
  if (sensitiveKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return 'An internal error occurred. Please contact support.';
  }
  return message;
}

interface WithdrawRequest {
  userAddress: string;
  amount: string; // APT amount as string
}

interface WithdrawSuccessResponse {
  success: true;
  txHash: string;
  newBalance: string;
}

interface WithdrawErrorResponse {
  success: false;
  error: string;
}

type WithdrawResponse = WithdrawSuccessResponse | WithdrawErrorResponse;

export async function POST(request: NextRequest): Promise<NextResponse<WithdrawResponse>> {
  const timestamp = new Date().toISOString();

  try {
    const body: WithdrawRequest = await request.json();
    const { userAddress, amount } = body;

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

    let normalizedUserAddress: string;
    try {
      normalizedUserAddress = AccountAddress.from(userAddress).toString();
    } catch {
      console.error(`[${timestamp}] [Withdraw API] Validation error: Invalid address format`, {
        userAddress,
      });
      return NextResponse.json(
        { success: false, error: 'Invalid user address format' },
        { status: 400 }
      );
    }

    let amountBigInt: bigint;
    try {
      amountBigInt = parseAptToOctas(amount);
      if (amountBigInt <= 0n) {
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
      userAddress: normalizedUserAddress,
      amount,
    });

    let currentBalance: string;
    try {
      currentBalance = await getHouseBalance(normalizedUserAddress);
    } catch (error) {
      let statusCode = 500;
      let errorMessage = 'Internal server error. Please try again later.';
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503;
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
      }

      console.error(`[${timestamp}] [Database Error] Failed to get balance:`, {
        operation: 'withdraw',
        userAddress: normalizedUserAddress,
        statusCode,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status: statusCode }
      );
    }

    const currentBalanceBigInt = parseAptToOctas(currentBalance);

    if (currentBalanceBigInt < amountBigInt) {
      console.error(`[${timestamp}] [Withdraw API] Insufficient balance:`, {
        userAddress: normalizedUserAddress,
        currentBalance,
        requestedAmount: amount,
        shortfall: formatOctasToApt(amountBigInt - currentBalanceBigInt),
      });
      return NextResponse.json(
        { success: false, error: 'Insufficient house balance' },
        { status: 400 }
      );
    }

    const negativeAmount = `-${amount}`;
    try {
      await updateHouseBalance(
        normalizedUserAddress,
        negativeAmount,
        'withdraw_pending'
      );
      console.log(`[${timestamp}] [Withdraw API] Balance debited optimistically:`, {
        userAddress: normalizedUserAddress,
        amount,
      });
    } catch (error) {
      let statusCode = 500;
      let errorMessage = 'Failed to update house balance';
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          statusCode = 503;
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        } else if (error.message.includes('Insufficient balance')) {
          statusCode = 400;
          errorMessage = 'Insufficient house balance';
        }
      }

      console.error(`[${timestamp}] [Database Error] Failed to debit balance:`, {
        operation: 'withdraw',
        userAddress: normalizedUserAddress,
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

    let txHash: string;
    try {
      const treasuryClient = getTreasuryClient();
      const result = await treasuryClient.processWithdrawal(normalizedUserAddress, amountBigInt);

      if (!result.success) {
        console.error(`[${timestamp}] [Withdraw API] Withdrawal transaction failed:`, {
          userAddress: normalizedUserAddress,
          amount,
          error: result.error,
          txHash: result.txHash,
        });

        try {
          await updateHouseBalance(
            normalizedUserAddress,
            amount,
            'withdraw_revert'
          );
          console.log(`[${timestamp}] [Withdraw API] Balance reverted after withdrawal failure:`, {
            userAddress: normalizedUserAddress,
            amount,
          });
        } catch (revertError) {
          console.error(`[${timestamp}] [Withdraw API] CRITICAL: Failed to revert balance after withdrawal failure:`, {
            userAddress: normalizedUserAddress,
            amount,
            originalError: result.error,
            revertErrorType: revertError instanceof Error ? revertError.constructor.name : 'Unknown',
            revertErrorMessage: sanitizeError(revertError),
          });
        }

        const statusCode = result.error?.includes('Treasury has insufficient balance') ? 503 : 500;
        return NextResponse.json(
          { success: false, error: result.error || 'Withdrawal transaction failed' },
          { status: statusCode }
        );
      }

      txHash = result.txHash!;
      console.log(`[${timestamp}] [Withdraw API] Withdrawal transaction successful:`, {
        userAddress: normalizedUserAddress,
        txHash,
        amount,
      });
    } catch (error) {
      console.error(`[${timestamp}] [Withdraw API] Unexpected withdrawal error:`, {
        userAddress: normalizedUserAddress,
        amount,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });

      try {
        await updateHouseBalance(
          normalizedUserAddress,
          amount,
          'withdraw_revert'
        );
        console.log(`[${timestamp}] [Withdraw API] Balance reverted after unexpected error:`, {
          userAddress: normalizedUserAddress,
          amount,
        });
      } catch (revertError) {
        console.error(`[${timestamp}] [Withdraw API] CRITICAL: Failed to revert balance after unexpected error:`, {
          userAddress: normalizedUserAddress,
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

    let newBalance: string;
    try {
      newBalance = await updateHouseBalance(
        normalizedUserAddress,
        negativeAmount,
        'withdraw',
        txHash
      );

      console.log(`[${timestamp}] [Withdraw API] Withdrawal successful:`, {
        userAddress: normalizedUserAddress,
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
        userAddress: normalizedUserAddress,
        txHash,
        amount,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: sanitizeError(error),
      });

      newBalance = await getHouseBalance(normalizedUserAddress);
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
