-- Step 1: Add missing columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'admin';

-- Step 2: Add missing columns to items
ALTER TABLE items RENAME COLUMN stock TO stock_quantity;
ALTER TABLE items ADD COLUMN IF NOT EXISTS subcategory TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS variant TEXT;
ALTER TABLE items ADD COLUMN IF NOT EXISTS cost_price NUMERIC(10,2) DEFAULT 0;
ALTER TABLE items ADD COLUMN IF NOT EXISTS low_stock_threshold INT DEFAULT 5;
ALTER TABLE items ADD COLUMN IF NOT EXISTS is_archived BOOLEAN DEFAULT false;

-- Step 3: Fix category names to match frontend
UPDATE items SET category = 'Smoke' WHERE category = 'Smoke Lounge';
UPDATE items SET category = 'Paan' WHERE category = 'Paan Parlour';
UPDATE items SET category = 'Beverages' WHERE category = 'Cold Drinks & Beverages';
UPDATE items SET category = 'Snacks' WHERE category = 'Biscuits & Packets';

-- Step 4: Bulk assign subcategories
UPDATE items SET subcategory = 'Cold Drinks' WHERE category = 'Beverages' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Food' WHERE category = 'BB Cafe' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Tobacco' WHERE category = 'Paan' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Cigarettes' WHERE category = 'Smoke' AND subcategory IS NULL;
UPDATE items SET subcategory = 'Packaged Snacks' WHERE category = 'Snacks' AND subcategory IS NULL;

-- Step 5: Create decrement_stock RPC
CREATE OR REPLACE FUNCTION decrement_stock(p_item_id UUID, p_amount INT)
RETURNS void AS $$
BEGIN
  UPDATE items 
  SET stock_quantity = GREATEST(0, stock_quantity - p_amount)
  WHERE id = p_item_id;
END;
$$ LANGUAGE plpgsql;

-- Step 6: Reload schema cache
NOTIFY pgrst, 'reload schema';
