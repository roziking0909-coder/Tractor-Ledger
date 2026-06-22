/**
 * Tractor Ledger — Payments Store
 *
 * CRUD for payments with JOIN for farmer name.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Payment } from '@/lib/database';
import { generateUUID } from '@/lib/format';
import { pushSingleRecord } from '@/lib/sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PaymentInput {
  farmer_id: string | null;
  amount: number;
  payment_date: string;
  notes?: string | null;
}

interface PaymentsState {
  payments: Payment[];
  isLoading: boolean;
}

interface PaymentsActions {
  /** Load payments, optionally filtered by farmerId. Includes farmer_name via JOIN. */
  loadPayments: (db: SQLiteDatabase, userId: string, farmerId?: string) => Promise<void>;
  /** Add a new payment. Returns the created payment. */
  addPayment: (db: SQLiteDatabase, userId: string, data: PaymentInput) => Promise<Payment>;
  /** Soft-delete a payment. */
  deletePayment: (db: SQLiteDatabase, id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const BASE_SELECT = `
  SELECT
    p.*,
    fr.name AS farmer_name
  FROM payments p
  LEFT JOIN farmers fr ON fr.id = p.farmer_id
`;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const usePaymentsStore = create<PaymentsState & PaymentsActions>((set) => ({
  // --- State -----------------------------------------------------------------
  payments: [],
  isLoading: false,

  // --- Actions ---------------------------------------------------------------

  loadPayments: async (db: SQLiteDatabase, userId: string, farmerId?: string) => {
    try {
      set({ isLoading: true });

      const conditions: string[] = ['p.is_deleted = 0', 'p.user_id = ?'];
      const params: (string | number)[] = [userId];

      if (farmerId) {
        conditions.push('p.farmer_id = ?');
        params.push(farmerId);
      }

      const sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY p.payment_date DESC, p.created_at DESC`;

      const rows = await db.getAllAsync<Payment>(sql, params);
      set({ payments: rows, isLoading: false });
    } catch (error) {
      console.error('[usePaymentsStore] loadPayments error:', error);
      set({ isLoading: false });
    }
  },

  addPayment: async (db: SQLiteDatabase, userId: string, data: PaymentInput): Promise<Payment> => {
    const id = generateUUID();
    try {
      await db.runAsync(
        `INSERT INTO payments (id, user_id, farmer_id, amount, payment_date, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [
          id,
          userId,
          data.farmer_id,
          data.amount,
          data.payment_date,
          data.notes ?? null,
        ],
      );

      // Fetch the created row with JOIN
      const created = await db.getFirstAsync<Payment>(
        `${BASE_SELECT} WHERE p.id = ?`,
        [id],
      );

      if (!created) throw new Error('Failed to read back created payment');
      pushSingleRecord(db, 'payments', id);
      return created;
    } catch (error) {
      console.error('[usePaymentsStore] addPayment error:', error);
      throw error;
    }
  },

  deletePayment: async (db: SQLiteDatabase, id: string) => {
    try {
      await db.runAsync(
        `UPDATE payments SET is_deleted = 1, sync_status = 'pending' WHERE id = ?`,
        [id],
      );
      pushSingleRecord(db, 'payments', id);
      // Optimistically remove from local state
      set((state) => ({
        payments: state.payments.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error('[usePaymentsStore] deletePayment error:', error);
      throw error;
    }
  },
}));
