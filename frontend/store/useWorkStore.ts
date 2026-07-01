/**
 * Tractor Ledger — Work Entries Store
 *
 * CRUD for work entries with JOINs for farmer & farm names.
 * Supports flexible filtering by farmer, farm, and date range.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { WorkEntry } from '@/lib/database';
import { generateUUID, getTodayISO } from '@/lib/format';
import { pushSingleRecord } from '@/lib/sync';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WorkEntryInput {
  farmer_id: string | null;
  farm_name: string | null;
  date: string;
  work_type: string;
  quantity: number | null;
  quantity_unit: string | null;
  rate: number;
  total_amount: number;
  discount_amount?: number;
  notes?: string | null;
}

interface WorkFilters {
  farmerId?: string;
  farmName?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface WorkState {
  workEntries: WorkEntry[];
  isLoading: boolean;
}

interface WorkActions {
  /** Load work entries with optional filters. Includes farmer_name and farm_name via JOINs. */
  loadWorkEntries: (db: SQLiteDatabase, userId: string, filters?: WorkFilters) => Promise<void>;
  /** Add a new work entry. Returns the created entry. */
  addWorkEntry: (db: SQLiteDatabase, userId: string, data: WorkEntryInput) => Promise<WorkEntry>;
  /** Update an existing work entry. */
  updateWorkEntry: (db: SQLiteDatabase, id: string, data: Partial<WorkEntryInput>) => Promise<void>;
  /** Soft-delete a work entry. */
  deleteWorkEntry: (db: SQLiteDatabase, id: string) => Promise<void>;
  /** Restore a soft-deleted work entry. */
  restoreWorkEntry: (db: SQLiteDatabase, id: string) => Promise<void>;
  /** Get today's work entries for the dashboard. */
  getTodayEntries: (db: SQLiteDatabase, userId: string) => Promise<WorkEntry[]>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const BASE_SELECT = `
  SELECT
    we.*,
    fr.name AS farmer_name
  FROM work_entries we
  LEFT JOIN farmers fr ON fr.id = we.farmer_id
`;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useWorkStore = create<WorkState & WorkActions>((set) => ({
  // --- State -----------------------------------------------------------------
  workEntries: [],
  isLoading: false,

  // --- Actions ---------------------------------------------------------------

  loadWorkEntries: async (db: SQLiteDatabase, userId: string, filters?: WorkFilters) => {
    try {
      set({ isLoading: true });

      const conditions: string[] = ['we.is_deleted = 0', 'we.user_id = ?'];
      const params: (string | number)[] = [userId];

      if (filters?.farmerId) {
        conditions.push('we.farmer_id = ?');
        params.push(filters.farmerId);
      }
      if (filters?.farmName) {
        conditions.push('we.farm_name = ?');
        params.push(filters.farmName);
      }
      if (filters?.dateFrom) {
        conditions.push('we.date >= ?');
        params.push(filters.dateFrom);
      }
      if (filters?.dateTo) {
        conditions.push('we.date <= ?');
        params.push(filters.dateTo);
      }

      const sql = `${BASE_SELECT} WHERE ${conditions.join(' AND ')} ORDER BY we.date DESC, we.created_at DESC`;

      const rows = await db.getAllAsync<WorkEntry>(sql, params);
      set({ workEntries: rows, isLoading: false });
    } catch (error) {
      console.error('[useWorkStore] loadWorkEntries error:', error);
      set({ isLoading: false });
    }
  },

  addWorkEntry: async (db: SQLiteDatabase, userId: string, data: WorkEntryInput): Promise<WorkEntry> => {
    const id = generateUUID();
    try {
      await db.runAsync(
        `INSERT INTO work_entries
          (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, discount_amount, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          id,
          userId,
          data.farmer_id,
          data.farm_name,
          data.date,
          data.work_type,
          data.quantity,
          data.quantity_unit,
          data.rate,
          data.total_amount,
          data.discount_amount || 0,
          data.notes ?? null,
        ],
      );

      // Fetch the created row with JOINs so caller gets farmer_name / farm_name
      const created = await db.getFirstAsync<WorkEntry>(
        `${BASE_SELECT} WHERE we.id = ?`,
        [id],
      );

      if (!created) throw new Error('Failed to read back created work entry');
      pushSingleRecord(db, 'work_entries', id);
      return created;
    } catch (error) {
      console.error('[useWorkStore] addWorkEntry error:', error);
      throw error;
    }
  },

  updateWorkEntry: async (db: SQLiteDatabase, id: string, data: Partial<WorkEntryInput>) => {
    try {
      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (data.farmer_id !== undefined) {
        sets.push('farmer_id = ?');
        values.push(data.farmer_id);
      }
      if (data.farm_name !== undefined) {
        sets.push('farm_name = ?');
        values.push(data.farm_name);
      }
      if (data.date !== undefined) {
        sets.push('date = ?');
        values.push(data.date);
      }
      if (data.work_type !== undefined) {
        sets.push('work_type = ?');
        values.push(data.work_type);
      }
      if (data.quantity !== undefined) {
        sets.push('quantity = ?');
        values.push(data.quantity);
      }
      if (data.quantity_unit !== undefined) {
        sets.push('quantity_unit = ?');
        values.push(data.quantity_unit);
      }
      if (data.rate !== undefined) {
        sets.push('rate = ?');
        values.push(data.rate);
      }
      if (data.total_amount !== undefined) {
        sets.push('total_amount = ?');
        values.push(data.total_amount);
      }
      if (data.notes !== undefined) {
        sets.push('notes = ?');
        values.push(data.notes ?? null);
      }

      if (sets.length === 0) return;

      sets.push("sync_status = 'pending'");
      values.push(id);

      await db.runAsync(
        `UPDATE work_entries SET ${sets.join(', ')} WHERE id = ?`,
        values,
      );
      pushSingleRecord(db, 'work_entries', id);
    } catch (error) {
      console.error('[useWorkStore] updateWorkEntry error:', error);
      throw error;
    }
  },

  deleteWorkEntry: async (db: SQLiteDatabase, id: string) => {
    try {
      await db.runAsync(
        `UPDATE work_entries SET is_deleted = 1, sync_status = 'pending' WHERE id = ?`,
        [id],
      );
      pushSingleRecord(db, 'work_entries', id);
      // Optimistically remove from local state
      set((state) => ({
        workEntries: state.workEntries.filter((e) => e.id !== id),
      }));
    } catch (error) {
      console.error('[useWorkStore] deleteWorkEntry error:', error);
      throw error;
    }
  },

  restoreWorkEntry: async (db: SQLiteDatabase, id: string) => {
    try {
      await db.runAsync(
        `UPDATE work_entries SET is_deleted = 0, sync_status = 'pending' WHERE id = ?`,
        [id],
      );
      pushSingleRecord(db, 'work_entries', id);
    } catch (error) {
      console.error('[useWorkStore] restoreWorkEntry error:', error);
      throw error;
    }
  },

  getTodayEntries: async (db: SQLiteDatabase, userId: string): Promise<WorkEntry[]> => {
    try {
      const today = getTodayISO();
      const rows = await db.getAllAsync<WorkEntry>(
        `${BASE_SELECT} WHERE we.is_deleted = 0 AND we.user_id = ? AND we.date = ? ORDER BY we.created_at DESC`,
        [userId, today],
      );
      return rows;
    } catch (error) {
      console.error('[useWorkStore] getTodayEntries error:', error);
      return [];
    }
  },
}));
