/**
 * API Route: Fetch bet history for a wallet
 * GET /api/bets/history?wallet=0x...&limit=50
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const wallet = searchParams.get('wallet');
        const limit = parseInt(searchParams.get('limit') || '50');

        let query = supabaseServer
            .from('bet_history')
            .select('*')
            .order('resolved_at', { ascending: false })
            .limit(limit);

        if (wallet && wallet !== 'all') {
            query = query.ilike('wallet_address', wallet.toLowerCase());
        }

        const { data, error } = await query;

        if (error) {
            console.error('Supabase fetch error:', error);
            return NextResponse.json({ error: 'Failed to fetch bets' }, { status: 500 });
        }

        return NextResponse.json({ bets: data || [] });
    } catch (error) {
        console.error('Error fetching bet history:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
