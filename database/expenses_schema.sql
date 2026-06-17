-- Tractor Ledger - Expenses Table (Supabase)
-- Run this in the Supabase SQL Editor

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  expense_type TEXT NOT NULL CHECK (expense_type IN ('diesel','engine_oil','repair','driver_wages','other')),
  custom_type TEXT,
  amount DECIMAL(10,2) NOT NULL,
  quantity DECIMAL(8,2),
  unit TEXT,
  rate DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_deleted BOOLEAN DEFAULT FALSE
);

ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own expenses"
  ON public.expenses
  FOR ALL
  USING (user_id = auth.uid());

CREATE INDEX idx_expenses_user_date ON expenses(user_id, date);
CREATE INDEX idx_expenses_type ON expenses(expense_type);
