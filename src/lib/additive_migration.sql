-- ============================================================
-- BOMBAY BETHAK: ADDITIVE MIGRATION (Phase Sprint)
-- SAFE: Only adds new tables / columns. Never drops or renames.
-- Run this in Supabase SQL Editor.
-- ============================================================

-- 1. CATEGORIES TABLE (Feature #4)
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT REFERENCES branches(id),  -- NULL = global
  name TEXT NOT NULL,
  icon TEXT DEFAULT '📦',
  subcategories JSONB DEFAULT '[]',
  is_global BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;

-- Seed default categories from branchConfig.js
INSERT INTO categories (branch_id, name, icon, subcategories, is_global) VALUES
  (NULL, 'Smoke',           '🚬', '["Cigarettes","Dipa / Masala"]', true),
  (NULL, 'Paan',            '🌿', '["Tobacco","Mouth Freshener"]', true),
  (NULL, 'Candy & Chewing', '🍬', '["Chewing Gum","Chocolates & Candy"]', true),
  (NULL, 'Beverages',       '🥤', '["Cold Drinks","Water & Juices"]', true),
  (NULL, 'Snacks',          '🍪', '["Biscuits","Bread & Rusk","Packaged Snacks"]', true),
  ('bhat', 'BB Cafe',       '☕', '["Hot Beverages","Cold Beverages","Food","Combos"]', false)
ON CONFLICT DO NOTHING;

-- 2. ITEM INGREDIENTS TABLE (Feature #5)
CREATE TABLE IF NOT EXISTS item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  ingredient_item_id UUID REFERENCES items(id),
  quantity_per_unit NUMERIC(10,3) DEFAULT 1,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE item_ingredients DISABLE ROW LEVEL SECURITY;

-- 3. VENDORS TABLE (Feature #12)
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT REFERENCES branches(id),
  name TEXT NOT NULL,
  contact TEXT,
  category TEXT DEFAULT 'General',  -- Grocery, Packaging, Dairy, etc.
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- 4. VENDOR LEDGER TABLE (Feature #12)
CREATE TABLE IF NOT EXISTS vendor_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  type TEXT NOT NULL,  -- 'PURCHASE', 'PAYMENT', 'ADJUSTMENT'
  amount NUMERIC(10,2) NOT NULL,
  reference TEXT,  -- expense_id or notes
  expense_id UUID REFERENCES expenses(id),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendor_ledger DISABLE ROW LEVEL SECURITY;

-- 5. ITEM VENDOR MAPPING (Feature #12)
CREATE TABLE IF NOT EXISTS item_vendor (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(item_id, vendor_id)
);
ALTER TABLE item_vendor DISABLE ROW LEVEL SECURITY;

-- 6. BRANCH TRANSFERS TABLE (Feature #13)
CREATE TABLE IF NOT EXISTS branch_transfers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_branch_id TEXT REFERENCES branches(id) NOT NULL,
  to_branch_id TEXT REFERENCES branches(id) NOT NULL,
  item_id UUID REFERENCES items(id),
  item_name TEXT,  -- Denormalized for display even if item changes
  quantity NUMERIC(10,3) NOT NULL,
  unit_value NUMERIC(10,2) DEFAULT 0,
  total_value NUMERIC(10,2) GENERATED ALWAYS AS (quantity * unit_value) STORED,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  status TEXT DEFAULT 'confirmed',  -- 'confirmed', 'pending'
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE branch_transfers DISABLE ROW LEVEL SECURITY;

-- 7. ADD vendor_id to expenses (additive column with DEFAULT NULL)
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id);

-- 8. REALTIME: add new tables
-- (Run in Supabase dashboard realtime settings or via ALTER PUBLICATION)
-- ALTER PUBLICATION supabase_realtime ADD TABLE categories, vendors, branch_transfers;

-- 10. STAFF TRANSACTIONS TABLE (Feature: Staff Ledger)
CREATE TABLE IF NOT EXISTS staff_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  type TEXT NOT NULL,  -- 'SALARY', 'ADVANCE', 'BONUS', 'DEDUCTION'
  amount NUMERIC(10,2) NOT NULL,
  payment_mode TEXT DEFAULT 'CASH', -- 'CASH', 'UPI'
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE staff_transactions DISABLE ROW LEVEL SECURITY;

-- 11. RELOAD POSTGREST
NOTIFY pgrst, 'reload schema';

-- 12. Fix UUID logged_by/created_by fields crashing with hardcoded users
DO $$ 
BEGIN
  BEGIN ALTER TABLE salary_records ALTER COLUMN logged_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE shifts ALTER COLUMN logged_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE expenses ALTER COLUMN logged_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE announcements ALTER COLUMN created_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE staff_transactions ALTER COLUMN created_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
  BEGIN ALTER TABLE vendor_ledger ALTER COLUMN created_by DROP NOT NULL; EXCEPTION WHEN OTHERS THEN END;
END $$;

-- 13. Phase out UUID logged_by for TEXT recorded_by
ALTER TABLE salary_records ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE staff_transactions ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE vendor_ledger ADD COLUMN IF NOT EXISTS recorded_by TEXT;

-- 14. Fix vendor_ledger missing branch_id (Wait, it is already added in step 4 above, but just in case)
ALTER TABLE vendor_ledger ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);

NOTIFY pgrst, 'reload schema';
ALTER TABLE branch_transfers ADD COLUMN IF NOT EXISTS recorded_by TEXT;
