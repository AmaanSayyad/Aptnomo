
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testInsert() {
    const testBet = {
        id: 'test-bet-small-' + Date.now(),
        wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
        asset: 'APT',
        direction: 'UP',
        amount: 1,
        multiplier: 1.9,
        strike_price: 1.0,
        end_price: 1.1,
        payout: 1.9,
        won: true,
        mode: 'box',
        network: 'APT',
        resolved_at: new Date().toISOString()
    };

    console.log('Inserting small test bet...');
    const { data, error } = await supabase.from('bet_history').insert(testBet);
    
    if (error) {
        console.error('Insert Error:', error);
    } else {
        console.log('Insert Success!');
    }

    // Check if it's there
    const { count } = await supabase.from('bet_history').select('*', { count: 'exact', head: true });
    console.log('Total Bets now:', count);
}

testInsert();
