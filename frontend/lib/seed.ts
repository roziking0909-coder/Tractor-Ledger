/**
 * Tractor Ledger — Seed Data
 * 
 * Test data for first install. Inserts sample farmers, farms,
 * work entries, and payments into SQLite.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { generateUUID } from './format';

// Fixed UUIDs for seed data so we can reference them
const USER_ID = 'seed-user-001';
const RAMESH_ID = 'seed-farmer-ramesh';
const SURESH_ID = 'seed-farmer-suresh';
const BHARAT_ID = 'seed-farmer-bharat';
const EAST_FIELD_ID = 'seed-farm-east-field';
const MANGO_WADI_ID = 'seed-farm-mango-wadi';
const MAIN_FARM_ID = 'seed-farm-main-farm';
const BHARAT_FARM_ID = 'seed-farm-bharat-farm';

export async function seedDatabase(db: SQLiteDatabase, userId: string): Promise<void> {
  // ONLY seed for demo mode, never for real users
  if (userId !== 'demo-user') {
    return;
  }

  // For demo — always clear and re-seed fresh so it resets every time
  await db.execAsync(`
    DELETE FROM work_entries WHERE user_id = 'demo-user';
    DELETE FROM payments WHERE user_id = 'demo-user';
    DELETE FROM expenses WHERE user_id = 'demo-user';
    DELETE FROM farms WHERE user_id = 'demo-user';
    DELETE FROM farmers WHERE user_id = 'demo-user';
  `);

  const actualUserId = userId || USER_ID;
  const now = new Date().toISOString();

  // Insert the demo user FIRST (required by foreign key constraints)
  const existingUser = await db.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM users WHERE id = ?',
    [actualUserId]
  );
  if (!existingUser || existingUser.count === 0) {
    await db.runAsync(
      `INSERT INTO users (id, phone, name, sync_status) VALUES (?, ?, ?, 'synced')`,
      [actualUserId, '9999999999', 'Demo Owner']
    );
  }
  await db.runAsync(
    `INSERT INTO farmers (id, user_id, name, mobile, village, notes, created_at, updated_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [RAMESH_ID, actualUserId, 'Ramesh Patel', '9876543210', 'Karjan', 'Regular customer', now, now]
  );

  await db.runAsync(
    `INSERT INTO farmers (id, user_id, name, mobile, village, notes, created_at, updated_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [SURESH_ID, actualUserId, 'Suresh Desai', '9712345678', 'Padra', 'Large farm owner', now, now]
  );

  await db.runAsync(
    `INSERT INTO farmers (id, user_id, name, mobile, village, notes, created_at, updated_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [BHARAT_ID, actualUserId, 'Bharat Solanki', '9638527410', 'Dabhoi', '', now, now]
  );

  // Insert farms
  await db.runAsync(
    `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [EAST_FIELD_ID, RAMESH_ID, actualUserId, 'East Field', 'Karjan', 5.0, '', now]
  );

  await db.runAsync(
    `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [MANGO_WADI_ID, RAMESH_ID, actualUserId, 'Mango Wadi', 'Karjan', 2.5, '', now]
  );

  await db.runAsync(
    `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [MAIN_FARM_ID, SURESH_ID, actualUserId, 'Main Farm', 'Padra', 8.0, '', now]
  );

  await db.runAsync(
    `INSERT INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 'synced')`,
    [BHARAT_FARM_ID, BHARAT_ID, actualUserId, 'North Plot', 'Dabhoi', 4.0, '', now]
  );

  // Insert work entries
  await db.runAsync(
    `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, RAMESH_ID, 'East Field', '2025-06-01', 'Ploughing', 5.0, 'acres', 800, 4000, '', now]
  );

  await db.runAsync(
    `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, RAMESH_ID, 'Mango Wadi', '2025-06-08', 'Seeding', 2.5, 'acres', 600, 1500, '', now]
  );

  await db.runAsync(
    `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, SURESH_ID, 'Main Farm', '2025-06-03', 'Rotavator', 4.0, 'hours', 700, 2800, '', now]
  );

  await db.runAsync(
    `INSERT INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, BHARAT_ID, 'North Plot', '2025-06-10', 'Cultivation', 4.0, 'acres', 650, 2600, '', now]
  );

  // Insert payments
  await db.runAsync(
    `INSERT INTO payments (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, RAMESH_ID, 2000, '2025-06-05', 'Partial payment', now]
  );

  await db.runAsync(
    `INSERT INTO payments (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at, is_deleted, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, 0, 'synced')`,
    [generateUUID(), actualUserId, SURESH_ID, 1000, '2025-06-07', 'Advance', now]
  );

  // Insert sample expenses
  function generateId() { return 'seed-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9); }

  await db.runAsync(
    `INSERT INTO expenses (id, user_id, date, expense_type, amount, quantity, unit, rate, notes, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
    [generateId(), actualUserId, '2025-06-02', 'diesel', 4600, 50, 'liters', 92, 'Full tank before harvest']
  );
  await db.runAsync(
    `INSERT INTO expenses (id, user_id, date, expense_type, amount, notes, sync_status)
     VALUES (?, ?, ?, ?, ?, ?, 'synced')`,
    [generateId(), actualUserId, '2025-06-05', 'driver_wages', 1500, 'Weekly wages']
  );
}
