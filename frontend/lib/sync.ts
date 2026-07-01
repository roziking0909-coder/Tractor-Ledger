/**
 * Tractor Ledger — Two-Way Sync Service
 *
 * Syncs local SQLite tables with Supabase cloud database.
 * SQLite is the source of truth for UI (offline first).
 * Supabase acts as cloud backup and multi-device sync layer.
 */

import type { SQLiteDatabase } from 'expo-sqlite';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase';

function isDemoUser(userId: string): boolean {
  return !userId || userId === 'demo-user';
}

export async function pullFromSupabase(db: SQLiteDatabase, userId: string): Promise<void> {
  if (isDemoUser(userId) || !isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabase();

  try {
    // 1. Pull users table (just to make sure user exists locally)
    const { data: users } = await supabase.from('users').select('*').eq('id', userId);
    for (const user of users || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO users (id, phone, name, created_at, sync_status) VALUES (?, ?, ?, ?, 'synced')`,
        [user.id, user.phone, user.name || null, user.created_at]
      );
    }

    // 2. Pull farmers
    const { data: farmers } = await supabase.from('farmers').select('*').eq('user_id', userId);
    for (const farmer of farmers || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO farmers (id, user_id, name, mobile, village, notes, created_at, updated_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          farmer.id,
          farmer.user_id,
          farmer.name,
          farmer.mobile || null,
          farmer.village || null,
          farmer.notes || null,
          farmer.created_at,
          farmer.updated_at || farmer.created_at,
          farmer.is_deleted ? 1 : 0
        ]
      );
    }

    // 3. Pull farms
    const { data: farms } = await supabase.from('farms').select('*').eq('user_id', userId);
    const farmMap = new Map<string, string>(); // farm_id -> farm_name mapping
    for (const farm of farms || []) {
      farmMap.set(farm.id, farm.name);
      await db.runAsync(
        `INSERT OR REPLACE INTO farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          farm.id,
          farm.farmer_id,
          farm.user_id,
          farm.name,
          farm.location || null,
          farm.area_acres || null,
          farm.notes || null,
          farm.created_at,
          farm.is_deleted ? 1 : 0
        ]
      );
    }

    // 4. Pull work_entries
    const { data: workEntries } = await supabase.from('work_entries').select('*').eq('user_id', userId);
    for (const work of workEntries || []) {
      const farmName = work.farm_id ? farmMap.get(work.farm_id) || null : null;
      await db.runAsync(
        `INSERT OR REPLACE INTO work_entries (id, user_id, farmer_id, farm_name, date, work_type, quantity, quantity_unit, rate, total_amount, discount_amount, notes, whatsapp_sent, created_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          work.id,
          work.user_id,
          work.farmer_id || null,
          farmName,
          work.date,
          work.work_type,
          work.quantity,
          work.quantity_unit,
          work.rate,
          work.total_amount,
          work.discount_amount || 0,
          work.notes || null,
          work.whatsapp_sent ? 1 : 0,
          work.created_at,
          work.is_deleted ? 1 : 0
        ]
      );
    }

    // 5. Pull payments
    const { data: payments } = await supabase.from('payments').select('*').eq('user_id', userId);
    for (const pay of payments || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO payments (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          pay.id,
          pay.user_id,
          pay.farmer_id || null,
          pay.amount,
          pay.payment_date,
          pay.notes || null,
          pay.whatsapp_sent ? 1 : 0,
          pay.created_at,
          pay.is_deleted ? 1 : 0
        ]
      );
    }

    // 6. Pull expenses
    const { data: expenses } = await supabase.from('expenses').select('*').eq('user_id', userId);
    for (const exp of expenses || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO expenses (id, user_id, date, expense_type, custom_type, amount, quantity, unit, rate, notes, created_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          exp.id,
          exp.user_id,
          exp.date,
          exp.expense_type,
          exp.custom_type || null,
          exp.amount,
          exp.quantity || null,
          exp.unit || null,
          exp.rate || null,
          exp.notes || null,
          exp.created_at,
          exp.is_deleted ? 1 : 0
        ]
      );
    }

    // 7. Pull discounts
    const { data: discounts } = await supabase.from('discounts').select('*').eq('user_id', userId);
    for (const disc of discounts || []) {
      await db.runAsync(
        `INSERT OR REPLACE INTO discounts (id, user_id, farmer_id, amount, reason, date, created_at, is_deleted, sync_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced')`,
        [
          disc.id,
          disc.user_id,
          disc.farmer_id,
          disc.amount,
          disc.reason || null,
          disc.date,
          disc.created_at,
          disc.is_deleted ? 1 : 0
        ]
      );
    }

    console.log(`[Sync] Pulled ${farmers?.length || 0} farmers, ${farms?.length || 0} farms, ${workEntries?.length || 0} work entries, ${payments?.length || 0} payments, ${expenses?.length || 0} expenses, ${discounts?.length || 0} discounts from Supabase`);

  } catch (error) {
    console.warn('[Sync] Pull from Supabase failed:', error);
  }
}

export async function pushPendingToSupabase(db: SQLiteDatabase, userId: string): Promise<void> {
  if (isDemoUser(userId) || !isSupabaseConfigured()) {
    return;
  }

  const supabase = getSupabase();
  let pushCount = 0;

  try {
    // 1. Push farmers
    const pendingFarmers = await db.getAllAsync<any>(`SELECT * FROM farmers WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const farmer of pendingFarmers) {
      const { error } = await supabase.from('farmers').upsert({
        id: farmer.id,
        user_id: farmer.user_id,
        name: farmer.name,
        mobile: farmer.mobile,
        village: farmer.village,
        notes: farmer.notes,
        created_at: farmer.created_at,
        updated_at: farmer.updated_at,
        is_deleted: farmer.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE farmers SET sync_status = 'synced' WHERE id = ?`, [farmer.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push farmer ${farmer.id}:`, error);
      }
    }

    // 2. Push farms
    const pendingFarms = await db.getAllAsync<any>(`SELECT * FROM farms WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const farm of pendingFarms) {
      const { error } = await supabase.from('farms').upsert({
        id: farm.id,
        farmer_id: farm.farmer_id,
        user_id: farm.user_id,
        name: farm.name,
        location: farm.location,
        area_acres: farm.area_acres,
        notes: farm.notes,
        created_at: farm.created_at,
        is_deleted: farm.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE farms SET sync_status = 'synced' WHERE id = ?`, [farm.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push farm ${farm.id}:`, error);
      }
    }

    // 3. Push work entries
    const pendingWork = await db.getAllAsync<any>(`SELECT * FROM work_entries WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const work of pendingWork) {
      // Local uses farm_name, Supabase uses farm_id. To prevent FK errors, send null for farm_id
      const { error } = await supabase.from('work_entries').upsert({
        id: work.id,
        user_id: work.user_id,
        farmer_id: work.farmer_id,
        farm_id: null, // Resolving mismatch: ignore farm_id locally for push
        date: work.date,
        work_type: work.work_type,
        quantity: work.quantity,
        quantity_unit: work.quantity_unit,
        rate: work.rate,
        total_amount: work.total_amount,
        discount_amount: work.discount_amount || 0,
        notes: work.notes,
        whatsapp_sent: work.whatsapp_sent === 1,
        created_at: work.created_at,
        is_deleted: work.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE work_entries SET sync_status = 'synced' WHERE id = ?`, [work.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push work_entry ${work.id}:`, error);
      }
    }

    // 4. Push payments
    const pendingPayments = await db.getAllAsync<any>(`SELECT * FROM payments WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const pay of pendingPayments) {
      const { error } = await supabase.from('payments').upsert({
        id: pay.id,
        user_id: pay.user_id,
        farmer_id: pay.farmer_id,
        amount: pay.amount,
        payment_date: pay.payment_date,
        notes: pay.notes,
        whatsapp_sent: pay.whatsapp_sent === 1,
        created_at: pay.created_at,
        is_deleted: pay.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE payments SET sync_status = 'synced' WHERE id = ?`, [pay.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push payment ${pay.id}:`, error);
      }
    }

    // 5. Push expenses
    const pendingExpenses = await db.getAllAsync<any>(`SELECT * FROM expenses WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const exp of pendingExpenses) {
      const { error } = await supabase.from('expenses').upsert({
        id: exp.id,
        user_id: exp.user_id,
        date: exp.date,
        expense_type: exp.expense_type,
        custom_type: exp.custom_type,
        amount: exp.amount,
        quantity: exp.quantity,
        unit: exp.unit,
        rate: exp.rate,
        notes: exp.notes,
        created_at: exp.created_at,
        is_deleted: exp.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE expenses SET sync_status = 'synced' WHERE id = ?`, [exp.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push expense ${exp.id}:`, error);
      }
    }

    // 6. Push discounts
    const pendingDiscounts = await db.getAllAsync<any>(`SELECT * FROM discounts WHERE user_id = ? AND sync_status = 'pending'`, [userId]);
    for (const disc of pendingDiscounts) {
      const { error } = await supabase.from('discounts').upsert({
        id: disc.id,
        user_id: disc.user_id,
        farmer_id: disc.farmer_id,
        amount: disc.amount,
        reason: disc.reason,
        date: disc.date,
        created_at: disc.created_at,
        is_deleted: disc.is_deleted === 1
      }, { onConflict: 'id' });

      if (!error) {
        await db.runAsync(`UPDATE discounts SET sync_status = 'synced' WHERE id = ?`, [disc.id]);
        pushCount++;
      } else {
        console.warn(`[Sync] Failed to push discount ${disc.id}:`, error);
      }
    }

    if (pushCount > 0) {
      console.log(`[Sync] Pushed ${pushCount} pending records to Supabase`);
    }

  } catch (error) {
    console.warn('[Sync] Push to Supabase failed:', error);
  }
}

export async function pushSingleRecord(db: SQLiteDatabase, table: string, id: string): Promise<void> {
  // Simple wrapper that runs the full push for simplicity and safety, 
  // since the cost of checking pending rows is very low when mostly empty.
  // We can optimize this later if needed.
  try {
    const record = await db.getFirstAsync<{user_id: string}>(`SELECT user_id FROM ${table} WHERE id = ?`, [id]);
    if (record) {
      await pushPendingToSupabase(db, record.user_id);
    }
  } catch (error) {
    console.warn(`[Sync] Single record push failed for ${table} ${id}:`, error);
  }
}
