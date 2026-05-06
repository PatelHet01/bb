-- Seeding Paan and other categories as requested
-- First, ensure columns 'subcategory' and 'variant' exist in 'items' table
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='subcategory') THEN
        ALTER TABLE items ADD COLUMN subcategory text;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='items' AND column_name='variant') THEN
        ALTER TABLE items ADD COLUMN variant text;
    END IF;
END $$;

-- Insert for Gurukul, Bhat, Visat
INSERT INTO items (branch_id, name, variant, price, category, subcategory, is_active, stock_quantity)
SELECT branch, name, variant, price, category, subcategory, (price > 0) as is_active, 0
FROM (
  VALUES
  ('Rajnigandha', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Rajnigandha Saffron', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Rajnigandha', 'Regular', 20, 'Paan', 'Tobacco'),
  ('Tansen', 'Regular', 5, 'Paan', 'Tobacco'),
  ('Vimal', 'Regular', 5, 'Paan', 'Tobacco'),
  ('Silver', 'Regular', 5, 'Paan', 'Tobacco'),
  ('Baba', 'Regular', 5, 'Paan', 'Tobacco'),
  ('Baba', 'Small', 2, 'Paan', 'Tobacco'),
  ('Baba Navratna', 'Regular', 5, 'Paan', 'Tobacco'),
  ('Dosh', 'Regular', 2, 'Paan', 'Tobacco'),
  ('Dosh Supari', 'Regular', 2, 'Paan', 'Tobacco'),
  ('Bhagat', 'Regular', 1, 'Paan', 'Tobacco'),
  ('M Tobacco', 'Regular', 10, 'Paan', 'Tobacco'),
  ('RMD', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Double Zero Silver', 'Regular', 6, 'Paan', 'Tobacco'),
  ('Double Zero', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Miraj', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Signature', 'Regular', 10, 'Paan', 'Tobacco'),
  ('Signature', 'Small', 5, 'Paan', 'Tobacco'),
  ('Director', 'Small', 5, 'Paan', 'Tobacco'),
  ('Director', 'Regular', 10, 'Paan', 'Tobacco'),
  
  ('Variyali', 'Regular', 1, 'Paan', 'Mouth Freshener'),
  ('Masala', 'Regular', 20, 'Paan', 'Mouth Freshener'),
  ('Small Masala', 'Regular', 10, 'Paan', 'Mouth Freshener'),
  ('Pass Pass', 'Regular', 1, 'Paan', 'Mouth Freshener'),

  -- Inventory (Disposables)
  ('Simple Small Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('Simple Big Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('7-in Silver Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('8-in Silver Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('9-in Silver Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('Tea Cups', NULL, 0, 'Inventory', 'Disposables'),
  ('Coffee Cups', NULL, 0, 'Inventory', 'Disposables'),
  ('Cold Coffee Glass', NULL, 0, 'Inventory', 'Disposables'),
  ('Jamun Shots Glass', NULL, 0, 'Inventory', 'Disposables'),
  ('Tissue Paper', NULL, 0, 'Inventory', 'Disposables'),
  ('Maggi Bowl', NULL, 0, 'Inventory', 'Disposables'),
  ('Normal Spoon', NULL, 0, 'Inventory', 'Disposables'),
  ('Kata Spoon', NULL, 0, 'Inventory', 'Disposables'),
  ('White Dish', NULL, 0, 'Inventory', 'Disposables'),
  ('Plastic Small Bag', NULL, 0, 'Inventory', 'Disposables'),
  ('Plastic Big Bag', NULL, 0, 'Inventory', 'Disposables'),
  ('Silver Coil Paper', NULL, 0, 'Inventory', 'Disposables'),
  ('Hand Gloves', NULL, 0, 'Inventory', 'Disposables'),
  ('6-in White Box', NULL, 0, 'Inventory', 'Disposables'),
  ('Straw', NULL, 0, 'Inventory', 'Disposables'),
  ('Silver Box (250ml)', NULL, 0, 'Inventory', 'Disposables')
) as t(name, variant, price, category, subcategory)
CROSS JOIN (VALUES ('gurukul'), ('bhat'), ('visat')) as b(branch);
