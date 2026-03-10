/**
 * GET /api/balance/[address] endpoint
 * 
 * Task: 4.1 Create GET /api/balance/[address] endpoint
 * Requirements: 2.3
 * 
 * Returns the current house balance for a user address.
 * Handles user not found by returning 0 balance.
 * Includes error handling for database errors.
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { ethers } from 'ethers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  try {
    // Await params in Next.js 15+
    const { address } = await params;

    const { searchParams } = new URL(request.url);
    const currency = searchParams.get('currency') || 'CTC';

    // Validate CTC (EVM) address only
    if (!ethers.isAddress(address)) {
      return NextResponse.json(
        { error: 'Invalid CTC (EVM) wallet address' },
        { status: 400 }
      );
    }

    // Query user_balances table with lowercase address for consistency
    const { data, error } = await supabaseServer
      .from('user_balances')
      .select('balance, updated_at')
      .eq('user_address', address.toLowerCase())
      .eq('currency', currency)
      .single();

    // Handle database errors
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({
          balance: 0,
          updatedAt: null,
          tier: 'free'
        });
      }

      console.error('Database error fetching balance:', error);
      return NextResponse.json(
        { error: 'Service temporarily unavailable. Please try again.' },
        { status: 503 }
      );
    }

    // Try to fetch user_tier separately to avoid crashing if column doesn't exist
    let userTier = 'free';
    try {
      const { data: tierData } = await supabaseServer
        .from('user_balances')
        .select('user_tier')
        .eq('user_address', address.toLowerCase())
        .eq('currency', currency)
        .single();

      if (tierData && tierData.user_tier) {
        userTier = tierData.user_tier;
      }
    } catch (e) {
      // Ignore error if column doesn't exist
      console.warn('Could not fetch user_tier, defaulting to free:', e);
    }

    // Return balance and updated_at timestamp
    return NextResponse.json({
      balance: parseFloat(data.balance),
      updatedAt: data.updated_at,
      tier: userTier
    });
  } catch (error) {
    // Handle unexpected errors
    console.error('Unexpected error in GET /api/balance/[address]:', error);
    return NextResponse.json(
      { error: 'An error occurred processing your request' },
      { status: 500 }
    );
  }
}
