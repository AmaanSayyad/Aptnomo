/**
 * Check User Balance Schema
 * 
 * This script checks the user_balances table schema to verify
 * that all required columns exist.
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '✗');
  console.error('NEXT_PUBLIC_SUPABASE_ANON_KEY:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
  console.log('Checking user_balances table schema...\n');

  try {
    // Try to query the table with all expected columns
    const { data, error } = await supabase
      .from('user_balances')
      .select('user_address, currency, balance, status, created_at, updated_at')
      .limit(1);

    if (error) {
      console.error('❌ Error querying user_balances:', error);
      console.error('\nPossible issues:');
      console.error('1. Table does not exist');
      console.error('2. One or more columns are missing');
      console.error('3. Database connection issue');
      return;
    }

    console.log('✅ Successfully queried user_balances table');
    console.log('✅ All required columns exist: user_address, currency, balance, status, created_at, updated_at');
    
    if (data && data.length > 0) {
      console.log('\nSample record:');
      console.log(JSON.stringify(data[0], null, 2));
    } else {
      console.log('\n⚠️  Table is empty (no records found)');
    }

    // Check for the specific user from the screenshot
    const testAddress = '0xcc78505fe8707a1d85229ba0e7177ae26ce0f17d';
    console.log(`\nChecking for user: ${testAddress}`);
    
    const { data: userData, error: userError } = await supabase
      .from('user_balances')
      .select('*')
      .eq('user_address', testAddress.toLowerCase())
      .eq('currency', 'CTC');

    if (userError) {
      console.error('❌ Error querying user:', userError);
    } else if (userData && userData.length > 0) {
      console.log('✅ User found:');
      console.log(JSON.stringify(userData, null, 2));
    } else {
      console.log('❌ User not found in database');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

checkSchema();
