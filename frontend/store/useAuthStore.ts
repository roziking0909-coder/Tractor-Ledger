/**
 * Tractor Ledger — Auth Store
 * Phone OTP login with JWT tokens, demo mode for offline testing.
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
let authListenerInitialized = false;

export interface AuthUser {
  id: string;
  phone: string;
  name: string;
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
}

interface AuthActions {
  restoreSession: (db?: SQLiteDatabase) => Promise<void>;
  loginWithOtp: (phone: string, otp: string, db?: SQLiteDatabase) => Promise<void>;
  enterDemoMode: (db: SQLiteDatabase) => Promise<void>;
  setUser: (user: AuthUser) => void;
  updateSessionTokens: (accessToken: string, refreshToken: string) => Promise<void>;
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
  isLoading: true,

  initializeAuthListener: () => {
    if (authListenerInitialized || !isSupabaseConfigured()) return;
    authListenerInitialized = true;

    getSupabase().auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        const { user, isDemoMode } = get();
        // Preserve existing user object, update tokens
        if (session && user) {
          const storedAuth: StoredAuth = {
            user,
            accessToken: session.access_token,
            refreshToken: session.refresh_token,
            isDemoMode,
          };
          // IMPORTANT: Do NOT call setSession here to avoid recursion/loops
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

        set({
          user: stored.user,
          accessToken: stored.accessToken,
          refreshToken: stored.refreshToken,
          isDemoMode: stored.isDemoMode,
          isAuthenticated: true,
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

  loginWithOtp: async (phone: string, otp: string, db?: SQLiteDatabase) => {
    if (!isApiConfigured()) {
      throw new Error('API not configured. Set EXPO_PUBLIC_API_URL to your backend.');
    }

    const normalizedPhone = phone.startsWith('+') ? phone : `+91${phone.replace(/\D/g, '')}`;

    const data = await apiFetch<{
      access_token: string;
      refresh_token: string;
      user_id: string;
      phone: string;
    }>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify({ phone: normalizedPhone, token: otp }),
    });

    const user: AuthUser = {
      id: data.user_id,
      phone: data.phone,
      name: '',
    };

    const session: StoredAuth = {
      user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isDemoMode: false,
    };
    if (isSupabaseConfigured()) {
      const { error } = await getSupabase().auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      });

      if (error) {
        throw error;
      }
      if (db && user) {
        pushPendingToSupabase(db, user.id)
          .then(() => pullFromSupabase(db, user.id))
          .catch(err => console.warn('[useAuthStore] Initial sync failed:', err));
      }
    }
    await saveSession(session);
    set({
      user,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      isAuthenticated: true,
      isDemoMode: false,
      isLoading: false,
    });
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
      isLoading: false,
    });
  },
}));
