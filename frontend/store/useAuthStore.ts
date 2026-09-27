/**
 * Tractor Ledger — Auth Store
 * Google Sign-In with JWT tokens, demo mode for offline testing.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import { apiFetch, isApiConfigured } from '@/lib/api';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';
import { pullFromSupabase, pushPendingToSupabase } from '@/lib/sync';
import { useFarmersStore } from './useFarmersStore';
import { useFarmsStore } from './useFarmsStore';
import { useWorkStore } from './useWorkStore';
import { usePaymentsStore } from './usePaymentsStore';
import { useExpensesStore } from './useExpensesStore';
import { useDashboardStore } from './useDashboardStore';
import { useSubscriptionStore } from './useSubscriptionStore';
const AUTH_STORAGE_KEY = '@tractor_ledger/auth';
const LAST_USER_KEY = '@tractor_ledger/last_user';
let authListenerInitialized = false;

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
  enterDemoMode: (db: SQLiteDatabase) => Promise<void>;
  setUser: (user: AuthUser) => void;
  updateSessionTokens: (accessToken: string, refreshToken: string) => Promise<void>;
  setPhoneNumber: (phone: string, db?: SQLiteDatabase) => Promise<void>;
  logout: () => Promise<void>;
  initializeAuthListener: () => void;
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

function clearBusinessStores() {
  useFarmersStore.setState({ farmers: [], searchQuery: '', isLoading: false });
  useFarmsStore.setState({ farms: [], isLoading: false });
  useWorkStore.setState({ workEntries: [], isLoading: false });
  usePaymentsStore.setState({ payments: [], isLoading: false });
  useExpensesStore.setState({ expenses: [], isLoading: false });
  useDashboardStore.setState({ stats: null, isLoading: false });
  useSubscriptionStore.getState().clear();
}

export const useAuthStore = create<AuthState & AuthActions>((set, get) => ({
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isDemoMode: false,
  needsPhoneNumber: false,
  isLoading: true,

  initializeAuthListener: () => {
    if (authListenerInitialized || !isSupabaseConfigured()) return;
    authListenerInitialized = true;

    getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        const { user, isDemoMode } = get();
        if (session && user) {
          const storedAuth: StoredAuth = {
            user,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            isDemoMode,
          };
          saveSession(storedAuth).catch(console.error);
          set({
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
          });
        }
      } else if (event === 'SIGNED_OUT') {
        clearSession().catch(console.error);
        clearBusinessStores();
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
          isDemoMode: false,
          needsPhoneNumber: false,
        });
      }
    });
  },

  restoreSession: async (db?: SQLiteDatabase) => {
    get().initializeAuthListener();
    try {
      set({ isLoading: true });
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (raw) {
        const stored: StoredAuth = JSON.parse(raw);

        if (!stored.isDemoMode && isSupabaseConfigured()) {
          const { error } = await getSupabase().auth.setSession({
            access_token: stored.accessToken,
            refresh_token: stored.refreshToken,
          });

          if (error) {
            throw error;
          }
          if (db && stored.user) {
            pushPendingToSupabase(db, stored.user.id)
              .then(() => pullFromSupabase(db, stored.user.id))
              .catch(err => console.warn('[useAuthStore] Initial sync failed:', err));
          }
        }

        const needsPhone = !stored.user.phone || stored.user.phone.trim() === '';

        set({
          user: stored.user,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          isDemoMode: stored.isDemoMode,
          isAuthenticated: true,
          needsPhoneNumber: needsPhone,
          isLoading: false,
        });
        return;
      }

      set({ isLoading: false });
    } catch (error) {
      console.error('[useAuthStore] restoreSession error:', error);
      clearBusinessStores();
      set({ isLoading: false });
    }
  },

  updateSessionTokens: async (accessToken: string, refreshToken: string) => {
    const { user, isDemoMode } = get();
    if (!user) throw new Error("Cannot update tokens without an authenticated user");

    const storedAuth: StoredAuth = {
      user,
      accessToken,
      refreshToken,
      isDemoMode,
    };

    await saveSession(storedAuth);

    set({
      accessToken,
      refreshToken,
    });
  },

  loginWithGoogle: async () => {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase not configured. Set EXPO_PUBLIC_SUPABASE_URL and ANON_KEY in .env');
    }

    const supabase = getSupabase();
    const { data: { session }, error } = await supabase.auth.getSession();

    if (error) throw error;
    if (!session || !session.user) {
      throw new Error('Google sign-in failed — no session found');
    }

    // Check public.users to see if we have their phone
    const { data: profile } = await supabase
      .from('users')
      .select('phone, name')
      .eq('id', session.user.id)
      .maybeSingle();

    const user: AuthUser = {
      id: session.user.id,
      phone: profile?.phone || '',
      name: profile?.name || session.user.user_metadata?.full_name || session.user.user_metadata?.name || '',
      email: session.user.email || '',
    };

    const stored: StoredAuth = {
      user,
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
      isDemoMode: false,
    };

    await saveSession(stored);
    await AsyncStorage.setItem(LAST_USER_KEY, user.id);

    const needsPhone = !user.phone || user.phone.trim() === '';

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

  logout: async () => {
    if (isSupabaseConfigured()) {
      try {
        await getSupabase().auth.signOut({ scope: 'local' });
      } catch (error) {
        console.warn('[useAuthStore] Supabase signOut failed:', error);
      }
    }
    await clearSession();
    clearBusinessStores();
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
