-- ============================================================
-- BOMBAY BETHAK: MASTER DATABASE RESET & SCHEMA
-- Fully compliant with Dashboard PRD (Phase 1 & 2)
-- ============================================================
-- WARNING: This script drops all tables and rebuilds them.
-- ============================================================

-- 1. DROP ALL EXISTING TABLES (Safely, without destroying Supabase extensions)
DROP TABLE IF EXISTS system_settings CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS announcements CASCADE;
DROP TABLE IF EXISTS shifts CASCADE;
DROP TABLE IF EXISTS salary_records CASCADE;
DROP TABLE IF EXISTS workers CASCADE;
DROP TABLE IF EXISTS rewards CASCADE;
DROP TABLE IF EXISTS ghoda_transactions CASCADE;
DROP TABLE IF EXISTS advance_ledger CASCADE;
DROP TABLE IF EXISTS khata_ledger CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS branches CASCADE;

-- 2. CREATE BRANCHES
CREATE TABLE branches (
  id TEXT PRIMARY KEY, -- 'gurukul', 'bhat', 'visat'
  name TEXT NOT NULL,
  location TEXT,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CREATE USERS (Admins, Managers, Staff)
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'manager', -- super_admin, admin, manager
  branch_id TEXT REFERENCES branches(id), -- null for super_admin
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  mobile_number TEXT UNIQUE NOT NULL,
  dob DATE,
  branch_id TEXT REFERENCES branches(id), -- Origin branch
  ghoda_coins INT DEFAULT 0,
  registration_type TEXT DEFAULT 'admin', -- 'self', 'admin'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CREATE ITEMS (Inventory)
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
  is_disposable BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CREATE ORDERS & ORDER ITEMS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'completed', -- 'completed', 'cancelled', 'new', 'preparing', 'ready'
  user_id UUID REFERENCES users(id),
  table_number INT, -- For Bhat KDS (QR Ordering)
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);

CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'CASH', 'UPI', 'GHODA', 'KHATA', 'ADVANCE'
  amount NUMERIC(10,2) NOT NULL
);

-- 7. CREATE LEDGERS
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

-- 8. CREATE GHODA ECONOMY
CREATE TABLE ghoda_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  type TEXT NOT NULL, -- 'earn', 'spend'
  amount INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  cost_in_ghoda INT NOT NULL,
  stock_quantity INT DEFAULT -1, -- -1 = unlimited
  branch_scope TEXT REFERENCES branches(id), -- null = global
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CREATE SALARY & HR
CREATE TABLE workers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  base_salary NUMERIC(10,2) NOT NULL,
  join_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE salary_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  month_year TEXT NOT NULL, -- format: 'YYYY-MM'
  base_salary NUMERIC(10,2) NOT NULL,
  advance_taken NUMERIC(10,2) DEFAULT 0,
  net_payable NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'unpaid', -- 'unpaid', 'paid', 'partial'
  payment_note TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id UUID REFERENCES workers(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  day_code TEXT NOT NULL,
  clock_in TIMESTAMPTZ,
  clock_out TIMESTAMPTZ,
  total_hours NUMERIC(5,2)
);

-- 10. CREATE SYSTEM MANAGEMENT
CREATE TABLE announcements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT DEFAULT 'info', -- 'info', 'warning', 'urgent'
  branch_scope TEXT REFERENCES branches(id), -- null = all branches
  created_by UUID REFERENCES users(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id TEXT REFERENCES branches(id) NOT NULL,
  category TEXT NOT NULL, -- 'Rent', 'Utilities', 'Supplies', etc.
  description TEXT,
  amount NUMERIC(10,2) NOT NULL,
  logged_by UUID REFERENCES users(id),
  expense_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 11. RPCs
CREATE OR REPLACE FUNCTION decrement_stock(p_item_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE items 
  SET stock_quantity = GREATEST(0, stock_quantity - p_amount)
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 12. DISABLE RLS GLOBALLY (Frontend/Client handles Role Based Routing securely)
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE khata_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE advance_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE ghoda_transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE rewards DISABLE ROW LEVEL SECURITY;
ALTER TABLE workers DISABLE ROW LEVEL SECURITY;
ALTER TABLE salary_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE shifts DISABLE ROW LEVEL SECURITY;
ALTER TABLE announcements DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings DISABLE ROW LEVEL SECURITY;

-- 13. REALTIME CONFIGURATION
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE items, customers, orders, announcements;

-- 14. INITIAL DATA SEEDING
-- Seed Branches
INSERT INTO branches (id, name, location) VALUES 
('gurukul', 'Gurukul', 'Ahmedabad'),
('bhat', 'Bhat', 'Ahmedabad'),
('visat', 'Visat', 'Ahmedabad')
ON CONFLICT (id) DO NOTHING;

-- Seed Super Admin User
INSERT INTO users (email, username, role, branch_id) VALUES 
('hetpatel17102004@gmail.com', 'admin', 'super_admin', null)
ON CONFLICT (email) DO NOTHING;

-- Seed Initial System Settings
INSERT INTO system_settings (key, value) VALUES 
('ghoda_earn_rate', '{"amount_spent": 100, "coins_earned": 1}'),
('birthday_bonus', '{"coins": 50}')
ON CONFLICT (key) DO NOTHING;

-- 15. RELOAD POSTGREST SCHEMA
NOTIFY pgrst, 'reload schema';
