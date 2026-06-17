/**
 * Tractor Ledger — Dashboard Store
 *
 * Aggregated statistics for the home dashboard.
 * Computes farmer count, farm count, total dues, today's work.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';
import type { DashboardStats, WorkEntry } from '@/lib/database';
import { getTodayISO } from '@/lib/format';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface DashboardState {
  stats: DashboardStats | null;
  isLoading: boolean;
}

interface DashboardActions {
  /** Compute all dashboard statistics in a single call. */
  loadDashboard: (db: SQLiteDatabase, userId: string) => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useDashboardStore = create<DashboardState & DashboardActions>((set) => ({
  // --- State -----------------------------------------------------------------
  stats: null,
  isLoading: false,

  // --- Actions ---------------------------------------------------------------

  loadDashboard: async (db: SQLiteDatabase, userId: string) => {
    try {
      set({ isLoading: true });

      // 1. Total active farmers
      const farmerRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM farmers WHERE is_deleted = 0 AND user_id = ?`,
        [userId],
      );
      const totalFarmers = farmerRow?.count ?? 0;

      // 2. Total active farms
      const farmRow = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) AS count FROM farms WHERE is_deleted = 0 AND user_id = ?`,
        [userId],
      );
      const totalFarms = farmRow?.count ?? 0;

      // 3. Total remaining dues & count of farmers with dues
      const dueRows = await db.getAllAsync<{ remaining_due: number }>(
        `SELECT
           COALESCE(w.total_work, 0) - COALESCE(p.total_paid, 0) AS remaining_due
         FROM farmers f
         LEFT JOIN (
           SELECT farmer_id, SUM(total_amount) AS total_work
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
         WHERE f.is_deleted = 0 AND f.user_id = ?`,
        [userId],
      );

      let totalDue = 0;
      let farmersWithDues = 0;
      for (const row of dueRows) {
        const due = row.remaining_due ?? 0;
        if (due > 0) {
          totalDue += due;
          farmersWithDues += 1;
        }
      }

      // 4. Today's work entries with JOINs
      const today = getTodayISO();
      const todayWorkEntries = await db.getAllAsync<WorkEntry>(
        `SELECT
           we.*,
           fr.name AS farmer_name
         FROM work_entries we
         LEFT JOIN farmers fr ON fr.id = we.farmer_id
         WHERE we.is_deleted = 0 AND we.user_id = ? AND we.date = ?
         ORDER BY we.created_at DESC`,
        [userId, today],
      );

      // 5. Today's total amount
      const todayTotalRow = await db.getFirstAsync<{ total: number }>(
        `SELECT COALESCE(SUM(total_amount), 0) AS total
         FROM work_entries
         WHERE is_deleted = 0 AND user_id = ? AND date = ?`,
        [userId, today],
      );
      const todayTotal = todayTotalRow?.total ?? 0;

      set({
        stats: {
          totalFarmers,
          totalFarms,
          totalDue,
          farmersWithDues,
          todayWorkEntries,
          todayTotal,
        },
        isLoading: false,
      });
    } catch (error) {
      console.error('[useDashboardStore] loadDashboard error:', error);
      set({
        stats: {
          totalFarmers: 0,
          totalFarms: 0,
          totalDue: 0,
          farmersWithDues: 0,
          todayWorkEntries: [],
          todayTotal: 0,
        },
        isLoading: false,
      });
    }
  },
}));
