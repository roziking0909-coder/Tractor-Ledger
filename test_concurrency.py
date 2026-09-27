"""
Test script for concurrent activation code redemption.
Run this against a local/development database using psycopg2 or asyncpg.
"""
import asyncio
import os
import psycopg2
from psycopg2.extensions import ISOLATION_LEVEL_READ_COMMITTED

def run_concurrent_test():
    url = os.environ.get('SUPABASE_DB_URL')
    if not url:
        print("Test skipped: SUPABASE_DB_URL not defined. Run this locally to verify concurrency.")
        return

    # Setup a dummy user and code in the database for testing
    setup_conn = psycopg2.connect(url)
    setup_conn.autocommit = True
    cur = setup_conn.cursor()
    
    # Create test user
    cur.execute("INSERT INTO public.users (id, phone, wallet_balance) VALUES ('11111111-1111-1111-1111-111111111111', '+910000000000', 100) ON CONFLICT (id) DO NOTHING;")
    # Create test code
    cur.execute("INSERT INTO public.activation_codes (code, is_used) VALUES ('TESTCONCURRENCY', false) ON CONFLICT (code) DO UPDATE SET is_used = false;")
    
    setup_conn.close()

    print("Setup complete. Launching concurrent RPC calls...")

    # Function for concurrent call
    def call_rpc(thread_id):
        conn = psycopg2.connect(url)
        conn.set_isolation_level(ISOLATION_LEVEL_READ_COMMITTED)
        try:
            with conn.cursor() as cursor:
                # The RPC will block on FOR UPDATE if another thread has it locked
                cursor.execute("SELECT public.redeem_activation_code('11111111-1111-1111-1111-111111111111', 'TESTCONCURRENCY');")
                conn.commit()
                return (thread_id, "SUCCESS")
        except Exception as e:
            conn.rollback()
            return (thread_id, str(e))
        finally:
            conn.close()

    import concurrent.futures
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        f1 = executor.submit(call_rpc, 1)
        f2 = executor.submit(call_rpc, 2)
        results = [f1.result(), f2.result()]

    success_count = 0
    already_used_count = 0
    
    for r in results:
        print(f"Thread {r[0]} result: {r[1]}")
        if "SUCCESS" in r[1]:
            success_count += 1
        if "CODE_ALREADY_USED" in r[1]:
            already_used_count += 1

    assert success_count == 1, f"Expected exactly 1 success, got {success_count}"
    assert already_used_count == 1, f"Expected exactly 1 CODE_ALREADY_USED error, got {already_used_count}"
    
    print("CONCURRENT REDEMPTION TEST: PASS")
    
    # Teardown — must delete children before parent due to FK constraints
    setup_conn = psycopg2.connect(url)
    setup_conn.autocommit = True
    cur = setup_conn.cursor()
    cur.execute("DELETE FROM public.wallet_transactions WHERE user_id = '11111111-1111-1111-1111-111111111111';")
    cur.execute("DELETE FROM public.activation_codes WHERE code = 'TESTCONCURRENCY';")
    cur.execute("DELETE FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111';")
    setup_conn.close()


if __name__ == "__main__":
    run_concurrent_test()
