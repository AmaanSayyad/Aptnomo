/**
 * Server-side Supabase Client
 * 
 * This module provides a Supabase client with administrative privileges
 * using the SERVICE_ROLE_KEY. It should ONLY be used in server-side contexts
 * like API routes and Server Components.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    // We don't throw here to avoid breaking the build if env vars are missing
    // but we should log it during runtime if someone tries to use it
    console.error('ERROR: Missing Supabase server-side environment variables');
}

export const supabaseServer = createClient(
    supabaseUrl || '',
    supabaseServiceKey || '',
    {
        auth: {
            persistSession: false,
        },
    }
);
