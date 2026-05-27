-- Pack/Single Selling — Migration v1
-- Additive only. Does NOT touch any stock_quantity values.

-- Add sell_mode to order_items to persist whether a line was sold single or as a pack
ALTER TABLE order_items ADD COLUMN IF NOT EXISTS sell_mode TEXT DEFAULT 'single';
-- 'single' = qty × price (stock deducted 1:1)
-- 'pack'   = qty × pack_price (stock deducted qty × units_per_box singles)

NOTIFY pgrst, 'reload schema';
