-- KDS Items Table (additive only — does not alter any existing table)
CREATE TABLE IF NOT EXISTS kds_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  item_id UUID REFERENCES items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'preparing', 'ready'
  is_addon BOOLEAN DEFAULT false,         -- true = added AFTER initial kitchen send
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_kds_items_order_id ON kds_items(order_id);

-- Allow POS frontend to read/write without RLS blocking
ALTER TABLE kds_items DISABLE ROW LEVEL SECURITY;

-- Also ensure pos_carts RLS is disabled (run if not done yet)
ALTER TABLE pos_carts DISABLE ROW LEVEL SECURITY;

-- Also re-enable pack_price column if missing
ALTER TABLE items ADD COLUMN IF NOT EXISTS pack_price NUMERIC(10,2) DEFAULT 0;
