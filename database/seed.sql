-- ============================================================================
-- TRACTOR LEDGER - Seed Data
-- Test data for development with 3 farmers from Gujarat villages
--
-- NOTE: Replace the user UUID below with your actual Supabase auth user ID.
-- You can find it in the Supabase Dashboard -> Authentication -> Users
-- ============================================================================

-- ---- Test User (Tractor Owner) ----
-- Replace this UUID with your actual auth.users.id from Supabase
DO $$
DECLARE
    v_user_id UUID := '00000000-0000-0000-0000-000000000001';  -- REPLACE with real user ID

    -- Farmer IDs
    v_ramesh_id UUID := 'a1b2c3d4-e5f6-7890-abcd-100000000001';
    v_suresh_id UUID := 'a1b2c3d4-e5f6-7890-abcd-100000000002';
    v_bharat_id UUID := 'a1b2c3d4-e5f6-7890-abcd-100000000003';

    -- Farm IDs
    v_ramesh_farm1 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000001';
    v_ramesh_farm2 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000002';
    v_suresh_farm1 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000003';
    v_suresh_farm2 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000004';
    v_bharat_farm1 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000005';
    v_bharat_farm2 UUID := 'b1b2c3d4-e5f6-7890-abcd-200000000006';

BEGIN

-- ============================================================================
-- Insert User
-- ============================================================================
INSERT INTO public.users (id, phone, name, created_at)
VALUES (v_user_id, '+919876543210', 'Vijay Patel', NOW())
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- ============================================================================
-- Insert Farmers
-- ============================================================================
INSERT INTO public.farmers (id, user_id, name, mobile, village, notes, created_at) VALUES
    (v_ramesh_id, v_user_id, 'Ramesh Patel', '+919898123001', 'Karjan',
     'Regular customer, has cotton and wheat fields', NOW() - INTERVAL '90 days'),
    (v_suresh_id, v_user_id, 'Suresh Desai', '+919898123002', 'Padra',
     'Large farm owner, seasonal work', NOW() - INTERVAL '60 days'),
    (v_bharat_id, v_user_id, 'Bharat Solanki', '+919898123003', 'Dabhoi',
     'New customer since last season', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Insert Farms
-- ============================================================================
INSERT INTO public.farms (id, farmer_id, user_id, name, location, area_acres, notes, created_at) VALUES
    -- Ramesh Patel's farms (Karjan)
    (v_ramesh_farm1, v_ramesh_id, v_user_id, 'Cotton Field - North',
     'Near Karjan Canal, North Road', 5.5, 'Black soil, good for cotton', NOW() - INTERVAL '90 days'),
    (v_ramesh_farm2, v_ramesh_id, v_user_id, 'Wheat Field - South',
     'Behind Karjan Temple, South', 3.0, 'Sandy loam soil', NOW() - INTERVAL '85 days'),

    -- Suresh Desai's farms (Padra)
    (v_suresh_farm1, v_suresh_id, v_user_id, 'Big Farm',
     'Padra-Dabhoi Highway, KM 5', 12.0, 'Main farm, all crops', NOW() - INTERVAL '60 days'),
    (v_suresh_farm2, v_suresh_id, v_user_id, 'Orchard Plot',
     'Near Padra Railway Station', 2.5, 'Mango and chiku trees', NOW() - INTERVAL '55 days'),

    -- Bharat Solanki's farms (Dabhoi)
    (v_bharat_farm1, v_bharat_id, v_user_id, 'Main Field',
     'Dabhoi Fort Area, East Side', 8.0, 'Rice and vegetables', NOW() - INTERVAL '30 days'),
    (v_bharat_farm2, v_bharat_id, v_user_id, 'Riverside Plot',
     'Near Orsang River, Dabhoi', 4.0, 'Seasonal flooding area', NOW() - INTERVAL '25 days')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- Insert Work Entries
-- ============================================================================

-- ---- Ramesh Patel - Work Entries (Karjan) ----
INSERT INTO public.work_entries
    (id, user_id, farmer_id, farm_id, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm1,
     CURRENT_DATE - INTERVAL '80 days', 'Ploughing', 5.5, 'acres', 1200.00, 6600.00,
     'Deep ploughing for cotton', TRUE, NOW() - INTERVAL '80 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm1,
     CURRENT_DATE - INTERVAL '75 days', 'Rotavator', 5.5, 'acres', 800.00, 4400.00,
     'Soil preparation after ploughing', TRUE, NOW() - INTERVAL '75 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm2,
     CURRENT_DATE - INTERVAL '60 days', 'Ploughing', 3.0, 'acres', 1200.00, 3600.00,
     'Wheat field preparation', FALSE, NOW() - INTERVAL '60 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm2,
     CURRENT_DATE - INTERVAL '55 days', 'Seeding', 3.0, 'acres', 1500.00, 4500.00,
     'Wheat seeding with new machine', TRUE, NOW() - INTERVAL '55 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm1,
     CURRENT_DATE - INTERVAL '20 days', 'Cultivation', 5.5, 'hours', 600.00, 3300.00,
     'Inter-cultivation for cotton', FALSE, NOW() - INTERVAL '20 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id, v_ramesh_farm2,
     CURRENT_DATE - INTERVAL '5 days', 'Harvesting', 3.0, 'acres', 2000.00, 6000.00,
     'Wheat harvesting', TRUE, NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- ---- Suresh Desai - Work Entries (Padra) ----
INSERT INTO public.work_entries
    (id, user_id, farmer_id, farm_id, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_suresh_id, v_suresh_farm1,
     CURRENT_DATE - INTERVAL '50 days', 'Ploughing', 12.0, 'acres', 1200.00, 14400.00,
     'Full farm ploughing - big job', TRUE, NOW() - INTERVAL '50 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id, v_suresh_farm1,
     CURRENT_DATE - INTERVAL '45 days', 'Rotavator', 12.0, 'acres', 800.00, 9600.00,
     'Rotavator after ploughing', TRUE, NOW() - INTERVAL '45 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id, v_suresh_farm1,
     CURRENT_DATE - INTERVAL '40 days', 'Seeding', 12.0, 'acres', 1500.00, 18000.00,
     'Cotton seeding - full farm', FALSE, NOW() - INTERVAL '40 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id, v_suresh_farm2,
     CURRENT_DATE - INTERVAL '30 days', 'Ploughing', 2.5, 'acres', 1200.00, 3000.00,
     'Light ploughing around trees', TRUE, NOW() - INTERVAL '30 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id, v_suresh_farm1,
     CURRENT_DATE - INTERVAL '10 days', 'Cultivation', 8.0, 'hours', 600.00, 4800.00,
     'Inter-cultivation work', FALSE, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- ---- Bharat Solanki - Work Entries (Dabhoi) ----
INSERT INTO public.work_entries
    (id, user_id, farmer_id, farm_id, date, work_type, quantity, quantity_unit, rate, total_amount, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_bharat_id, v_bharat_farm1,
     CURRENT_DATE - INTERVAL '25 days', 'Ploughing', 8.0, 'acres', 1200.00, 9600.00,
     'First ploughing for rice season', TRUE, NOW() - INTERVAL '25 days'),

    (uuid_generate_v4(), v_user_id, v_bharat_id, v_bharat_farm1,
     CURRENT_DATE - INTERVAL '20 days', 'Rotavator', 8.0, 'acres', 800.00, 6400.00,
     'Paddy field preparation', TRUE, NOW() - INTERVAL '20 days'),

    (uuid_generate_v4(), v_user_id, v_bharat_id, v_bharat_farm2,
     CURRENT_DATE - INTERVAL '15 days', 'Ploughing', 4.0, 'acres', 1200.00, 4800.00,
     'Riverside plot ploughing', FALSE, NOW() - INTERVAL '15 days'),

    (uuid_generate_v4(), v_user_id, v_bharat_id, v_bharat_farm1,
     CURRENT_DATE - INTERVAL '7 days', 'Seeding', 8.0, 'acres', 1500.00, 12000.00,
     'Rice transplanting support', TRUE, NOW() - INTERVAL '7 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Insert Payments
-- ============================================================================

-- ---- Ramesh Patel - Payments ----
-- Total work: ₹28,400 | Total paid: ₹18,000 | Due: ₹10,400
INSERT INTO public.payments
    (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_ramesh_id,
     10000.00, CURRENT_DATE - INTERVAL '70 days',
     'Advance payment for ploughing work', TRUE, NOW() - INTERVAL '70 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id,
     5000.00, CURRENT_DATE - INTERVAL '40 days',
     'Partial payment', TRUE, NOW() - INTERVAL '40 days'),

    (uuid_generate_v4(), v_user_id, v_ramesh_id,
     3000.00, CURRENT_DATE - INTERVAL '10 days',
     'Cash payment at market', FALSE, NOW() - INTERVAL '10 days')
ON CONFLICT DO NOTHING;

-- ---- Suresh Desai - Payments ----
-- Total work: ₹49,800 | Total paid: ₹30,000 | Due: ₹19,800
INSERT INTO public.payments
    (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_suresh_id,
     15000.00, CURRENT_DATE - INTERVAL '40 days',
     'First installment - big farm work', TRUE, NOW() - INTERVAL '40 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id,
     10000.00, CURRENT_DATE - INTERVAL '20 days',
     'Second installment', TRUE, NOW() - INTERVAL '20 days'),

    (uuid_generate_v4(), v_user_id, v_suresh_id,
     5000.00, CURRENT_DATE - INTERVAL '3 days',
     'Partial payment via UPI', FALSE, NOW() - INTERVAL '3 days')
ON CONFLICT DO NOTHING;

-- ---- Bharat Solanki - Payments ----
-- Total work: ₹32,800 | Total paid: ₹10,000 | Due: ₹22,800
INSERT INTO public.payments
    (id, user_id, farmer_id, amount, payment_date, notes, whatsapp_sent, created_at)
VALUES
    (uuid_generate_v4(), v_user_id, v_bharat_id,
     5000.00, CURRENT_DATE - INTERVAL '18 days',
     'Initial advance', TRUE, NOW() - INTERVAL '18 days'),

    (uuid_generate_v4(), v_user_id, v_bharat_id,
     5000.00, CURRENT_DATE - INTERVAL '5 days',
     'Cash payment', FALSE, NOW() - INTERVAL '5 days')
ON CONFLICT DO NOTHING;

-- ============================================================================
-- Summary of Seed Data
-- ============================================================================
-- Farmer          | Village | Work Amount | Paid    | Due
-- ----------------+---------+------------+---------+--------
-- Ramesh Patel    | Karjan  | ₹28,400    | ₹18,000 | ₹10,400
-- Suresh Desai    | Padra   | ₹49,800    | ₹30,000 | ₹19,800
-- Bharat Solanki  | Dabhoi  | ₹32,800    | ₹10,000 | ₹22,800
-- ----------------+---------+------------+---------+--------
-- TOTAL           |         | ₹1,11,000  | ₹58,000 | ₹53,000
-- ============================================================================

END $$;
