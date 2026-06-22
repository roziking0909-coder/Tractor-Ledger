/**
 * Tractor Ledger — SQLite Database Setup
 * 
 * Local database schema mirroring Supabase tables.
 * All tables include sync_status column for offline-first sync.
 * This function is passed to SQLiteProvider's onInit prop.
 */

import type { SQLiteDatabase } from 'expo-sqlite';

/**
 * Run a single migration statement, ignoring "column already exists" errors.
 *
 * Guards against a null/undefined/empty SQL string ever reaching the native
 * `execAsync` binding — passing one produces an opaque
 * `java.lang.NullPointerException` instead of a useful error, so we skip it.
 */
async function runMigration(db: SQLiteDatabase, sql: string | null | undefined): Promise<void> {
  if (typeof sql !== 'string' || sql.trim().length === 0) {
    console.warn('[DB Migration] Skipped null/empty migration statement');
    return;
  }
  try {
    await db.execAsync(sql);
  } catch (e) {
    // Column already exists (or otherwise not applicable) — safe to ignore.
  }
}

/**
 * Initialize the local SQLite database with all tables.
 * Called once when the app starts via SQLiteProvider.
 */
export async function initializeDatabase(db: SQLiteDatabase): Promise<void> {
  if (!db) {
    throw new Error('[DB Init] initializeDatabase called with a null database handle');
  }

  // Enable WAL mode for better performance
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');

  await db.execAsync(`
    -- Users (tractor owners) — local cache of auth user
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      sync_status TEXT DEFAULT 'synced' CHECK(sync_status IN ('synced', 'pending', 'conflict'))
    );

    -- Farmers
    CREATE TABLE IF NOT EXISTS farmers (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      village TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Farms (one farmer → many farms)
    CREATE TABLE IF NOT EXISTS farms (
      id TEXT PRIMARY KEY,
      farmer_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      location TEXT,
      area_acres REAL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
      FOREIGN KEY (farmer_id) REFERENCES farmers(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Work Entries
    CREATE TABLE IF NOT EXISTS work_entries (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farmer_id TEXT,
      farm_name TEXT,
      date TEXT NOT NULL,
      work_type TEXT NOT NULL,
      quantity REAL,
      quantity_unit TEXT,
      rate REAL NOT NULL,
      total_amount REAL NOT NULL,
      notes TEXT,
      whatsapp_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    );

    -- Payments
    CREATE TABLE IF NOT EXISTS payments (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      farmer_id TEXT,
      amount REAL NOT NULL,
      payment_date TEXT NOT NULL,
      notes TEXT,
      whatsapp_sent INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (farmer_id) REFERENCES farmers(id)
    );

    -- Expenses
    CREATE TABLE IF NOT EXISTS expenses (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      expense_type TEXT NOT NULL CHECK(expense_type IN ('diesel', 'engine_oil', 'repair', 'driver_wages', 'other')),
      custom_type TEXT,
      amount REAL NOT NULL,
      quantity REAL,
      unit TEXT,
      rate REAL,
      notes TEXT,
      sync_status TEXT DEFAULT 'pending' CHECK(sync_status IN ('synced', 'pending', 'conflict')),
      is_deleted INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    -- Work Types (shared global table)
    CREATE TABLE IF NOT EXISTS work_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      name_gu TEXT,
      emoji TEXT DEFAULT '📋',
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON farmers(user_id);
    CREATE INDEX IF NOT EXISTS idx_farms_farmer_id ON farms(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_farms_user_id ON farms(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_entries_farmer_id ON work_entries(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_work_entries_user_id ON work_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_work_entries_date ON work_entries(date);
    CREATE INDEX IF NOT EXISTS idx_payments_farmer_id ON payments(farmer_id);
    CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_user_id ON expenses(user_id);
    CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date);
    CREATE INDEX IF NOT EXISTS idx_expenses_type ON expenses(expense_type);
    CREATE INDEX IF NOT EXISTS idx_sync_status_farmers ON farmers(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_status_farms ON farms(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_status_work ON work_entries(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_status_payments ON payments(sync_status);
    CREATE INDEX IF NOT EXISTS idx_sync_status_expenses ON expenses(sync_status);
  `);

  // --- Migrations for existing databases ---
  await runMigration(db, 'ALTER TABLE work_entries ADD COLUMN farm_name TEXT');
  await runMigration(db, 'ALTER TABLE work_entries ADD COLUMN migrated INTEGER DEFAULT 0');
  await runMigration(db, 'ALTER TABLE users ADD COLUMN email TEXT');

  // --- Seed default work types (INSERT OR IGNORE = safe for re-runs) ---
  const defaultTypes = [
    ['wt-ploughing', 'Ploughing', 'ખેડ', '🚜', 1],
    ['wt-rotavator', 'Rotavator', 'રોટાવેટર', '⚙️', 1],
    ['wt-seeding', 'Seeding', 'વાવણી', '🌱', 1],
    ['wt-cultivation', 'Cultivation', 'ખેતી', '🌾', 1],
    ['wt-harvesting', 'Harvesting', 'લણણી', '🌻', 1],
    ['wt-rotary', 'Rotary', 'રોટરી', '🔄', 1],
    ['wt-levelling', 'Levelling', 'લેવલિંગ', '📐', 1],
    ['wt-other', 'Other', 'અન્ય', '📋', 1],
  ] as const;

  for (const [id, name, nameGu, emoji, isDefault] of defaultTypes) {
    await db.runAsync(
      `INSERT OR IGNORE INTO work_types (id, name, name_gu, emoji, is_default) VALUES (?, ?, ?, ?, ?)`,
      [id, name, nameGu, emoji, isDefault],
    );
  }
}

/**
 * Work type enum values
 */
export const WORK_TYPES = [
  'Ploughing',
  'Rotavator',
  'Seeding',
  'Cultivation',
  'Harvesting',
  'Other',
] as const;

export type WorkType = typeof WORK_TYPES[number];

/**
 * Quantity unit options
 */
export const QUANTITY_UNITS = ['acres', 'hours'] as const;
export type QuantityUnit = typeof QUANTITY_UNITS[number];

/**
 * Sync status
 */
export type SyncStatus = 'synced' | 'pending' | 'conflict';

/**
 * Type definitions for database records
 */
export interface Farmer {
  id: string;
  user_id: string;
  name: string;
  mobile: string;
  village: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_deleted: number;
  sync_status: SyncStatus;
}

export interface FarmerWithDues extends Farmer {
  total_work_amount: number;
  total_paid: number;
  remaining_due: number;
  farm_count: number;
}

export interface Farm {
  id: string;
  farmer_id: string;
  user_id: string;
  name: string;
  location: string | null;
  area_acres: number | null;
  notes: string | null;
  created_at: string;
  is_deleted: number;
  sync_status: SyncStatus;
}

export interface WorkEntry {
  id: string;
  user_id: string;
  farmer_id: string | null;
  farm_name: string | null;
  date: string;
  work_type: WorkType;
  quantity: number | null;
  quantity_unit: QuantityUnit | null;
  rate: number;
  total_amount: number;
  notes: string | null;
  whatsapp_sent: number;
  created_at: string;
  is_deleted: number;
  sync_status: SyncStatus;
  // Joined fields
  farmer_name?: string;
}

export interface Payment {
  id: string;
  user_id: string;
  farmer_id: string | null;
  amount: number;
  payment_date: string;
  notes: string | null;
  whatsapp_sent: number;
  created_at: string;
  is_deleted: number;
  sync_status: SyncStatus;
  // Joined fields
  farmer_name?: string;
}

export interface DashboardStats {
  totalFarmers: number;
  totalFarms: number;
  totalDue: number;
  farmersWithDues: number;
  todayWorkEntries: WorkEntry[];
  todayTotal: number;
}

// ---------------------------------------------------------------------------
// Data Management — Clear & Sync Helpers
// ---------------------------------------------------------------------------

/**
 * Clear all user-owned data from local SQLite.
 * Called on logout to prevent data leaking to next user on same device.
 * Keeps default work_types (is_default = 1) intact since they're shared/global.
 */
export async function clearAllLocalData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    DELETE FROM work_entries;
    DELETE FROM payments;
    DELETE FROM expenses;
    DELETE FROM farms;
    DELETE FROM farmers;
    DELETE FROM users;
    DELETE FROM work_types WHERE is_default = 0;
  `);
  console.log('[Database] All local user data cleared');
}

/**
 * Count rows with sync_status = 'pending' across all user tables.
 * Used to warn users before logout if they have unsynced data.
 */
export async function getPendingSyncCount(db: SQLiteDatabase): Promise<number> {
  const tables = ['work_entries', 'farmers', 'farms', 'payments', 'expenses'];
  let total = 0;
  for (const table of tables) {
    try {
      const result = await db.getFirstAsync<{ count: number }>(
        `SELECT COUNT(*) as count FROM ${table} WHERE sync_status = 'pending'`
      );
      total += result?.count || 0;
    } catch {
      // Table might not exist yet, skip
    }
  }
  return total;
}
