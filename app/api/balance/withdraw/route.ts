import { NextRequest, NextResponse } from 'next/server';
import { AccountAddress } from '@aptos-labs/ts-sdk';
import { supabaseServer } from '@/lib/supabase/server';
import { parseAptToOctas } from '@/lib/ctc/client';

interface WithdrawRequest {
  userAddress: string;
  amount: number;
  currency: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: WithdrawRequest = await request.json();
    const { userAddress, amount, currency = 'APT' } = body;

    console.log('Withdrawal request received:', { userAddress, amount, currency });

    // Validate required fields
    if (!userAddress || amount === undefined || amount === null) {
      return NextResponse.json(
        { error: 'Missing required fields: userAddress, amount' },
        { status: 400 }
      );
    }

    // Validate Aptos address
    let normalizedAddress: string;
    try {
      normalizedAddress = AccountAddress.from(userAddress).toString();
    } catch {
      return NextResponse.json(
        { error: 'Invalid Aptos wallet address' },
        { status: 400 }
      );
    }

    if (amount <= 0) {
      return NextResponse.json(
        { error: 'Withdrawal amount must be greater than zero' },
        { status: 400 }
      );
    }

    // 1. Get house balance from Supabase and validate
    const lookupAddress = normalizedAddress.toLowerCase();
    console.log('Withdrawal: Looking up user balance', { lookupAddress, currency });
    
    // Try to get balance with status, but fallback to just balance if status column doesn't exist
    let { data: userData, error: userError } = await supabaseServer
      .from('user_balances')
      .select('balance, status, user_address, currency')
      .eq('user_address', lookupAddress)
      .eq('currency', currency)
      .single();
    
    // If status column doesn't exist, try without it
    if (userError && userError.code === '42703') {
      console.log('Withdrawal: Status column not found, trying without it...');
      const result = await supabaseServer
        .from('user_balances')
        .select('balance, user_address, currency')
        .eq('user_address', lookupAddress)
        .eq('currency', currency)
        .single();
      
      userData = result.data ? { ...result.data, status: 'active' } : null;
      userError = result.error;
    }
    
    console.log('Withdrawal: Query result', { 
      userData, 
      userError: userError ? { code: userError.code, message: userError.message, details: userError.details } : null,
      hasData: !!userData, 
      hasError: !!userError 
    });

    // Fallback: If not found, try without currency filter (if legacy data exists) 
    // or log more details to help the user.
    if (userError || !userData) {
      console.warn('Withdrawal: Record not found with standard lookup. Trying fallback...', { lookupAddress, currency });

      // Secondary attempt with case-insensitive currency just in case
      const { data: fallbackData } = await supabaseServer
        .from('user_balances')
        .select('balance, status, user_address, currency')
        .eq('user_address', lookupAddress)
        .ilike('currency', currency)
        .limit(1)
        .maybeSingle();

      if (fallbackData) {
        userData = fallbackData;
        userError = null;
      }
    }

    if (userError || !userData) {
      console.error('Withdrawal error: User record not found for', { lookupAddress, currency });
      return NextResponse.json({
        error: `User balance record for ${currency} NOT found in house treasury. Please ensure you have DEPOSITED to the house balance (not just your wallet) before withdrawing.`
      }, { status: 404 });
    }

    if (userData.status === 'frozen') {
      return NextResponse.json({ error: 'Account is frozen. Withdrawals are disabled.' }, { status: 403 });
    }

    if (userData.status === 'banned') {
      return NextResponse.json({ error: 'Account is banned.' }, { status: 403 });
    }

    if (userData.balance < amount) {
      return NextResponse.json({ error: `Insufficient house balance in ${currency}` }, { status: 400 });
    }

    // 2. Apply 2% Treasury Fee (round to 8 decimals to avoid floating-point precision issues)
    const feePercent = 0.02;
    const feeAmount = amount * feePercent;
    const netWithdrawAmount = parseFloat((amount - feeAmount).toFixed(8));

    console.log(`Withdrawal Request: Total=${amount}, Fee=${feeAmount}, Net=${netWithdrawAmount}, Currency=${currency}`);

    // Perform APT transfer from treasury
    let signature: string;
    try {
      const { getTreasuryClient } = await import('@/lib/ctc/backend-client');

      const treasury = getTreasuryClient();
      const amountInWei = parseAptToOctas(netWithdrawAmount.toString());

      const result = await treasury.processWithdrawal(normalizedAddress, amountInWei);

      if (!result.success || !result.txHash) {
        throw new Error(result.error || 'Failed to process blockchain transfer');
      }

      signature = result.txHash;
    } catch (e: any) {
      console.error('Transfer failed:', e);
      const msg = (e?.message || '').toLowerCase();
      if (msg.includes('insufficient funds') || msg.includes('insufficient balance')) {
        return NextResponse.json(
          {
            error:
              'Withdrawal temporarily unavailable. The treasury may need to be topped up. Please try again later or contact support.',
          },
          { status: 503 }
        );
      }
      return NextResponse.json({ error: `Withdrawal failed: ${e.message}` }, { status: 500 });
    }

    // 3. Update Supabase balance using RPC
    // Order: p_user_address, p_withdrawal_amount, p_currency, p_transaction_hash
    const { data, error } = await supabaseServer.rpc('update_balance_for_withdrawal', {
      p_user_address: normalizedAddress.toLowerCase(),
      p_withdrawal_amount: amount,
      p_currency: currency,
      p_transaction_hash: signature,
    });

    if (error) {
      console.error('Database error in withdrawal update:', error);
      // Note: At this point the APT has been sent!
      return NextResponse.json(
        {
          success: true,
          txHash: signature,
          warning: 'APT sent but balance update failed. Please contact support.',
          error: error.message
        },
        { status: 200 }
      );
    }

    const result = data as { success: boolean; error: string | null; new_balance: number };

    return NextResponse.json({
      success: true,
      txHash: signature,
      newBalance: result.new_balance,
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/balance/withdraw:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
