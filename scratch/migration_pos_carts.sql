CREATE TABLE pos_carts (
  table_id UUID PRIMARY KEY REFERENCES cafe_tables(id) ON DELETE CASCADE,
  branch_id TEXT REFERENCES branches(id),
  cart_data JSONB DEFAULT '[]'::jsonb,
  customer_data JSONB DEFAULT null,
  cust_balances JSONB DEFAULT '{"khata": 0, "advance": 0}'::jsonb,
  order_type TEXT DEFAULT 'Dine-in',
  discount_type TEXT DEFAULT 'FLAT',
  discount_value NUMERIC DEFAULT 0,
  last_updated TIMESTAMPTZ DEFAULT now()
);

-- Note: Also you might want to remove 'pending' status rows from orders if there are any left over
-- DELETE FROM orders WHERE status = 'pending';
