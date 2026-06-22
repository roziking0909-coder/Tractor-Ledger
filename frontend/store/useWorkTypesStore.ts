/**
 * Tractor Ledger — Work Types Store
 *
 * Shared global work types table — one list for all tractor owners.
 * Default types seeded on first launch, users can add custom ones.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from '@/lib/format';

export interface WorkTypeRecord {
  id: string;
  name: string;
  name_gu: string | null;
  emoji: string;
  is_default: number;
  created_at: string;
}

interface WorkTypesState {
  workTypes: WorkTypeRecord[];
  isLoading: boolean;
}

interface WorkTypesActions {
  loadWorkTypes: (db: SQLiteDatabase) => Promise<void>;
  addWorkType: (db: SQLiteDatabase, name: string, nameGu?: string, emoji?: string) => Promise<WorkTypeRecord>;
}

/**
 * Default work types seeded on first launch.
 */
export const DEFAULT_WORK_TYPES = [
  { name: 'Ploughing', name_gu: 'ખેડ', emoji: '🚜' },
  { name: 'Rotavator', name_gu: 'રોટાવેટર', emoji: '⚙️' },
  { name: 'Seeding', name_gu: 'વાવણી', emoji: '🌱' },
  { name: 'Cultivation', name_gu: 'ખેતી', emoji: '🌾' },
  { name: 'Harvesting', name_gu: 'લણણી', emoji: '🌻' },
  { name: 'Rotary', name_gu: 'રોટરી', emoji: '🔄' },
  { name: 'Levelling', name_gu: 'લેવલિંગ', emoji: '📐' },
  { name: 'Other', name_gu: 'અન્ય', emoji: '📋' },
] as const;

export const useWorkTypesStore = create<WorkTypesState & WorkTypesActions>((set) => ({
  workTypes: [],
  isLoading: false,

  loadWorkTypes: async (db: SQLiteDatabase) => {
    try {
      set({ isLoading: true });
      const rows = await db.getAllAsync<WorkTypeRecord>(
        'SELECT * FROM work_types ORDER BY is_default DESC, name ASC',
      );
      set({ workTypes: rows, isLoading: false });
    } catch (error) {
      console.error('[useWorkTypesStore] loadWorkTypes error:', error);
      set({ isLoading: false });
    }
  },

  addWorkType: async (db: SQLiteDatabase, name: string, nameGu?: string, emoji?: string) => {
    const id = generateUUID();
    const record: WorkTypeRecord = {
      id,
      name: name.trim(),
      name_gu: nameGu?.trim() || null,
      emoji: emoji || '📋',
      is_default: 0,
      created_at: new Date().toISOString(),
    };

    await db.runAsync(
      `INSERT OR IGNORE INTO work_types (id, name, name_gu, emoji, is_default, created_at)
       VALUES (?, ?, ?, ?, 0, datetime('now'))`,
      [id, record.name, record.name_gu, record.emoji],
    );

    // Reload
    const rows = await db.getAllAsync<WorkTypeRecord>(
      'SELECT * FROM work_types ORDER BY is_default DESC, name ASC',
    );
    set({ workTypes: rows });

    return record;
  },
}));
