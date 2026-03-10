/**
 * API Route: Save a bet result to Supabase
 * POST /api/bets/save
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const {
            id,
            walletAddress,
            asset,
            direction,
            amount,
            multiplier,
            strikePrice,
            endPrice,
            payout,
            won,
            mode,
            network,
        } = body;

        if (!id || !walletAddress) {
            console.error('Save bet validation failed: Missing id or walletAddress', { id, walletAddress });
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        console.log('Saving bet to Supabase:', { id, walletAddress, amount, won, payout });

        const { error } = await supabaseServer
            .from('bet_history')
            .upsert({
                id,
                wallet_address: walletAddress.toLowerCase(),
                asset: asset || 'APT',
                direction: direction || 'UP',
                amount: parseFloat(amount) || 0,
                multiplier: parseFloat(multiplier) || 1.9,
                strike_price: parseFloat(strikePrice) || 0,
                end_price: parseFloat(endPrice) || 0,
                payout: parseFloat(payout) || 0,
                won: !!won,
                mode: mode || 'creditnomo',
                network: network || 'APT',
                resolved_at: new Date().toISOString(),
            }, { onConflict: 'id' });

        if (error) {
            console.error('Supabase bet save error:', {
                code: error.code,
                message: error.message,
                details: error.details,
                hint: error.hint,
                betId: id
            });
            return NextResponse.json({ 
                error: 'Failed to save bet', 
                code: error.code,
                details: error.message 
            }, { status: 500 });
        }

        console.log('Bet saved successfully:', id);
        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Unexpected error saving bet:', error);
        return NextResponse.json({ 
            error: 'Internal server error', 
            details: error.message 
        }, { status: 500 });
    }
}
