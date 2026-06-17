-- ============================================================================
-- TRACTOR LEDGER - Complete PostgreSQL Schema
-- For Supabase (PostgreSQL with RLS)
-- ============================================================================

-- Enable UUID extension (usually enabled by default on Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLE: users
-- Core user table, linked to Supabase Auth (auth.users)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.users (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone       TEXT NOT NULL,
    name        TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.users IS 'Tractor owners who use the app';

CREATE INDEX IF NOT EXISTS idx_users_phone ON public.users (phone);

-- ============================================================================
-- TABLE: farmers
-- Farmers who hire the tractor owner for field work
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.farmers (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    mobile      TEXT,
    village     TEXT,
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ,
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.farmers IS 'Farmers who hire the tractor owner';

CREATE INDEX IF NOT EXISTS idx_farmers_user_id ON public.farmers (user_id);
CREATE INDEX IF NOT EXISTS idx_farmers_user_active ON public.farmers (user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_farmers_name ON public.farmers (user_id, name);
CREATE INDEX IF NOT EXISTS idx_farmers_village ON public.farmers (user_id, village);

-- ============================================================================
-- TABLE: farms
-- Individual farms/fields belonging to farmers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.farms (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    farmer_id   UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name        TEXT NOT NULL,
    location    TEXT,
    area_acres  NUMERIC(10, 2),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted  BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.farms IS 'Individual farms/fields belonging to farmers';

CREATE INDEX IF NOT EXISTS idx_farms_user_id ON public.farms (user_id);
CREATE INDEX IF NOT EXISTS idx_farms_farmer_id ON public.farms (farmer_id);
CREATE INDEX IF NOT EXISTS idx_farms_user_active ON public.farms (user_id) WHERE is_deleted = FALSE;

-- ============================================================================
-- TABLE: work_entries
-- Records of tractor work performed for farmers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.work_entries (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    farmer_id       UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    farm_id         UUID REFERENCES public.farms(id) ON DELETE SET NULL,
    date            DATE NOT NULL,
    work_type       TEXT NOT NULL CHECK (work_type IN (
                        'Ploughing', 'Rotavator', 'Seeding',
                        'Cultivation', 'Harvesting', 'Other'
                    )),
    quantity        NUMERIC(10, 2) NOT NULL,
    quantity_unit   TEXT NOT NULL CHECK (quantity_unit IN ('hours', 'acres')),
    rate            NUMERIC(12, 2) NOT NULL,
    total_amount    NUMERIC(12, 2) NOT NULL,
    notes           TEXT,
    whatsapp_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.work_entries IS 'Records of tractor work done for farmers';

CREATE INDEX IF NOT EXISTS idx_work_entries_user_id ON public.work_entries (user_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_farmer_id ON public.work_entries (farmer_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_farm_id ON public.work_entries (farm_id);
CREATE INDEX IF NOT EXISTS idx_work_entries_date ON public.work_entries (user_id, date);
CREATE INDEX IF NOT EXISTS idx_work_entries_user_active ON public.work_entries (user_id) WHERE is_deleted = FALSE;
CREATE INDEX IF NOT EXISTS idx_work_entries_work_type ON public.work_entries (user_id, work_type);

-- ============================================================================
-- TABLE: payments
-- Payments received from farmers
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.payments (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    farmer_id       UUID NOT NULL REFERENCES public.farmers(id) ON DELETE CASCADE,
    amount          NUMERIC(12, 2) NOT NULL,
    payment_date    DATE NOT NULL,
    notes           TEXT,
    whatsapp_sent   BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    is_deleted      BOOLEAN NOT NULL DEFAULT FALSE
);

COMMENT ON TABLE public.payments IS 'Payments received from farmers';

CREATE INDEX IF NOT EXISTS idx_payments_user_id ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_farmer_id ON public.payments (farmer_id);
CREATE INDEX IF NOT EXISTS idx_payments_date ON public.payments (user_id, payment_date);
CREATE INDEX IF NOT EXISTS idx_payments_user_active ON public.payments (user_id) WHERE is_deleted = FALSE;

-- ============================================================================
-- VIEW: farmer_dues
-- Aggregated view showing total work, payments, and remaining balance per farmer
-- ============================================================================
CREATE OR REPLACE VIEW public.farmer_dues AS
SELECT
    f.id                AS farmer_id,
    f.user_id           AS user_id,
    f.name              AS farmer_name,
    f.mobile            AS mobile,
    f.village           AS village,
    COALESCE(w.total_work_amount, 0)    AS total_work_amount,
    COALESCE(p.total_paid, 0)           AS total_paid,
    COALESCE(w.total_work_amount, 0) - COALESCE(p.total_paid, 0) AS remaining_due
FROM
    public.farmers f
LEFT JOIN (
    SELECT
        farmer_id,
        SUM(total_amount) AS total_work_amount
    FROM public.work_entries
    WHERE is_deleted = FALSE
    GROUP BY farmer_id
) w ON f.id = w.farmer_id
LEFT JOIN (
    SELECT
        farmer_id,
        SUM(amount) AS total_paid
    FROM public.payments
    WHERE is_deleted = FALSE
    GROUP BY farmer_id
) p ON f.id = p.farmer_id
WHERE
    f.is_deleted = FALSE;

COMMENT ON VIEW public.farmer_dues IS 'Aggregated dues per farmer: total work minus total paid';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- Users can only access their own data
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farmers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.farms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ---- users table policies ----
CREATE POLICY "Users can view own profile"
    ON public.users FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON public.users FOR UPDATE
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON public.users FOR INSERT
    WITH CHECK (id = auth.uid());

-- ---- farmers table policies ----
CREATE POLICY "Users can view own farmers"
    ON public.farmers FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own farmers"
    ON public.farmers FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own farmers"
    ON public.farmers FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own farmers"
    ON public.farmers FOR DELETE
    USING (user_id = auth.uid());

-- ---- farms table policies ----
CREATE POLICY "Users can view own farms"
    ON public.farms FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own farms"
    ON public.farms FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own farms"
    ON public.farms FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own farms"
    ON public.farms FOR DELETE
    USING (user_id = auth.uid());

-- ---- work_entries table policies ----
CREATE POLICY "Users can view own work entries"
    ON public.work_entries FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own work entries"
    ON public.work_entries FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own work entries"
    ON public.work_entries FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own work entries"
    ON public.work_entries FOR DELETE
    USING (user_id = auth.uid());

-- ---- payments table policies ----
CREATE POLICY "Users can view own payments"
    ON public.payments FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own payments"
    ON public.payments FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own payments"
    ON public.payments FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own payments"
    ON public.payments FOR DELETE
    USING (user_id = auth.uid());

-- ============================================================================
-- GRANT permissions to authenticated users (Supabase roles)
-- ============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.farmer_dues TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated, service_role;
