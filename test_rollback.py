"""
Test script for failure injection and rollback verification.
WARNING: Runs against SUPABASE_DB_URL. Do NOT run against production.
Use a dedicated test/staging database.
"""
import asyncio
import os
import psycopg2

def run_rollback_test():
    url = os.environ.get('SUPABASE_DB_URL')
    if not url:
        print("Test skipped: SUPABASE_DB_URL not defined. Run this locally to verify rollback.")
        return

    setup_conn = psycopg2.connect(url)
    setup_conn.autocommit = True
    cur = setup_conn.cursor()
    
    # 1. Create a mock RPC that simulates a failure during wallet transaction creation
    mock_rpc_sql = """
    CREATE OR REPLACE FUNCTION public.test_redeem_fail() RETURNS void AS $$
    BEGIN
      -- Do something
      UPDATE public.activation_codes SET is_used = TRUE WHERE code = 'TESTFAIL';
      
      -- Simulate failure
      RAISE EXCEPTION 'SIMULATED_WALLET_FAILURE';
    END;
    $$ LANGUAGE plpgsql;
    """
    cur.execute(mock_rpc_sql)
    
    cur.execute("INSERT INTO public.users (id, phone, wallet_balance) VALUES ('22222222-2222-2222-2222-222222222222', '+910000000001', 100) ON CONFLICT (id) DO NOTHING;")
    cur.execute("INSERT INTO public.activation_codes (code, is_used) VALUES ('TESTFAIL', false) ON CONFLICT (code) DO UPDATE SET is_used = false;")
    
    # 2. Try the failing RPC
    try:
        cur_test = setup_conn.cursor()
        # In a real scenario, this happens inside a transaction block in plpgsql or psycopg2 transaction
        setup_conn.autocommit = False
        cur_test.execute("SELECT public.test_redeem_fail();")
        setup_conn.commit()
    except Exception as e:
        setup_conn.rollback()
        print(f"Caught simulated failure: {e}")
    finally:
        setup_conn.autocommit = True

    # 3. Verify state
    cur.execute("SELECT is_used FROM public.activation_codes WHERE code = 'TESTFAIL';")
    is_used = cur.fetchone()[0]
    
    assert is_used == False, "Rollback failed! Code was marked used."
    print("FAILURE ROLLBACK TEST: PASS")
    
    # Teardown — delete children before parent, then drop test function
    cur.execute("DELETE FROM public.wallet_transactions WHERE user_id = '22222222-2222-2222-2222-222222222222';")
    cur.execute("DELETE FROM public.activation_codes WHERE code = 'TESTFAIL';")
    cur.execute("DELETE FROM public.users WHERE id = '22222222-2222-2222-2222-222222222222';")
    cur.execute("DROP FUNCTION IF EXISTS public.test_redeem_fail();")
    setup_conn.close()

if __name__ == "__main__":
    run_rollback_test()
