/**
 * Tractor Ledger — Farmers Store
 *
 * Full CRUD for farmers with remaining-due calculation.
 * Due = SUM(work_entries.total_amount) − SUM(payments.amount)
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { FarmerWithDues } from '@/lib/database';
import { generateUUID } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FarmerInput {
  name: string;
  mobile: string;
  village?: string | null;
  notes?: string | null;
}

interface FarmersState {
  farmers: FarmerWithDues[];
  isLoading: boolean;
  searchQuery: string;
}

interface FarmersActions {
  /** Load all non-deleted farmers for a user with due & farm counts. */
  loadFarmers: (db: SQLiteDatabase, userId: string) => Promise<void>;
  /** Add a new farmer. Returns the generated id. */
  addFarmer: (db: SQLiteDatabase, userId: string, data: FarmerInput) => Promise<string>;
  /** Update an existing farmer. */
  updateFarmer: (db: SQLiteDatabase, id: string, data: Partial<FarmerInput>) => Promise<void>;
  /** Soft-delete a farmer. */
  deleteFarmer: (db: SQLiteDatabase, id: string) => Promise<void>;
  /** Filter the current list in-memory by name or village. */
  searchFarmers: (query: string) => void;
  /** Get filtered farmers based on current searchQuery. */
  getFilteredFarmers: () => FarmerWithDues[];
}

// ---------------------------------------------------------------------------
// SQL
// ---------------------------------------------------------------------------

const LOAD_FARMERS_SQL = `
  SELECT
    f.*,
    COALESCE(w.total_work_amount, 0) AS total_work_amount,
    COALESCE(p.total_paid, 0)        AS total_paid,
    COALESCE(w.total_work_amount, 0) - COALESCE(p.total_paid, 0) AS remaining_due,
    COALESCE(fm.farm_count, 0)       AS farm_count
  FROM farmers f
  LEFT JOIN (
    SELECT farmer_id, SUM(total_amount) AS total_work_amount
    FROM work_entries
    WHERE is_deleted = 0
    GROUP BY farmer_id
  ) w ON w.farmer_id = f.id
  LEFT JOIN (
    SELECT farmer_id, SUM(amount) AS total_paid
    FROM payments
    WHERE is_deleted = 0
    GROUP BY farmer_id
  ) p ON p.farmer_id = f.id
  LEFT JOIN (
    SELECT farmer_id, COUNT(*) AS farm_count
    FROM farms
    WHERE is_deleted = 0
    GROUP BY farmer_id
  ) fm ON fm.farmer_id = f.id
  WHERE f.is_deleted = 0 AND f.user_id = ?
  ORDER BY f.name COLLATE NOCASE ASC
`;

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFarmersStore = create<FarmersState & FarmersActions>((set, get) => ({
  // --- State -----------------------------------------------------------------
  farmers: [],
  isLoading: false,
  searchQuery: '',

  // --- Actions ---------------------------------------------------------------

  loadFarmers: async (db: SQLiteDatabase, userId: string) => {
    try {
      set({ isLoading: true });
      const rows = await db.getAllAsync<FarmerWithDues>(LOAD_FARMERS_SQL, [userId]);
      set({ farmers: rows, isLoading: false });
    } catch (error) {
      console.error('[useFarmersStore] loadFarmers error:', error);
      set({ isLoading: false });
    }
  },

  addFarmer: async (db: SQLiteDatabase, userId: string, data: FarmerInput): Promise<string> => {
    const id = generateUUID();
    try {
      await db.runAsync(
        `INSERT INTO farmers (id, user_id, name, mobile, village, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
        [id, userId, data.name, data.mobile, data.village ?? null, data.notes ?? null],
      );
      return id;
    } catch (error) {
      console.error('[useFarmersStore] addFarmer error:', error);
      throw error;
    }
  },

  updateFarmer: async (db: SQLiteDatabase, id: string, data: Partial<FarmerInput>) => {
    try {
      const sets: string[] = [];
      const values: (string | null)[] = [];

      if (data.name !== undefined) {
        sets.push('name = ?');
        values.push(data.name);
      }
      if (data.mobile !== undefined) {
        sets.push('mobile = ?');
        values.push(data.mobile);
      }
      if (data.village !== undefined) {
        sets.push('village = ?');
        values.push(data.village ?? null);
      }
      if (data.notes !== undefined) {
        sets.push('notes = ?');
        values.push(data.notes ?? null);
      }

      if (sets.length === 0) return;

      sets.push("updated_at = datetime('now')");
      sets.push("sync_status = 'pending'");
      values.push(id);

      await db.runAsync(
        `UPDATE farmers SET ${sets.join(', ')} WHERE id = ?`,
        values,
      );
    } catch (error) {
      console.error('[useFarmersStore] updateFarmer error:', error);
      throw error;
    }
  },

  deleteFarmer: async (db: SQLiteDatabase, id: string) => {
    try {
      await db.runAsync(
        `UPDATE farmers SET is_deleted = 1, updated_at = datetime('now'), sync_status = 'pending' WHERE id = ?`,
        [id],
      );
      // Optimistically remove from local state
      set((state) => ({
        farmers: state.farmers.filter((f) => f.id !== id),
      }));
    } catch (error) {
      console.error('[useFarmersStore] deleteFarmer error:', error);
      throw error;
    }
  },

  searchFarmers: (query: string) => {
    set({ searchQuery: query });
  },

  getFilteredFarmers: (): FarmerWithDues[] => {
    const { farmers, searchQuery } = get();
    if (!searchQuery.trim()) return farmers;

    const q = searchQuery.toLowerCase().trim();
    return farmers.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        (f.village && f.village.toLowerCase().includes(q)),
    );
  },
}));
