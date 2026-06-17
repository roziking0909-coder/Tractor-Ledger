/**
 * Tractor Ledger — Auth Store
 * Phone OTP login with JWT tokens, demo mode for offline testing.
 */

import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { SQLiteDatabase } from 'expo-sqlite';
import { apiFetch, isApiConfigured } from '@/lib/api';

const AUTH_STORAGE_KEY = '@tractor_ledger/auth';

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
  loginWithOtp: (phone: string, otp: string) => Promise<void>;
  enterDemoMode: (db: SQLiteDatabase) => Promise<void>;
  setUser: (user: AuthUser) => void;
  logout: () => Promise<void>;
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

  restoreSession: async (db?: SQLiteDatabase) => {
    try {
      set({ isLoading: true });
      const raw = await AsyncStorage.getItem(AUTH_STORAGE_KEY);

      if (raw) {
        const stored: StoredAuth = JSON.parse(raw);
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
      set({ isLoading: false });
    }
  },

  loginWithOtp: async (phone: string, otp: string) => {
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
    await clearSession();
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
