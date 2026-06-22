/**
 * Tractor Ledger — Supabase Client
 *
 * Supabase client initialization with AsyncStorage for session persistence.
 * Supports Google Sign-In via signInWithIdToken().
 * Only used when online. All local operations go through SQLite first.
 */

import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return supabaseUrl.length > 0 && supabaseAnonKey.length > 0;
}

// Lazily-created singleton. We must NOT call createClient() at module load:
// supabase-js throws synchronously ("supabaseUrl is required.") when the URL is
// empty, which would crash any module that imports this file (e.g. the login
// screen) — even in Demo Mode, which never needs a backend. Create on first use.
let client: SupabaseClient | null = null;

/**
 * Get the Supabase client. Only call after confirming isSupabaseConfigured();
 * throws a clear error otherwise.
 */
export function getSupabase(): SupabaseClient {
  if (!isSupabaseConfigured()) {
    throw new Error(
      'Supabase is not configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env',
    );
  }
  if (!client) {
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false, // Important for React Native
      },
    });
  }
  return client;
}

/**
 * Check and refresh the Supabase session if it expires within 60 seconds.
 * Call this before making external API requests using the access token.
 */
export async function ensureSessionValid(): Promise<void> {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  if (session?.expires_at && Date.now() / 1000 > session.expires_at - 60) {
    await sb.auth.refreshSession();
  }
}
