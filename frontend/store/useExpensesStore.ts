/**
 * Tractor Ledger — Expenses Store
 * Manages expense records: diesel, engine oil, repair, driver wages, other.
 */

import { create } from 'zustand';
import type { SQLiteDatabase } from 'expo-sqlite';

export type ExpenseType = 'diesel' | 'engine_oil' | 'repair' | 'driver_wages' | 'other';

export interface Expense {
  id: string;
  user_id: string;
  date: string;
  expense_type: ExpenseType;
  custom_type: string | null;
  amount: number;
  quantity: number | null;
  unit: string | null;
  rate: number | null;
  notes: string | null;
  created_at: string;
  is_deleted: number;
}

interface ExpensesState {
  expenses: Expense[];
  totalThisMonth: number;
  isLoading: boolean;
}

interface ExpensesActions {
  loadExpenses: (db: SQLiteDatabase, userId: string) => Promise<void>;
  addExpense: (db: SQLiteDatabase, expense: {
    user_id: string;
    date: string;
    expense_type: ExpenseType;
    custom_type?: string;
    amount: number;
    quantity?: number;
    unit?: string;
    rate?: number;
    notes?: string;
  }) => Promise<void>;
  deleteExpense: (db: SQLiteDatabase, id: string, userId: string) => Promise<void>;
  getMonthlyTotal: (month: string) => number;
  getExpensesByType: (type: ExpenseType | 'all') => Expense[];
}

// Simple UUID generator (no external dependency needed)
function generateId(): string {
  return 'exp-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

export const useExpensesStore = create<ExpensesState & ExpensesActions>((set, get) => ({
  expenses: [],
  totalThisMonth: 0,
  isLoading: false,

  loadExpenses: async (db, userId) => {
    try {
      set({ isLoading: true });
      const result = await db.getAllAsync<Expense>(
        'SELECT * FROM expenses WHERE user_id = ? AND is_deleted = 0 ORDER BY date DESC',
        [userId]
      );
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthlyTotal = (result || [])
        .filter((e) => e.date.startsWith(currentMonth))
        .reduce((sum, e) => sum + e.amount, 0);
      set({ expenses: result || [], totalThisMonth: monthlyTotal, isLoading: false });
    } catch (error) {
      console.error('[useExpensesStore] loadExpenses error:', error);
      set({ isLoading: false });
    }
  },

  addExpense: async (db, expense) => {
    try {
      const id = generateId();
      await db.runAsync(
        `INSERT INTO expenses (id, user_id, date, expense_type, custom_type, amount, quantity, unit, rate, notes, sync_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [
          id,
          expense.user_id,
          expense.date,
          expense.expense_type,
          expense.custom_type || null,
          expense.amount,
          expense.quantity || null,
          expense.unit || null,
          expense.rate || null,
          expense.notes || null,
        ]
      );
      await get().loadExpenses(db, expense.user_id);
    } catch (error) {
      console.error('[useExpensesStore] addExpense error:', error);
    }
  },

  deleteExpense: async (db, id, userId) => {
    try {
      await db.runAsync('UPDATE expenses SET is_deleted = 1 WHERE id = ?', [id]);
      await get().loadExpenses(db, userId);
    } catch (error) {
      console.error('[useExpensesStore] deleteExpense error:', error);
    }
  },

  getMonthlyTotal: (month) => {
    return get().expenses
      .filter((e) => e.date.startsWith(month))
      .reduce((sum, e) => sum + e.amount, 0);
  },

  getExpensesByType: (type) => {
    if (type === 'all') return get().expenses;
    return get().expenses.filter((e) => e.expense_type === type);
  },
}));
