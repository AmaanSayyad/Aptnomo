
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkData() {
    console.log('Checking bet_history...');
    const { data, error } = await supabase.from('bet_history').select('*').limit(5);
    if (error) {
        console.error('Error fetching bet_history:', error);
    } else {
        console.log('Recent Bets (5):', data);
    }

    console.log('Checking user_profiles...');
    const { data: profiles, error: pError } = await supabase.from('user_profiles').select('*').limit(5);
    if (pError) {
        console.error('Profile Error:', pError);
    } else {
        console.log('Profiles (5):', profiles);
    }

    // Check count
    const { count, error: cError } = await supabase.from('bet_history').select('*', { count: 'exact', head: true });
    if (cError) {
        console.error('Count Error:', cError);
    } else {
        console.log('Total Bets in DB:', count);
    }
}

checkData();
