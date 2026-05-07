-- ============================================================
-- BOMBAY BETHAK: MASTER DATABASE RESET SCRIPT (PRD COMPLIANT)
-- ============================================================
-- WARNING: This will DELETE all existing data and completely 
-- rebuild the database schema from scratch. 
-- ============================================================

-- 1. DROP ALL EXISTING TABLES
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS announcement_reads CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS salary_records CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS branches CASCADE;
DROP TABLE IF EXISTS ghoda_transactions CASCADE;
DROP TABLE IF EXISTS advance_ledger CASCADE;
DROP TABLE IF EXISTS khata_ledger CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. CREATE BRANCHES
CREATE TABLE branches (
  id TEXT PRIMARY KEY, -- 'gurukul', 'bhat', 'visat'
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active'
);

-- 3. CREATE USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'staff', -- admin, super_admin, manager, staff
  branch_id TEXT REFERENCES branches(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  mobile_number TEXT UNIQUE NOT NULL,
  dob DATE,
  branch_id TEXT REFERENCES branches(id), -- null = global
  ghoda_coins INT DEFAULT 0,
  registration_type TEXT DEFAULT 'admin', -- 'self', 'admin'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CREATE ITEMS
CREATE TABLE items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  variant TEXT,
  category TEXT NOT NULL,
  subcategory TEXT,
  unit TEXT DEFAULT 'piece',
  price NUMERIC(10,2) DEFAULT 0,
  cost_price NUMERIC(10,2) DEFAULT 0,
  stock_quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CREATE ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'completed', -- 'completed', 'cancelled', 'new', 'preparing', 'ready' (for KDS)
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. CREATE ORDER ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);

-- 8. CREATE ORDER PAYMENTS
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'CASH', 'UPI', 'GHODA', 'KHATA', 'ADVANCE'
  amount NUMERIC(10,2) NOT NULL
);

-- 9. CREATE KHATA LEDGER
CREATE TABLE khata_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  type TEXT NOT NULL, -- 'CREDIT', 'PAYMENT', 'ADJUSTMENT'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. CREATE ADVANCE LEDGER
CREATE TABLE advance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  type TEXT NOT NULL, -- 'TOPUP', 'DEDUCTION', 'REFUND'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. CREATE GHODA TRANSACTIONS
CREATE TABLE ghoda_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  type TEXT NOT NULL, -- 'earn', 'spend'
  amount INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. CREATE WORKERS (Salary Mgmt)
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  join_date DATE NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 13. CREATE SALARY RECORDS
CREATE TABLE salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- e.g., '2026-05'
  base_salary NUMERIC(10,2) NOT NULL,
  advance_taken NUMERIC(10,2) DEFAULT 0,
  net_payable NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid', 'partial'
  payment_note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 14. CREATE SHIFTS (Clock-in records)
CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  shift_code TEXT NOT NULL,
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 15. CREATE REWARDS (GHODA)
CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  ghoda_cost INT NOT NULL,
  stock INT DEFAULT -1, -- -1 for unlimited
  is_active BOOLEAN DEFAULT true,
  branch_id TEXT REFERENCES branches(id), -- null = global
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 16. CREATE ANNOUNCEMENTS
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'warning', 'urgent'
  branch_id TEXT REFERENCES branches(id), -- null = global
  expiry_date TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 17. CREATE ANNOUNCEMENT READS
CREATE TABLE announcement_reads (
  announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (announcement_id, user_id)
);

-- 18. CREATE EXPENSES
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL, -- 'Rent', 'Utilities', 'Supplies', etc.
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  date DATE NOT NULL,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  logged_by TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 19. CREATE SYSTEM SETTINGS
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 20. RPC: DECREMENT STOCK
CREATE OR REPLACE FUNCTION decrement_stock(p_item_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE items 
  SET stock_quantity = GREATEST(0, stock_quantity - p_amount)
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 21. RPC: SYNC GHODA COINS
CREATE OR REPLACE FUNCTION sync_ghoda_coins(p_customer_id UUID, p_amount INT, p_type TEXT)
RETURNS void AS $$
BEGIN
  IF p_type = 'earn' THEN
    UPDATE customers SET ghoda_coins = ghoda_coins + p_amount WHERE id = p_customer_id;
  ELSIF p_type = 'spend' THEN
    UPDATE customers SET ghoda_coins = GREATEST(0, ghoda_coins - p_amount) WHERE id = p_customer_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 22. DISABLE RLS GLOBALLY (To prevent silent insert/update failures)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE khata_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE advance_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE ghoda_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcement_reads DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 23. ENABLE REALTIME FOR FRONTEND SYNC
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE items, customers, orders, announcements;

-- 24. SEED BASIC DATA
INSERT INTO branches (id, name, location) VALUES 
('gurukul', 'Gurukul', 'Ahmedabad'),
('bhat', 'BB Cafe Bhat', 'Ahmedabad'),
('visat', 'Visat', 'Ahmedabad')
ON CONFLICT (id) DO NOTHING;

INSERT INTO users (email, username, role, branch_id) VALUES 
('hetpatel17102004@gmail.com', 'admin', 'super_admin', 'gurukul')
ON CONFLICT (email) DO NOTHING;

INSERT INTO items (name, variant, category, subcategory, unit, price, cost_price, stock_quantity, branch_id) VALUES
('Classic Milds', 'Regular', 'Smoke', 'Cigarettes', 'piece', 20, 15, 100, 'gurukul'),
('Marlboro Advance', 'Regular', 'Smoke', 'Cigarettes', 'piece', 20, 16, 50, 'gurukul'),
('Meetha Paan', 'Special', 'Paan', 'Tobacco', 'piece', 30, 20, 0, 'gurukul'),
('Hell', 'Watermelon', 'Beverages', 'Cold Drinks', 'piece', 60, 45, 10, 'gurukul'),
('Balaji Wafers', 'Masala', 'Snacks', 'Packaged Snacks', 'piece', 10, 8, 20, 'gurukul'),
('Coffee', 'Hot', 'BB Cafe', 'Food', 'piece', 40, 15, 20, 'bhat');

INSERT INTO system_settings (key, value) VALUES
('ghoda_rates', '{"earn_rate_inr": 10, "earn_amount": 1, "birthday_bonus": 100, "referral_bonus": 50}'),
('kitchen_config', '{"bhat_table_count": 8, "auto_confirm_qr_orders": false}');

-- 25. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
