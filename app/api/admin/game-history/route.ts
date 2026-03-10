import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        const { data: bets, error } = await supabaseServer
            .from('bet_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;

        return NextResponse.json({ bets });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
