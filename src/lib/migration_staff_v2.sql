-- ============================================================
-- BOMBAY BETHAK: ADDITIVE MIGRATION (Staff HR & Salary V2)
-- SAFE: Only adds new tables / columns. Never drops or renames.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. Alter workers table
ALTER TABLE workers ADD COLUMN IF NOT EXISTS staff_code TEXT UNIQUE;
ALTER TABLE workers ADD COLUMN IF NOT EXISTS required_hours_per_day NUMERIC(4,2) DEFAULT 8;

-- 2. Alter salary_records table
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS bonus NUMERIC(10,2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS manual_deduction NUMERIC(10,2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS attendance_deduction NUMERIC(10,2) DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS leaves_taken INT DEFAULT 0;
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS paid_leaves_allowed INT DEFAULT 1;

-- 3. Create attendance_log table
CREATE TABLE IF NOT EXISTS attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  date DATE NOT NULL,
  status TEXT DEFAULT 'present', -- 'present', 'absent', 'half_day'
  hours_worked NUMERIC(5,2),
  shift_id UUID REFERENCES shifts(id),
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(worker_id, date)
);
ALTER TABLE attendance_log DISABLE ROW LEVEL SECURITY;

-- 4. Create staff_khata_ledger table
CREATE TABLE IF NOT EXISTS staff_khata_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  order_id UUID REFERENCES orders(id),
  type TEXT NOT NULL, -- 'CREDIT' (purchase on khata), 'PAYMENT' (manual settlement)
  amount NUMERIC(10,2) NOT NULL,
  notes TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE staff_khata_ledger DISABLE ROW LEVEL SECURITY;

-- 5. Alter orders table to track which staff member ordered
ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_worker_id UUID REFERENCES workers(id);

-- 6. Reload postgrest schema cache
NOTIFY pgrst, 'reload schema';
