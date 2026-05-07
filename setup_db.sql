-- 1. CLEAR ALL DATA (Reset)
TRUNCATE TABLE order_items CASCADE;
TRUNCATE TABLE order_payments CASCADE;
TRUNCATE TABLE orders CASCADE;
TRUNCATE TABLE khata_ledger CASCADE;
TRUNCATE TABLE advance_ledger CASCADE;
TRUNCATE TABLE ghoda_transactions CASCADE;
TRUNCATE TABLE items CASCADE;
TRUNCATE TABLE customers CASCADE;

-- 2. ALTER ITEMS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='subcategory') THEN
        ALTER TABLE items ADD COLUMN subcategory text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='variant') THEN
        ALTER TABLE items ADD COLUMN variant text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='unit') THEN
        ALTER TABLE items ADD COLUMN unit text DEFAULT 'piece';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='cost_price') THEN
        ALTER TABLE items ADD COLUMN cost_price numeric DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='low_stock_threshold') THEN
        ALTER TABLE items ADD COLUMN low_stock_threshold numeric DEFAULT 5;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='is_archived') THEN
        ALTER TABLE items ADD COLUMN is_archived boolean DEFAULT false;
    END IF;
END $$;

-- 3. ALTER CUSTOMERS TABLE
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='dob') THEN
        ALTER TABLE customers ADD COLUMN dob date;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='customers' AND column_name='registration_type') THEN
        ALTER TABLE customers ADD COLUMN registration_type text DEFAULT 'admin';
    END IF;
END $$;

-- 4. UPDATE RLS POLICIES (If missing/incorrect)
-- Dropping existing and recreating for Customers to allow branch_id IS NULL
DROP POLICY IF EXISTS "Enable read access for users based on branch" ON customers;
CREATE POLICY "Enable read access for users based on branch" ON customers FOR SELECT USING (
  branch_id = auth.jwt()->>'branch_id' OR branch_id IS NULL OR (auth.jwt()->>'role') = 'super_admin'
);

-- Landing page insert (Anon or Any)
DROP POLICY IF EXISTS "Enable insert for landing page" ON customers;
CREATE POLICY "Enable insert for landing page" ON customers FOR INSERT WITH CHECK (
  true
);

