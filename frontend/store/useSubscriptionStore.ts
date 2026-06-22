/**
 * Tractor Ledger — Subscription Store
 * Subscription status, activation, referrals, wallet.
 */

import { create } from 'zustand';
import { apiFetch } from '@/lib/api';

export interface SubscriptionStatus {
  status: 'inactive' | 'active' | 'expired';
  is_active: boolean;
  end_date: string | null;
  days_remaining: number;
  referral_code: string | null;
  wallet_balance: number;
  amount_to_pay: number;
}

export interface WalletTransaction {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  balance_after: number;
  created_at: string;
}

export interface ReferralRecord {
  id: string;
  referral_code: string;
  reward_amount: number;
  credited: boolean;
  created_at: string;
  referee?: { name?: string; phone?: string };
}

interface SubscriptionState {
  status: SubscriptionStatus | null;
  referrals: ReferralRecord[];
  walletTransactions: WalletTransaction[];
  totalReferrals: number;
  isLoading: boolean;
}

interface SubscriptionActions {
  loadStatus: (token: string) => Promise<SubscriptionStatus>;
  activate: (
    token: string,
    activationCode: string,
    referralCode?: string,
    deviceId?: string,
  ) => Promise<{ success: boolean; wallet_used?: number }>;
  validateActivationCode: (token: string, code: string) => Promise<{ valid: boolean; message?: string }>;
  validateReferralCode: (token: string, code: string) => Promise<{ valid: boolean; referrer_name?: string; message?: string }>;
  loadReferrals: (token: string) => Promise<void>;
  clear: () => void;
}

export const useSubscriptionStore = create<SubscriptionState & SubscriptionActions>((set, get) => ({
  status: null,
  referrals: [],
  walletTransactions: [],
  totalReferrals: 0,
  isLoading: false,

  loadStatus: async (token: string) => {
    set({ isLoading: true });
    try {
      const data = await apiFetch<SubscriptionStatus>('/subscription/status', { token });
      set({ status: data, isLoading: false });
      return data;
    } catch (error) {
      console.error('[useSubscriptionStore] loadStatus error:', error);
      set({ isLoading: false });
      throw error;
    }
  },

  activate: async (token, activationCode, referralCode, deviceId) => {
    const data = await apiFetch<{
      success: boolean;
      wallet_used?: number;
      subscription_end?: string;
    }>('/subscription/activate', {
      method: 'POST',
      token,
      body: JSON.stringify({
        activation_code: activationCode.trim().toUpperCase(),
        referral_code: referralCode?.trim().toUpperCase() || null,
        device_id: deviceId || null,
      }),
    });
    return data;
  },

  validateActivationCode: async (token, code) => {
    return apiFetch<{ valid: boolean; message?: string }>(
      '/subscription/validate-activation-code',
      {
        method: 'POST',
        token,
        body: JSON.stringify({ code: code.trim().toUpperCase() }),
      },
    );
  },

  validateReferralCode: async (token, code) => {
    return apiFetch<{ valid: boolean; referrer_name?: string; message?: string }>(
      `/subscription/validate-referral-code?code=${encodeURIComponent(code.trim().toUpperCase())}`,
      { token },
    );
  },

  loadReferrals: async (token) => {
    try {
      const data = await apiFetch<{
        referral_code: string;
        wallet_balance: number;
        total_referrals: number;
        referrals: ReferralRecord[];
        wallet_transactions: WalletTransaction[];
      }>('/subscription/my-referrals', { token });

      const currentStatus = get().status;
      set({
        referrals: data.referrals || [],
        walletTransactions: data.wallet_transactions || [],
        totalReferrals: data.total_referrals || 0,
        status: currentStatus
          ? {
              ...currentStatus,
              referral_code: data.referral_code,
              wallet_balance: data.wallet_balance,
            }
          : null,
      });
    } catch (error) {
      console.error('[useSubscriptionStore] loadReferrals error:', error);
    }
  },

  clear: () => {
    set({
      status: null,
      referrals: [],
      walletTransactions: [],
      totalReferrals: 0,
      isLoading: false,
    });
  },
}));
