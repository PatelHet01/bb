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

-- 16. INVENTORY LOG RECORDED_BY
ALTER TABLE inventory_log ADD COLUMN IF NOT EXISTS recorded_by TEXT;

-- 17. CUSTOMER AVATAR
ALTER TABLE customers ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 14. Fix vendor_ledger missing branch_id (Wait, it is already added in step 4 above, but just in case)
ALTER TABLE vendor_ledger ADD COLUMN IF NOT EXISTS branch_id TEXT REFERENCES branches(id);

NOTIFY pgrst, 'reload schema';
ALTER TABLE branch_transfers ADD COLUMN IF NOT EXISTS recorded_by TEXT;

-- 15. VENDOR PURCHASE ORDERS (Vendor → Inventory Auto-Link)
CREATE TABLE IF NOT EXISTS vendor_purchase_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE RESTRICT NOT NULL,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'ordered', 'received', 'cancelled'
  total_amount NUMERIC(10,2) DEFAULT 0,
  amount_paid  NUMERIC(10,2) DEFAULT 0,
  payment_mode TEXT DEFAULT 'CREDIT', -- 'CASH', 'UPI', 'CREDIT'
  invoice_ref  TEXT,
  notes        TEXT,
  received_at  TIMESTAMPTZ,
  recorded_by  TEXT,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendor_purchase_orders DISABLE ROW LEVEL SECURITY;

-- 16. VENDOR PURCHASE LINE ITEMS
CREATE TABLE IF NOT EXISTS vendor_purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_order_id UUID REFERENCES vendor_purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id UUID REFERENCES items(id) NOT NULL,
  quantity NUMERIC(10,3) NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendor_purchase_items DISABLE ROW LEVEL SECURITY;

-- 17. INVENTORY AUDIT LOG
CREATE TABLE IF NOT EXISTS inventory_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  action TEXT NOT NULL, -- 'PURCHASE_IN', 'ORDER_OUT', 'MANUAL_ADJUST', 'TRANSFER_IN', 'TRANSFER_OUT'
  qty_before NUMERIC(10,3),
  qty_change NUMERIC(10,3),
  qty_after NUMERIC(10,3),
  reference_type TEXT, -- 'vendor_purchase_order', 'order', 'manual'
  reference_id UUID,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE inventory_log DISABLE ROW LEVEL SECURITY;

-- 18. INCREMENT STOCK RPC (counterpart to decrement_stock)
CREATE OR REPLACE FUNCTION increment_stock(p_item_id UUID, p_amount NUMERIC)
RETURNS void AS $$
BEGIN
  UPDATE items
  SET stock_quantity = stock_quantity + p_amount
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';

-- 19. UNITS PER BOX — for pack-based items (cigarettes, etc.)
-- Stores how many units are in one box/pack. Default 1 = no pack logic.
ALTER TABLE items ADD COLUMN IF NOT EXISTS units_per_box INT DEFAULT 1;

NOTIFY pgrst, 'reload schema';

-- 20. ITEM TYPE FLAG — 'SELLABLE' (default) or 'RAW_MATERIAL'
ALTER TABLE items ADD COLUMN IF NOT EXISTS item_type TEXT DEFAULT 'SELLABLE';

-- 21. PACK PRICE — admin-set price for selling a whole box/pack
-- Only applies when units_per_box > 1. Single price uses existing `price` column.
ALTER TABLE items ADD COLUMN IF NOT EXISTS pack_price NUMERIC(10,2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';

-- 22. OFFERS & COMBOS (Feature #18)
CREATE TABLE IF NOT EXISTS offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT REFERENCES branches(id), -- NULL = global
  name TEXT NOT NULL,
  description TEXT,
  offer_type TEXT NOT NULL DEFAULT 'COMBO_BUNDLE',
  price NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE offers DISABLE ROW LEVEL SECURITY;

-- 23. OFFER ITEMS
CREATE TABLE IF NOT EXISTS offer_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID REFERENCES offers(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE CASCADE,
  quantity INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE offer_items DISABLE ROW LEVEL SECURITY;

NOTIFY pgrst, 'reload schema';

-- 24. MODIFY ORDER ITEMS FOR OFFERS
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS offer_id UUID REFERENCES offers(id);
ALTER TABLE order_items ALTER COLUMN item_id DROP NOT NULL;

NOTIFY pgrst, 'reload schema';

-- 25. EXPENSES PAYMENT MODE
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payment_mode TEXT DEFAULT 'CASH';
ALTER TABLE business_sessions ADD COLUMN IF NOT EXISTS total_cash_expenses NUMERIC(10,2) DEFAULT 0;

NOTIFY pgrst, 'reload schema';

-- 26. CUSTOMIZED BRANCH-WISE DAILY SEQUENTIAL ORDER NUMBERS
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  branch_char TEXT;
  date_str TEXT;
  seq_num INT;
BEGIN
  -- Get first character of branch_id
  IF NEW.branch_id IS NOT NULL THEN
    branch_char := UPPER(SUBSTRING(NEW.branch_id FROM 1 FOR 1));
  ELSE
    branch_char := 'X';
  END IF;

  -- Get date string in DDMM format in Asia/Kolkata timezone
  date_str := to_char(COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata', 'DDMM');

  -- Count how many orders exist for this branch on this local date
  SELECT COALESCE(COUNT(*), 0) + 1 INTO seq_num
  FROM orders
  WHERE branch_id = NEW.branch_id
    AND (created_at AT TIME ZONE 'Asia/Kolkata')::DATE = (COALESCE(NEW.created_at, now()) AT TIME ZONE 'Asia/Kolkata')::DATE;

  -- Set order_number: BB + branch_char + - + date_str + - + 3-digit sequence (e.g. BBB-3005-001)
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'BB' || branch_char || '-' || date_str || '-' || lpad(seq_num::TEXT, 3, '0');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';


