-- Add order_number column
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;

-- Create a global sequence for orders
CREATE SEQUENCE IF NOT EXISTS global_order_seq START 1;

-- Create a function to generate the order number before insert
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TRIGGER AS $$
DECLARE
  branch_char TEXT;
BEGIN
  -- Get first character of branch_id, upper case
  IF NEW.branch_id IS NOT NULL THEN
    branch_char := UPPER(SUBSTRING(NEW.branch_id FROM 1 FOR 1));
  ELSE
    branch_char := 'X';
  END IF;

  -- Set the order number: BBCF + BranchChar + Sequence
  IF NEW.order_number IS NULL THEN
    NEW.order_number := 'BBCF' || branch_char || nextval('global_order_seq')::TEXT;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS set_order_number_trigger ON orders;
CREATE TRIGGER set_order_number_trigger
BEFORE INSERT ON orders
FOR EACH ROW
EXECUTE FUNCTION generate_order_number();

-- Update existing orders with a generated order number to avoid nulls
DO $$ 
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, branch_id FROM orders WHERE order_number IS NULL LOOP
    UPDATE orders 
    SET order_number = 'BBCF' || UPPER(SUBSTRING(r.branch_id FROM 1 FOR 1)) || nextval('global_order_seq')::TEXT
    WHERE id = r.id;
  END LOOP;
END $$;
