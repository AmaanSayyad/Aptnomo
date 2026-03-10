/**
 * Apply Status Column Fix
 * 
 * This script adds the missing status column to user_balances table
 */

import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyFix() {
  console.log('Applying status column fix to user_balances table...\n');

  try {
    // Add status column
    const { error: alterError } = await supabase.rpc('exec_sql', {
      sql: `
        -- Add status column if it doesn't exist
        DO $$ 
        BEGIN
            IF NOT EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = 'user_balances' 
                AND column_name = 'status'
            ) THEN
                ALTER TABLE user_balances 
                ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
                
                RAISE NOTICE 'Status column added successfully';
            ELSE
                RAISE NOTICE 'Status column already exists';
            END IF;
        END $$;

        -- Ensure existing rows have a status value
        UPDATE user_balances 
        SET status = 'active' 
        WHERE status IS NULL;

        -- Create index on status for efficient filtering
        CREATE INDEX IF NOT EXISTS idx_user_balances_status ON user_balances(status);
      `
    });

    if (alterError) {
      console.error('❌ Error applying fix:', alterError);
      
      // Try alternative approach using direct SQL
      console.log('\nTrying alternative approach...');
      
      const { error: directError } = await supabase
        .from('user_balances')
        .select('user_address')
        .limit(1);
      
      if (directError) {
        console.error('❌ Cannot connect to database:', directError);
        return;
      }
      
      console.log('⚠️  Database connection works, but cannot execute DDL statements.');
      console.log('Please run the following SQL manually in Supabase SQL Editor:\n');
      console.log('----------------------------------------');
      console.log(`
ALTER TABLE user_balances 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';

UPDATE user_balances 
SET status = 'active' 
WHERE status IS NULL;

CREATE INDEX IF NOT EXISTS idx_user_balances_status ON user_balances(status);

COMMENT ON COLUMN user_balances.status IS 'User account status: active, frozen, or banned';
      `);
      console.log('----------------------------------------\n');
      
      return;
    }

    console.log('✅ Status column fix applied successfully!');
    
    // Verify the fix
    const { data, error } = await supabase
      .from('user_balances')
      .select('user_address, currency, balance, status')
      .limit(1);

    if (error) {
      console.error('❌ Error verifying fix:', error);
    } else {
      console.log('✅ Verification successful - status column is now accessible');
      if (data && data.length > 0) {
        console.log('\nSample record:');
        console.log(JSON.stringify(data[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

applyFix();
