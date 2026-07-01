/**
 * ટ્રેક્ટર સારથી — Discounts Store
 * Manages farmer-level discount records (running ledger).
 * Each discount has an amount, reason, and date.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Discount } from '@/lib/database';
import { generateUUID } from '@/lib/format';
import { pushSingleRecord } from '@/lib/sync';

interface DiscountsState {
  discounts: Discount[];
  isLoading: boolean;
}

interface DiscountsActions {
  loadDiscounts: (db: SQLiteDatabase, userId: string, farmerId: string) => Promise<void>;
  addDiscount: (db: SQLiteDatabase, params: {
    userId: string;
    farmerId: string;
    amount: number;
    reason?: string;
    date: string;
  }) => Promise<void>;
  deleteDiscount: (db: SQLiteDatabase, id: string) => Promise<void>;
  restoreDiscount: (db: SQLiteDatabase, id: string) => Promise<void>;
  getTotalDiscounts: () => number;
}

export const useDiscountsStore = create<DiscountsState & DiscountsActions>((set, get) => ({
  discounts: [],
  isLoading: false,

  loadDiscounts: async (db, userId, farmerId) => {
    set({ isLoading: true });
    try {
      const results = await db.getAllAsync<Discount>(
        `SELECT * FROM discounts 
         WHERE user_id = ? AND farmer_id = ? AND is_deleted = 0 
         ORDER BY date DESC`,
        [userId, farmerId]
      );
      set({ discounts: results, isLoading: false });
    } catch (error) {
      console.warn('[Discounts] Failed to load:', error);
      set({ isLoading: false });
    }
  },

  addDiscount: async (db, params) => {
    try {
      const id = generateUUID();
      await db.runAsync(
        `INSERT INTO discounts (id, user_id, farmer_id, amount, reason, date, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [id, params.userId, params.farmerId, params.amount, params.reason || null, params.date]
      );

      // Sync to Supabase
      pushSingleRecord(db, 'discounts', id);

      // Reload discounts
      await get().loadDiscounts(db, params.userId, params.farmerId);
    } catch (error) {
      console.warn('[Discounts] Failed to add:', error);
    }
  },

  deleteDiscount: async (db, id) => {
    try {
      await db.runAsync(
        `UPDATE discounts SET is_deleted = 1, sync_status = 'pending' WHERE id = ?`,
        [id]
      );
      pushSingleRecord(db, 'discounts', id);
      set((state) => ({
        discounts: state.discounts.filter((d) => d.id !== id),
      }));
    } catch (error) {
      console.warn('[Discounts] Failed to delete:', error);
    }
  },

  restoreDiscount: async (db, id) => {
    try {
      await db.runAsync(
        `UPDATE discounts SET is_deleted = 0, sync_status = 'pending' WHERE id = ?`,
        [id]
      );
      pushSingleRecord(db, 'discounts', id);
    } catch (error) {
      console.warn('[Discounts] Failed to restore:', error);
    }
  },

  getTotalDiscounts: () => {
    return get().discounts.reduce((sum, d) => sum + d.amount, 0);
  },
}));
