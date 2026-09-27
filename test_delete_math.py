import os
import sys
import asyncio
import sqlite3
import shutil

DB_PATH = 'test_delete_math.db'

def setup_db():
    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute('''CREATE TABLE farmers (id TEXT PRIMARY KEY, user_id TEXT, name TEXT, is_deleted INTEGER DEFAULT 0, updated_at TEXT, sync_status TEXT)''')
    c.execute('''CREATE TABLE work_entries (id TEXT PRIMARY KEY, user_id TEXT, farmer_id TEXT, total_amount REAL, discount_amount REAL, is_deleted INTEGER DEFAULT 0)''')
    c.execute('''CREATE TABLE payments (id TEXT PRIMARY KEY, user_id TEXT, farmer_id TEXT, amount REAL, discount_amount REAL, is_deleted INTEGER DEFAULT 0)''')
    conn.commit()
    return conn

def check_delete(conn, farmer_id):
    c = conn.cursor()
    
    # Run the exact query from useFarmersStore
    c.execute('''
        SELECT
           COALESCE(w.total_work, 0) - COALESCE(w.total_work_discount, 0) - COALESCE(p.total_paid, 0) - COALESCE(p.total_payment_discount, 0) AS remaining_due
         FROM farmers f
         LEFT JOIN (
           SELECT farmer_id, SUM(total_amount) AS total_work, SUM(COALESCE(discount_amount, 0)) AS total_work_discount
           FROM work_entries
           WHERE is_deleted = 0 AND farmer_id = ?
         ) w ON w.farmer_id = f.id
         LEFT JOIN (
           SELECT farmer_id, SUM(amount) AS total_paid, SUM(COALESCE(discount_amount, 0)) AS total_payment_discount
           FROM payments
           WHERE is_deleted = 0 AND farmer_id = ?
         ) p ON p.farmer_id = f.id
         WHERE f.id = ?
    ''', (farmer_id, farmer_id, farmer_id))
    
    row = c.fetchone()
    due = row[0] if row and row[0] is not None else 0
    
    if abs(due) > 0.01:
        if due > 0:
            return f"BLOCKED: > 0 (due: {due})"
        else:
            return f"BLOCKED: < 0 (due: {due})"
    
    return f"ALLOWED (due: {due})"

def test():
    conn = setup_db()
    c = conn.cursor()
    
    # Farmer A: work 30000, discount 2000, payments 8000, due 20000 -> blocked
    c.execute("INSERT INTO farmers (id, user_id, name) VALUES ('A', 'u1', 'Farmer A')")
    c.execute("INSERT INTO work_entries (id, user_id, farmer_id, total_amount, discount_amount) VALUES ('w1', 'u1', 'A', 30000, 2000)")
    c.execute("INSERT INTO payments (id, user_id, farmer_id, amount, discount_amount) VALUES ('p1', 'u1', 'A', 8000, 0)")
    
    # Farmer B: work 10000, payments 10000, due 0 -> allowed
    c.execute("INSERT INTO farmers (id, user_id, name) VALUES ('B', 'u1', 'Farmer B')")
    c.execute("INSERT INTO work_entries (id, user_id, farmer_id, total_amount, discount_amount) VALUES ('w2', 'u1', 'B', 10000, 0)")
    c.execute("INSERT INTO payments (id, user_id, farmer_id, amount, discount_amount) VALUES ('p2', 'u1', 'B', 10000, 0)")
    
    # Farmer C: work 10000, payments 10500, due -500 -> blocked
    c.execute("INSERT INTO farmers (id, user_id, name) VALUES ('C', 'u1', 'Farmer C')")
    c.execute("INSERT INTO work_entries (id, user_id, farmer_id, total_amount, discount_amount) VALUES ('w3', 'u1', 'C', 10000, 0)")
    c.execute("INSERT INTO payments (id, user_id, farmer_id, amount, discount_amount) VALUES ('p3', 'u1', 'C', 10500, 0)")
    
    conn.commit()
    
    print("Farmer A:", check_delete(conn, 'A'))
    print("Farmer B:", check_delete(conn, 'B'))
    print("Farmer C:", check_delete(conn, 'C'))
    
    conn.close()

if __name__ == '__main__':
    test()
