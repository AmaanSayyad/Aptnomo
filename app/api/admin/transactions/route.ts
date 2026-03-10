import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
    try {
        // Fetch recent deposits and withdrawals from audit log
        const { data: transactions, error } = await supabaseServer
            .from('balance_audit_log')
            .select('*')
            .in('operation', ['deposit', 'withdraw'])
            .order('created_at', { ascending: false })
            .limit(50);

        if (error) throw error;

        return NextResponse.json({ transactions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
