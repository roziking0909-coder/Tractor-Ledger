/**
 * Tractor Ledger — Farms Store
 *
 * CRUD for farms. Each farm belongs to a farmer and a user.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { Farm } from '@/lib/database';
import { generateUUID } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface FarmInput {
  farmer_id: string;
  user_id: string;
  name: string;
  location?: string | null;
  area_acres?: number | null;
  notes?: string | null;
}

interface FarmsState {
  farms: Farm[];
  isLoading: boolean;
}

interface FarmsActions {
  /** Load farms for a specific farmer. */
  loadFarms: (db: SQLiteDatabase, farmerId: string) => Promise<void>;
  /** Load all farms for a user. */
  loadAllFarms: (db: SQLiteDatabase, userId: string) => Promise<void>;
  /** Add a new farm. Returns the generated id. */
  addFarm: (db: SQLiteDatabase, data: FarmInput) => Promise<string>;
  /** Update an existing farm. */
  updateFarm: (db: SQLiteDatabase, id: string, data: Partial<Omit<FarmInput, 'farmer_id' | 'user_id'>>) => Promise<void>;
  /** Soft-delete a farm. */
  deleteFarm: (db: SQLiteDatabase, id: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useFarmsStore = create<FarmsState & FarmsActions>((set) => ({
  // --- State -----------------------------------------------------------------
  farms: [],
  isLoading: false,

  // --- Actions ---------------------------------------------------------------

  loadFarms: async (db: SQLiteDatabase, farmerId: string) => {
    try {
      set({ isLoading: true });
      const rows = await db.getAllAsync<Farm>(
        `SELECT * FROM farms WHERE farmer_id = ? AND is_deleted = 0 ORDER BY name COLLATE NOCASE ASC`,
        [farmerId],
      );
      set({ farms: rows, isLoading: false });
    } catch (error) {
      console.error('[useFarmsStore] loadFarms error:', error);
      set({ isLoading: false });
    }
  },

  loadAllFarms: async (db: SQLiteDatabase, userId: string) => {
    try {
      set({ isLoading: true });
      const rows = await db.getAllAsync<Farm>(
        `SELECT * FROM farms WHERE user_id = ? AND is_deleted = 0 ORDER BY name COLLATE NOCASE ASC`,
        [userId],
      );
      set({ farms: rows, isLoading: false });
    } catch (error) {
      console.error('[useFarmsStore] loadAllFarms error:', error);
      set({ isLoading: false });
    }
  },

  addFarm: async (db: SQLiteDatabase, data: FarmInput): Promise<string> => {
    const id = generateUUID();
    try {
      await db.runAsync(
        `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          id,
          data.farmer_id,
          data.user_id,
          data.name,
          data.location ?? null,
          data.area_acres ?? null,
          data.notes ?? null,
        ],
      );
      return id;
    } catch (error) {
      console.error('[useFarmsStore] addFarm error:', error);
      throw error;
    }
  },

  updateFarm: async (db: SQLiteDatabase, id: string, data: Partial<Omit<FarmInput, 'farmer_id' | 'user_id'>>) => {
    try {
      const sets: string[] = [];
      const values: (string | number | null)[] = [];

      if (data.name !== undefined) {
        sets.push('name = ?');
        values.push(data.name);
      }
      if (data.location !== undefined) {
        sets.push('location = ?');
        values.push(data.location ?? null);
      }
      if (data.area_acres !== undefined) {
        sets.push('area_acres = ?');
        values.push(data.area_acres ?? null);
      }
      if (data.notes !== undefined) {
        sets.push('notes = ?');
        values.push(data.notes ?? null);
      }

      if (sets.length === 0) return;

      sets.push("sync_status = 'pending'");
      values.push(id);

      await db.runAsync(
        `UPDATE farms SET ${sets.join(', ')} WHERE id = ?`,
        values,
      );
    } catch (error) {
      console.error('[useFarmsStore] updateFarm error:', error);
      throw error;
    }
  },

  deleteFarm: async (db: SQLiteDatabase, id: string) => {
    try {
      await db.runAsync(
        `UPDATE farms SET is_deleted = 1, sync_status = 'pending' WHERE id = ?`,
        [id],
      );
      // Optimistically remove from local state
      set((state) => ({
        farms: state.farms.filter((f) => f.id !== id),
      }));
    } catch (error) {
      console.error('[useFarmsStore] deleteFarm error:', error);
      throw error;
    }
  },
}));
