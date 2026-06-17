-- ============================================================================
-- TRACTOR LEDGER — Subscription + Referral System
-- Run in Supabase SQL Editor
-- ============================================================================

-- Extend users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive'
    CHECK (subscription_status IN ('inactive', 'active', 'expired')),
  ADD COLUMN IF NOT EXISTS subscription_start DATE,
  ADD COLUMN IF NOT EXISTS subscription_end DATE,
  ADD COLUMN IF NOT EXISTS referral_code TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS referred_by TEXT,
  ADD COLUMN IF NOT EXISTS wallet_balance DECIMAL(10,2) DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code ON public.users (referral_code)
  WHERE referral_code IS NOT NULL;

-- Activation codes (admin-managed)
CREATE TABLE IF NOT EXISTS public.activation_codes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  created_for_phone TEXT,
  created_by TEXT DEFAULT 'admin',
  is_used BOOLEAN DEFAULT FALSE,
  used_by_user_id UUID REFERENCES public.users(id),
  used_at TIMESTAMPTZ,
  valid_days INTEGER DEFAULT 365,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activation_codes_code ON public.activation_codes (code);
CREATE INDEX IF NOT EXISTS idx_activation_codes_phone ON public.activation_codes (created_for_phone);

-- Referral tracking
CREATE TABLE IF NOT EXISTS public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID REFERENCES public.users(id),
  referee_id UUID REFERENCES public.users(id),
  referral_code TEXT NOT NULL,
  reward_amount DECIMAL(10,2) DEFAULT 100,
  credited BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON public.referrals (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON public.referrals (referee_id);

-- Wallet transaction log
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id),
  type TEXT CHECK (type IN ('credit', 'debit')),
  amount DECIMAL(10,2),
  description TEXT,
  balance_after DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user ON public.wallet_transactions (user_id);

-- RLS
ALTER TABLE public.activation_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin only activation codes" ON public.activation_codes;
CREATE POLICY "admin only activation codes" ON public.activation_codes
  FOR ALL USING (false);

DROP POLICY IF EXISTS "own referrals" ON public.referrals;
CREATE POLICY "own referrals" ON public.referrals
  FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());

DROP POLICY IF EXISTS "own wallet transactions" ON public.wallet_transactions;
CREATE POLICY "own wallet transactions" ON public.wallet_transactions
  FOR SELECT USING (user_id = auth.uid());

GRANT ALL ON public.activation_codes TO service_role;
GRANT SELECT ON public.referrals TO authenticated;
GRANT SELECT ON public.wallet_transactions TO authenticated;
