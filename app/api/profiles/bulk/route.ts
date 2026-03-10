
import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { addresses } = await request.json();

        if (!addresses || !Array.isArray(addresses)) {
            return NextResponse.json({ error: 'Invalid addresses' }, { status: 400 });
        }

        const normalizedAddresses = addresses.map(a => a.toLowerCase());

        const { data, error } = await supabaseServer
            .from('user_profiles')
            .select('user_address, username')
            .in('user_address', normalizedAddresses);

        if (error) {
            console.error('Error fetching bulk profiles:', error);
            return NextResponse.json({ error: 'Failed to fetch profiles' }, { status: 500 });
        }

        return NextResponse.json({ profiles: data || [] });
    } catch (error) {
        console.error('Unexpected error in /api/profiles/bulk:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
