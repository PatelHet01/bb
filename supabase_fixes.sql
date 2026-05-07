-- 1. CUSTOMERS TABLE: Add registration_type
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'admin';

-- 2. ITEMS TABLE: Ensure subcategory exists
ALTER TABLE items ADD COLUMN IF NOT EXISTS subcategory TEXT;

-- 3. ITEMS TABLE: Bulk assign subcategories
UPDATE items SET subcategory = 'Cold Drinks' WHERE category = 'Cold Drinks & Beverages' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Food' WHERE category = 'BB Cafe' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Tobacco' WHERE category = 'Paan & Masala' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Cigarettes' WHERE category = 'Smoke Lounge' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Biscuits' WHERE category = 'Biscuits & Packets' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Bread & Rusk' WHERE category = 'Bread & Dairy' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Snacks' WHERE category = 'Snacks' AND subcategory IS NULL;

-- 4. ITEMS TABLE: Fix RLS for Admin Update
DROP POLICY IF EXISTS "Admin can update items" ON items;
CREATE POLICY "Admin can update items" ON items FOR UPDATE USING (
  auth.uid() IN (SELECT id FROM users WHERE branch_id = items.branch_id OR role = 'super_admin')
);

-- 5. RELOAD SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
