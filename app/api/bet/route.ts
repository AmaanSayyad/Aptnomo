/**
 * API Route: APT Bet Management
 * POST /api/bet
 * 
 * Task: 7.1 Update app/api/bet/route.ts to handle APT bets
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.6
 * 
 * Handles both bet placement and settlement for APT bets:
 * - Bet placement: Deducts APT from house balance
 * - Bet settlement: Credits APT payout for winning bets
 * - Records all bets in bet_history with network='APT', asset='APT'
 * - Creates audit log entries for bet_debit and bet_credit operations
 * - Uses 8 decimal precision for all APT amounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { updateHouseBalance } from '@/lib/ctc/database';
import { AccountAddress } from '@aptos-labs/ts-sdk';

interface BetPlacementRequest {
  action: 'place';
  userAddress: string;
  betAmount: string; // Decimal string (8 decimals)
  asset: string;
  direction: 'UP' | 'DOWN';
  multiplier: string; // Decimal string (4 decimals)
  strikePrice: string; // Decimal string (8 decimals)
  mode?: string;
}

interface BetSettlementRequest {
  action: 'settle';
  betId: string;
  endPrice?: string; // Optional - will fetch from oracle if not provided
  won?: boolean; // Optional - will calculate based on oracle price if not provided
  asset?: string; // Optional - asset symbol for oracle price fetch (e.g., 'BTC', 'ETH')
}

type BetRequest = BetPlacementRequest | BetSettlementRequest;

export async function POST(request: NextRequest) {
  try {
    const body: BetRequest = await request.json();

    // Route to appropriate handler based on action
    if (body.action === 'place') {
      return await handleBetPlacement(body as BetPlacementRequest);
    } else if (body.action === 'settle') {
      return await handleBetSettlement(body as BetSettlementRequest);
    } else {
      return NextResponse.json(
        { error: 'Invalid action. Must be "place" or "settle"' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Unexpected error in POST /api/bet:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}

/**
 * Handle bet placement
 * Deducts APT from house balance and records bet in bet_history
 */
async function handleBetPlacement(body: BetPlacementRequest): Promise<NextResponse> {
  const {
    userAddress,
    betAmount,
    asset = 'APT',
    direction,
    multiplier,
    strikePrice,
    mode = 'creditnomo',
  } = body;

  // Validate required fields
  if (!userAddress || !betAmount || !direction || !multiplier || !strikePrice) {
    return NextResponse.json(
      { error: 'Missing required fields: userAddress, betAmount, direction, multiplier, strikePrice' },
      { status: 400 }
    );
  }

  // Validate address format
  let normalizedAddress: string;
  try {
    normalizedAddress = AccountAddress.from(userAddress).toString();
  } catch {
    return NextResponse.json(
      { error: 'Invalid wallet address format' },
      { status: 400 }
    );
  }

  // Validate bet amount is positive
  const betAmountNum = parseFloat(betAmount);
  if (isNaN(betAmountNum) || betAmountNum <= 0) {
    return NextResponse.json(
      { error: 'Bet amount must be greater than zero' },
      { status: 400 }
    );
  }

  // Validate multiplier
  const multiplierNum = parseFloat(multiplier);
  if (isNaN(multiplierNum) || multiplierNum < 1.0) {
    return NextResponse.json(
      { error: 'Multiplier must be at least 1.0' },
      { status: 400 }
    );
  }

  // Validate direction
  if (direction !== 'UP' && direction !== 'DOWN') {
    return NextResponse.json(
      { error: 'Direction must be "UP" or "DOWN"' },
      { status: 400 }
    );
  }

  try {
    // Deduct bet amount from house balance using stored procedure
    // This handles atomic balance update with row-level locking
    const { data, error } = await supabase.rpc('deduct_balance_for_bet', {
      p_user_address: normalizedAddress.toLowerCase(),
      p_bet_amount: betAmountNum,
      p_currency: 'APT',
    });

    if (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 503;
      let errorMessage = 'Service temporarily unavailable. Please try again.';
      
      // Database connection errors
      if (error.message?.includes('connection') || error.message?.includes('timeout')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Database temporarily unavailable. Please try again later.';
      }
      // Function not found or other database errors
      else if (error.code === '42883' || error.code === 'PGRST202') {
        statusCode = 500; // Internal Server Error
        errorMessage = 'Database configuration error. Please contact support.';
      }
      
      console.error('[Database Error] Failed to deduct balance for bet:', {
        operation: 'bet_placement',
        userAddress: userAddress.toLowerCase(),
        betAmount: betAmountNum,
        statusCode,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
      });
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Parse the JSON result from the stored procedure
    const result = data as { success: boolean; error: string | null; new_balance: number };

    if (!result.success) {
      // Return specific error message for insufficient balance
      if (result.error === 'Insufficient balance') {
        return NextResponse.json(
          { error: 'Insufficient house balance. Please deposit more APT.' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: result.error || 'Bet placement failed' },
        { status: 400 }
      );
    }

    // Generate bet ID
    const betId = `bet_${Date.now()}_${normalizedAddress.slice(-6)}`;

    // Record bet in bet_history with network='APT', asset='APT'
    // Requirements: 7.6
    const { error: betHistoryError } = await supabase
      .from('bet_history')
      .insert({
        id: betId,
        wallet_address: normalizedAddress.toLowerCase(),
        asset: 'APT',
        direction,
        amount: betAmount,
        multiplier,
        strike_price: strikePrice,
        end_price: null,
        payout: null,
        won: null,
        mode,
        network: 'APT',
        resolved_at: null,
        created_at: new Date().toISOString(),
      });

    if (betHistoryError) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Bet placed but recording failed. Please contact support.';
      
      // Database connection errors
      if (betHistoryError.message?.includes('connection') || betHistoryError.message?.includes('timeout')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Database temporarily unavailable. Bet placed but not recorded.';
      }
      
      console.error('[Database Error] Failed to record bet in bet_history:', {
        operation: 'bet_placement',
        betId,
        userAddress: userAddress.toLowerCase(),
        amount: betAmount,
        statusCode,
        errorCode: betHistoryError.code,
        errorMessage: betHistoryError.message,
        errorDetails: betHistoryError.details,
        errorHint: betHistoryError.hint,
      });
      
      // Note: Balance has already been deducted, but bet recording failed
      // This is logged for manual reconciliation
      return NextResponse.json(
        {
          error: errorMessage,
          betId,
          remainingBalance: result.new_balance,
        },
        { status: statusCode }
      );
    }

    // Return success with remaining balance and bet ID
    return NextResponse.json({
      success: true,
      betId,
      remainingBalance: result.new_balance.toString(),
    });
  } catch (error) {
    console.error('Error in bet placement:', error);
    return NextResponse.json(
      { error: 'An error occurred placing your bet' },
      { status: 500 }
    );
  }
}

/**
 * Handle bet settlement
 * Credits APT payout for winning bets and updates bet_history
 * Fetches price from Pyth oracle with retry logic
 * Refunds bet if oracle fails after all retries
 * 
 * Requirements: 9.3, 9.5, 9.6
 */
async function handleBetSettlement(body: BetSettlementRequest): Promise<NextResponse> {
  const { betId, asset } = body;
  let { endPrice, won } = body;

  // Validate required fields
  if (!betId) {
    return NextResponse.json(
      { error: 'Missing required field: betId' },
      { status: 400 }
    );
  }

  try {
    // Fetch bet details from bet_history
    const { data: bet, error: fetchError } = await supabase
      .from('bet_history')
      .select('*')
      .eq('id', betId)
      .single();

    if (fetchError || !bet) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 404;
      let errorMessage = 'Bet not found';
      
      if (fetchError) {
        // Database connection errors
        if (fetchError.message?.includes('connection') || fetchError.message?.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
        // Not found error
        else if (fetchError.code === 'PGRST116') {
          statusCode = 404; // Not Found
          errorMessage = 'Bet not found';
        }
        
        console.error('[Database Error] Failed to fetch bet:', {
          operation: 'bet_settlement',
          betId,
          statusCode,
          errorCode: fetchError.code,
          errorMessage: fetchError.message,
          errorDetails: fetchError.details,
          errorHint: fetchError.hint,
        });
      }
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Check if bet is already settled
    if (bet.resolved_at) {
      return NextResponse.json(
        { error: 'Bet already settled' },
        { status: 400 }
      );
    }

    // If endPrice not provided, fetch from oracle
    // Requirements: 9.3
    if (!endPrice) {
      const assetSymbol = asset || bet.asset || 'BTC';
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Bet Settlement] Fetching oracle price:`, {
        betId,
        asset: assetSymbol,
        operation: 'oracle_price_fetch',
      });
      
      const oraclePrice = await fetchOraclePriceWithRetry(assetSymbol);
      
      // If oracle fails after all retries, refund the bet
      // Requirements: 9.5, 9.6
      if (oraclePrice === null) {
        console.error(`[${timestamp}] [Bet Settlement] Oracle price fetch failed, refunding bet:`, {
          betId,
          asset: assetSymbol,
          userAddress: bet.wallet_address,
          betAmount: bet.amount,
          operation: 'bet_refund',
        });
        
        const refundSuccess = await refundBet(betId, bet.wallet_address, bet.amount);
        
        if (!refundSuccess) {
          return NextResponse.json(
            { error: 'Oracle unavailable and refund failed. Please contact support.' },
            { status: 500 }
          );
        }

        // Update bet_history to mark as refunded
        await supabase
          .from('bet_history')
          .update({
            end_price: null,
            payout: bet.amount, // Refund amount
            won: null,
            resolved_at: new Date().toISOString(),
          })
          .eq('id', betId);

        return NextResponse.json({
          success: true,
          betId,
          refunded: true,
          refundAmount: bet.amount,
          reason: 'Oracle price unavailable after retries',
        });
      }

      endPrice = oraclePrice.toFixed(8);
      
      // Calculate if bet won based on oracle price
      const strikePrice = parseFloat(bet.strike_price);
      if (bet.direction === 'UP') {
        won = oraclePrice > strikePrice;
      } else {
        won = oraclePrice < strikePrice;
      }
      
      console.log(`[${timestamp}] [Bet Settlement] Oracle price fetched successfully:`, {
        betId,
        asset: assetSymbol,
        oraclePrice,
        strikePrice: bet.strike_price,
        direction: bet.direction,
        won,
        operation: 'bet_settlement',
      });
    }

    // Validate end price (after oracle fetch if applicable)
    if (!endPrice) {
      return NextResponse.json(
        { error: 'End price could not be determined' },
        { status: 400 }
      );
    }

    const endPriceNum = parseFloat(endPrice);
    if (isNaN(endPriceNum) || endPriceNum <= 0) {
      return NextResponse.json(
        { error: 'End price must be a positive number' },
        { status: 400 }
      );
    }

    // Validate won is defined
    if (won === undefined) {
      return NextResponse.json(
        { error: 'Missing required field: won (must be calculated or provided)' },
        { status: 400 }
      );
    }

    // Calculate payout for winning bets
    let payout = '0';
    let newBalance: string | null = null;

    if (won) {
      // Calculate payout: betAmount * multiplier
      const betAmount = parseFloat(bet.amount);
      const multiplier = parseFloat(bet.multiplier);
      const payoutNum = betAmount * multiplier;
      payout = payoutNum.toFixed(8);

      // Credit payout to house balance using stored procedure
      // Requirements: 7.3
      const { data, error } = await supabase.rpc('credit_balance_for_payout', {
        p_user_address: bet.wallet_address,
        p_payout_amount: payoutNum,
        p_currency: 'APT',
        p_bet_id: betId,
      });

      if (error) {
        // Determine appropriate HTTP status code based on error type
        let statusCode = 503;
        let errorMessage = 'Service temporarily unavailable. Please try again.';
        
        // Database connection errors
        if (error.message?.includes('connection') || error.message?.includes('timeout')) {
          statusCode = 503; // Service Unavailable
          errorMessage = 'Database temporarily unavailable. Please try again later.';
        }
        // Function not found or other database errors
        else if (error.code === '42883' || error.code === 'PGRST202') {
          statusCode = 500; // Internal Server Error
          errorMessage = 'Database configuration error. Please contact support.';
        }
        
        console.error('[Database Error] Failed to credit payout:', {
          operation: 'bet_settlement',
          betId,
          userAddress: bet.wallet_address,
          payoutAmount: payoutNum,
          statusCode,
          errorCode: error.code,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint,
        });
        
        return NextResponse.json(
          { error: errorMessage },
          { status: statusCode }
        );
      }

      // Parse the JSON result from the stored procedure
      const result = data as { success: boolean; error: string | null; new_balance: number };

      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Payout failed' },
          { status: 400 }
        );
      }

      newBalance = result.new_balance.toString();
    }

    // Update bet_history with settlement details
    const { error: updateError } = await supabase
      .from('bet_history')
      .update({
        end_price: endPrice,
        payout,
        won,
        resolved_at: new Date().toISOString(),
      })
      .eq('id', betId);

    if (updateError) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let errorMessage = 'Failed to update bet history';
      
      // Database connection errors
      if (updateError.message?.includes('connection') || updateError.message?.includes('timeout')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Database temporarily unavailable. Please try again later.';
      }
      
      console.error('[Database Error] Failed to update bet_history:', {
        operation: 'bet_settlement',
        betId,
        statusCode,
        errorCode: updateError.code,
        errorMessage: updateError.message,
        errorDetails: updateError.details,
        errorHint: updateError.hint,
      });
      
      return NextResponse.json(
        { error: errorMessage },
        { status: statusCode }
      );
    }

    // Return success with settlement details
    return NextResponse.json({
      success: true,
      betId,
      won,
      payout,
      newBalance,
    });
  } catch (error) {
    console.error('Error in bet settlement:', error);
    return NextResponse.json(
      { error: 'An error occurred settling your bet' },
      { status: 500 }
    );
  }
}

/**
 * Fetch price from Pyth oracle with retry logic
 * Retries up to 3 times with 1 second delay between attempts
 * 
 * @param asset - Asset symbol (e.g., 'BTC', 'ETH')
 * @returns Price data or null if all retries fail
 * 
 * Requirements: 9.3, 9.4
 */
async function fetchOraclePriceWithRetry(
  asset: string,
  maxRetries: number = 3,
  delayMs: number = 1000
): Promise<number | null> {
  const { fetchPrice, PRICE_FEED_IDS } = await import('@/lib/utils/priceFeed');
  
  // Validate asset is supported
  if (!(asset in PRICE_FEED_IDS)) {
    console.error(`Unsupported asset: ${asset}`);
    return null;
  }

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    const timestamp = new Date().toISOString();
    try {
      console.log(`[${timestamp}] [Oracle] Fetching price:`, {
        asset,
        attempt,
        maxRetries,
        operation: 'oracle_price_fetch',
      });
      
      const priceData = await fetchPrice(asset as any);
      
      if (priceData && priceData.price > 0) {
        console.log(`[${timestamp}] [Oracle] Price fetched successfully:`, {
          asset,
          price: priceData.price,
          attempt,
          operation: 'oracle_price_fetch',
        });
        return priceData.price;
      }
      
      console.warn(`[${timestamp}] [Oracle] Invalid price data received:`, {
        asset,
        attempt,
        priceData,
        operation: 'oracle_price_fetch',
      });
    } catch (error) {
      const timestamp = new Date().toISOString();
      console.error(`[${timestamp}] [Oracle] Error fetching price:`, {
        asset,
        attempt,
        maxRetries,
        errorType: error instanceof Error ? error.constructor.name : 'Unknown',
        errorMessage: error instanceof Error ? error.message : String(error),
        operation: 'oracle_price_fetch',
      });
    }

    // Wait before next retry (except on last attempt)
    if (attempt < maxRetries) {
      const timestamp = new Date().toISOString();
      console.log(`[${timestamp}] [Oracle] Waiting before retry:`, {
        asset,
        delayMs,
        nextAttempt: attempt + 1,
        operation: 'oracle_price_fetch',
      });
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] [Oracle] Failed to fetch price after all retries:`, {
    asset,
    maxRetries,
    operation: 'oracle_price_fetch',
  });
  return null;
}

/**
 * Refund bet amount to user's house balance
 * Creates audit log entry with operation='refund'
 * 
 * @param betId - Bet ID
 * @param userAddress - User's wallet address
 * @param betAmount - Bet amount to refund
 * @returns Success status
 * 
 * Requirements: 9.5, 9.6
 */
async function refundBet(
  betId: string,
  userAddress: string,
  betAmount: string
): Promise<boolean> {
  const timestamp = new Date().toISOString();
  try {
    const betAmountNum = parseFloat(betAmount);
    
    // Credit bet amount back to house balance
    const { data, error } = await supabase.rpc('credit_balance_for_refund', {
      p_user_address: userAddress,
      p_refund_amount: betAmountNum,
      p_currency: 'APT',
      p_bet_id: betId,
    });

    if (error) {
      // Determine appropriate HTTP status code based on error type
      let statusCode = 503;
      let errorMessage = 'Service temporarily unavailable';
      
      // Database connection errors
      if (error.message?.includes('connection') || error.message?.includes('timeout')) {
        statusCode = 503; // Service Unavailable
        errorMessage = 'Database temporarily unavailable';
      }
      // Function not found - use fallback method
      else if (error.code === '42883' || error.code === 'PGRST202') {
        console.warn(`[${timestamp}] [Bet Refund] Stored procedure not found, using fallback:`, {
          betId,
          userAddress,
          betAmount: betAmountNum,
          errorCode: error.code,
          operation: 'bet_refund',
        });
        
        // Fallback: use direct balance update with audit log
        const { updateHouseBalance } = await import('@/lib/ctc/database');
        await updateHouseBalance(userAddress, betAmount, 'refund');
        
        console.log(`[${timestamp}] [Bet Refund] Refund successful (fallback method):`, {
          betId,
          userAddress,
          betAmount,
          operation: 'bet_refund',
        });
        return true;
      }
      
      console.error(`[${timestamp}] [Database Error] Failed to refund bet:`, {
        betId,
        userAddress,
        betAmount: betAmountNum,
        statusCode,
        errorCode: error.code,
        errorMessage: error.message,
        errorDetails: error.details,
        errorHint: error.hint,
        operation: 'bet_refund',
      });
      
      // Fallback: use direct balance update with audit log
      const { updateHouseBalance } = await import('@/lib/ctc/database');
      await updateHouseBalance(userAddress, betAmount, 'refund');
      
      console.log(`[${timestamp}] [Bet Refund] Refund successful (fallback method):`, {
        betId,
        userAddress,
        betAmount,
        operation: 'bet_refund',
      });
      return true;
    }

    // Parse the JSON result from the stored procedure
    const result = data as { success: boolean; error: string | null; new_balance: number };

    if (!result.success) {
      console.error(`[${timestamp}] [Bet Refund] Refund failed:`, {
        betId,
        userAddress,
        betAmount,
        error: result.error,
        operation: 'bet_refund',
      });
      return false;
    }

    console.log(`[${timestamp}] [Bet Refund] Refund successful:`, {
      betId,
      userAddress,
      betAmount,
      newBalance: result.new_balance,
      operation: 'bet_refund',
    });
    return true;
  } catch (error) {
    console.error(`[${timestamp}] [Bet Refund] Unexpected error:`, {
      betId,
      userAddress,
      betAmount,
      errorType: error instanceof Error ? error.constructor.name : 'Unknown',
      errorMessage: error instanceof Error ? error.message : String(error),
      operation: 'bet_refund',
    });
    return false;
  }
}
