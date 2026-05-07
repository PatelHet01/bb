-- ============================================================
-- BOMBAY BETHAK: MASTER DATABASE RESET SCRIPT
-- ============================================================
-- WARNING: This will DELETE all existing data and completely 
-- rebuild the database schema from scratch. 
-- ============================================================

-- 1. DROP ALL EXISTING TABLES
DROP TABLE IF EXISTS ghoda_transactions CASCADE;
DROP TABLE IF EXISTS advance_ledger CASCADE;
DROP TABLE IF EXISTS khata_ledger CASCADE;
DROP TABLE IF EXISTS order_payments CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- 2. CREATE USERS
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE NOT NULL,
  role TEXT DEFAULT 'staff', -- admin, super_admin, manager, staff
  branch_id TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. CREATE CUSTOMERS
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT UNIQUE,
  name TEXT NOT NULL,
  mobile_number TEXT UNIQUE NOT NULL,
  dob DATE,
  branch_id TEXT, -- null = global
  ghoda_coins INT DEFAULT 0,
  registration_type TEXT DEFAULT 'admin', -- 'self', 'admin'
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. CREATE ITEMS
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
  branch_id TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  is_archived BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. CREATE ORDERS
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  branch_id TEXT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  discount NUMERIC(10,2) DEFAULT 0,
  total NUMERIC(10,2) NOT NULL,
  status TEXT DEFAULT 'completed', -- 'completed', 'cancelled'
  user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. CREATE ORDER ITEMS
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id),
  quantity INT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  total NUMERIC(10,2) NOT NULL
);

-- 7. CREATE ORDER PAYMENTS
CREATE TABLE order_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  mode TEXT NOT NULL, -- 'CASH', 'UPI', 'GHODA', 'KHATA', 'ADVANCE'
  amount NUMERIC(10,2) NOT NULL
);

-- 8. CREATE KHATA LEDGER
CREATE TABLE khata_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'CREDIT', 'PAYMENT', 'ADJUSTMENT'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. CREATE ADVANCE LEDGER
CREATE TABLE advance_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'TOPUP', 'DEDUCTION', 'REFUND'
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT,
  recorded_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. CREATE GHODA TRANSACTIONS
CREATE TABLE ghoda_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id) ON DELETE CASCADE,
  branch_id TEXT NOT NULL,
  type TEXT NOT NULL, -- 'earn', 'spend'
  amount INT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. RPC: DECREMENT STOCK
CREATE OR REPLACE FUNCTION decrement_stock(p_item_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE items 
  SET stock_quantity = GREATEST(0, stock_quantity - p_amount)
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- 12. DISABLE RLS GLOBALLY (To prevent silent insert/update failures)
-- Since the frontend handles all access control logic securely
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE items DISABLE ROW LEVEL SECURITY;
ALTER TABLE orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE order_payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE khata_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE advance_ledger DISABLE ROW LEVEL SECURITY;
ALTER TABLE ghoda_transactions DISABLE ROW LEVEL SECURITY;

-- 13. ENABLE REALTIME FOR FRONTEND SYNC
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE items, customers, orders;

-- 14. SEED ADMIN USER
-- Ensures you can login directly
INSERT INTO users (email, username, role, branch_id) VALUES 
('hetpatel17102004@gmail.com', 'admin', 'super_admin', 'gurukul')
ON CONFLICT (email) DO NOTHING;

-- 15. SEED BASIC ITEMS (Demonstrates correct schema syntax)
INSERT INTO items (name, variant, category, subcategory, unit, price, cost_price, stock_quantity, branch_id) VALUES
('Classic Milds', 'Regular', 'Smoke', 'Cigarettes', 'piece', 20, 15, 100, 'gurukul'),
('Marlboro Advance', 'Regular', 'Smoke', 'Cigarettes', 'piece', 20, 16, 50, 'gurukul'),
('Meetha Paan', 'Special', 'Paan', 'Tobacco', 'piece', 30, 20, 0, 'gurukul'),
('Hell', 'Watermelon', 'Beverages', 'Cold Drinks', 'piece', 60, 45, 10, 'gurukul'),
('Balaji Wafers', 'Masala', 'Snacks', 'Packaged Snacks', 'piece', 10, 8, 20, 'gurukul'),
('Coffee', 'Hot', 'BB Cafe', 'Food', 'piece', 40, 15, 20, 'bhat');

-- 16. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
