/**
 * Tractor Ledger — Google Auth Helper
 *
 * Uses Supabase's signInWithOAuth for Google Sign-In.
 * The flow is:
 *   1. App opens Supabase OAuth URL in browser
 *   2. User signs in with Google
 *   3. Google redirects to Supabase callback: https://eexdcakosmckdmdzjojx.supabase.co/auth/v1/callback
 *   4. Supabase exchanges the code for tokens
 *   5. Supabase redirects to tractorledger://auth/callback with session tokens
 *   6. App receives the session via deep link
 *
 * IMPORTANT: redirectTo in signInWithOAuth must be the SUPABASE callback URL,
 * NOT the app's custom scheme directly. Supabase then redirects to the app
 * using the Redirect URLs configured in Supabase Dashboard → Auth → URL Configuration.
 *
 * Requires a custom dev build (not Expo Go) because of the custom URL scheme.
 */

import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { getSupabase, isSupabaseConfigured } from './supabase';

// Ensure the browser dismisses properly on Android
WebBrowser.maybeCompleteAuthSession();

/**
 * The Supabase project URL for OAuth callback.
 * This is where Google redirects FIRST — Supabase handles the token exchange,
 * then redirects to the app's custom scheme.
 */
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

/**
 * Check if Google auth is configured.
 * Google provider must be enabled in Supabase Dashboard → Auth → Providers.
 */
export function isGoogleAuthConfigured(): boolean {
  return isSupabaseConfigured();
}

/**
 * Get the app's deep link URL that Supabase will redirect to AFTER token exchange.
 * This must be added to Supabase Dashboard → Auth → URL Configuration → Redirect URLs.
 */
function getAppRedirectUrl(): string {
  return Linking.createURL('auth/callback', { scheme: 'tractorledger' });
}

/**
 * Start Google Sign-In via Supabase OAuth.
 *
 * Opens the browser for Google login. After successful auth:
 *   Google → Supabase callback URL → token exchange → redirect to app
 *
 * Returns true if sign-in was initiated, false if cancelled/failed.
 * The actual session is picked up by the Supabase auth listener.
 */
export async function promptGoogleSignIn(): Promise<string | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
  }

  const supabase = getSupabase();
  const appRedirectUrl = getAppRedirectUrl();

  // signInWithOAuth returns a URL that we open in the browser.
  // redirectTo is the Supabase callback — NOT the app scheme.
  // After Supabase processes the OAuth code, it redirects to
  // the app using the Redirect URLs in Supabase Dashboard.
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: appRedirectUrl,
      skipBrowserRedirect: true, // We'll handle opening the browser ourselves
    },
  });

  if (error) {
    console.error('[GoogleAuth] signInWithOAuth error:', error);
    throw error;
  }

  if (!data?.url) {
    console.error('[GoogleAuth] No OAuth URL returned');
    return null;
  }

  // Open the Supabase OAuth URL in an in-app browser
  const result = await WebBrowser.openAuthSessionAsync(
    data.url,
    appRedirectUrl,
  );

  if (result.type === 'success' && result.url) {
    // Extract the session from the redirect URL
    // Supabase appends #access_token=...&refresh_token=... to the redirect
    const url = new URL(result.url);

    // Supabase puts tokens in the fragment (hash)
    const hashParams = new URLSearchParams(url.hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (accessToken && refreshToken) {
      // Set the session in Supabase client
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (sessionError) {
        console.error('[GoogleAuth] setSession error:', sessionError);
        throw sessionError;
      }

      // Return the access token as confirmation
      return accessToken;
    }

    // If no tokens in hash, check query params (some flows use this)
    const code = url.searchParams.get('code');
    if (code) {
      const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        console.error('[GoogleAuth] exchangeCode error:', exchangeError);
        throw exchangeError;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      return sessionData?.session?.access_token || null;
    }

    console.warn('[GoogleAuth] No tokens or code found in redirect URL:', result.url);
    return null;
  }

  // User cancelled or browser closed
  if (result.type === 'cancel' || result.type === 'dismiss') {
    return null;
  }

  return null;
}
