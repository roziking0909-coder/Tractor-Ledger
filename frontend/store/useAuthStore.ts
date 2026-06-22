/**
 * Tractor Ledger — Auth Store
 * Google Sign-In with JWT tokens, demo mode for offline testing.
 * After first Google login, collects phone number separately.
 * 
 * Privacy: On logout, clears all local SQLite data to prevent
 * data leaking to the next user on the same device.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import { apiFetch, isApiConfigured } from '@/lib/api';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { clearAllLocalData } from '@/lib/database';

const AUTH_STORAGE_KEY = '@tractor_ledger/auth';
const LAST_USER_KEY = '@tractor_ledger/last_user_id';

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
  email?: string;
}

interface StoredAuth {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  isDemoMode: boolean;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isDemoMode: boolean;
  isLoading: boolean;
  needsPhoneNumber: boolean;
}

interface AuthActions {
  restoreSession: (db?: SQLiteDatabase) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  setPhoneNumber: (phone: string, db?: SQLiteDatabase) => Promise<void>;
  enterDemoMode: (db: SQLiteDatabase) => Promise<void>;
  setUser: (user: AuthUser) => void;
  logout: (db?: SQLiteDatabase) => Promise<void>;
}

const DEMO_USER: AuthUser = {
  id: 'demo-user',
  phone: '9999999999',
  name: 'Demo Owner',
};

async function saveSession(data: StoredAuth) {
  await AsyncStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(data));
}

async function clearSession() {
  await AsyncStorage.removeItem(AUTH_STORAGE_KEY);
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isDemoMode: false,
  isLoading: true,
  needsPhoneNumber: false,

  restoreSession: async (db?: SQLiteDatabase) => {
    try {
      set({ isLoading: true });
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (raw) {
        const stored: StoredAuth = JSON.parse(raw);
        const needsPhone = !stored.user.phone || stored.user.phone === '';

        // --- User-mismatch guard ---
        // If a different user logged in last time (e.g. app crashed without 
        // clean logout), clear stale SQLite data from previous user.
        if (db && !stored.isDemoMode) {
          try {
            const lastUserId = await AsyncStorage.getItem(LAST_USER_KEY);
            if (lastUserId && lastUserId !== stored.user.id) {
              console.log('[Auth] User mismatch detected — clearing stale local data');
              await clearAllLocalData(db);
            }
            await AsyncStorage.setItem(LAST_USER_KEY, stored.user.id);
          } catch (e) {
            console.warn('[Auth] User-mismatch check failed:', e);
          }
        }

        set({
          user: stored.user,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          isDemoMode: stored.isDemoMode,
          isAuthenticated: true,
          needsPhoneNumber: needsPhone && !stored.isDemoMode,
          isLoading: false,
        });
        return;
      }

      set({ isLoading: false });
    } catch (error) {
      console.error('[useAuthStore] restoreSession error:', error);
      set({ isLoading: false });
    }
  },

  loginWithGoogle: async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
    }

    // After signInWithOAuth + setSession, the session is already in the Supabase client.
    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session || !session.user) {
      throw new Error('Google sign-in failed — no session found');
    }

    const user: AuthUser = {
      id: session.user.id,
      phone: session.user.phone || '',
      name: session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      email: session.user.email || '',
    };

    const stored: StoredAuth = {
      user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      isDemoMode: false,
    };

    await saveSession(stored);
    // Store current user ID for mismatch detection
    await AsyncStorage.setItem(LAST_USER_KEY, user.id);

    const needsPhone = !user.phone || user.phone === '';

    set({
      user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      isAuthenticated: true,
      isDemoMode: false,
      needsPhoneNumber: needsPhone,
      isLoading: false,
    });
  },

  setPhoneNumber: async (phone: string, db?: SQLiteDatabase) => {
    const { user, accessToken, refreshToken, isDemoMode } = get();
    if (!user) return;

    const updatedUser: AuthUser = { ...user, phone };

    // Update local users table if db is available
    if (db) {
      try {
        const exists = await db.getFirstAsync<{ id: string }>(
          'SELECT id FROM users WHERE id = ?',
          [user.id],
        );
        if (exists) {
          await db.runAsync(
            `UPDATE users SET phone = ? WHERE id = ?`,
            [phone, user.id],
          );
        } else {
          await db.runAsync(
            `INSERT INTO users (id, phone, name, sync_status) VALUES (?, ?, ?, 'pending')`,
            [user.id, phone, user.name],
          );
        }
      } catch (error) {
        console.error('[useAuthStore] setPhoneNumber DB error:', error);
      }
    }

    const session: StoredAuth = {
      user: updatedUser,
      accessToken: accessToken || '',
      refreshToken: refreshToken || '',
      isDemoMode,
    };

    await saveSession(session);
    set({ user: updatedUser, needsPhoneNumber: false });
  },

  enterDemoMode: async (db: SQLiteDatabase) => {
    const existing = await db.getFirstAsync<AuthUser>(
      'SELECT id, phone, name FROM users WHERE id = ?',
      [DEMO_USER.id],
    );

    if (!existing) {
      await db.runAsync(
        `INSERT INTO users (id, phone, name, sync_status) VALUES (?, ?, ?, 'synced')`,
        [DEMO_USER.id, DEMO_USER.phone, DEMO_USER.name],
      );
    }

    const session: StoredAuth = {
      user: existing || DEMO_USER,
      accessToken: 'demo-token',
      refreshToken: 'demo-refresh',
      isDemoMode: true,
    };

    await saveSession(session);
    set({
      user: session.user,
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      isAuthenticated: true,
      isDemoMode: true,
      needsPhoneNumber: false,
      isLoading: false,
    });
  },

  setUser: (user: AuthUser) => {
    set({ user });
    const { accessToken, refreshToken, isDemoMode } = get();
    if (accessToken && refreshToken) {
      saveSession({ user, accessToken, refreshToken, isDemoMode });
    }
  },

  logout: async (db?: SQLiteDatabase) => {
    // 1. Clear local SQLite data to prevent data leak to next user
    if (db) {
      try {
        await clearAllLocalData(db);
      } catch (e) {
        console.warn('[Logout] Failed to clear local data:', e);
      }
    }

    // 2. Sign out of Supabase (clears auth session)
    if (isSupabaseConfigured()) {
      try {
        await getSupabase().auth.signOut();
      } catch (e) {
        console.warn('[Logout] Supabase signOut failed:', e);
      }
    }

    // 3. Clear stored session and last_user_id
    await clearSession();
    await AsyncStorage.removeItem(LAST_USER_KEY);

    // 4. Reset all state
    set({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isDemoMode: false,
      needsPhoneNumber: false,
      isLoading: false,
    });
  },
}));
