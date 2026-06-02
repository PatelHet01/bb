-- ============================================================
-- FIX: Back-fill reversal entries for already-cancelled KHATA orders
-- This inserts PAYMENT reversal rows into khata_ledger for any
-- cancelled order that had a KHATA payment but no reversal yet.
-- SAFE: Only inserts new rows, never deletes or modifies.
-- ============================================================

INSERT INTO khata_ledger (customer_id, branch_id, type, amount, reason, order_id, recorded_by)
SELECT
  o.customer_id,
  o.branch_id,
  'PAYMENT'                                          AS type,
  op.amount,
  'Order #' || COALESCE(o.order_number, LEFT(o.id::text, 8)) || ' — Cancellation Reversal (backfill)' AS reason,
  o.id                                               AS order_id,
  'system'                                           AS recorded_by
FROM orders o
JOIN order_payments op ON op.order_id = o.id
WHERE o.status    = 'cancelled'
  AND op.mode     = 'KHATA'
  AND o.customer_id IS NOT NULL
  -- Only back-fill if there is no existing reversal for this order yet
  AND NOT EXISTS (
    SELECT 1 FROM khata_ledger kl
    WHERE kl.order_id    = o.id
      AND kl.type        = 'PAYMENT'
      AND kl.amount      = op.amount
  );

-- Do the same for ADVANCE payments on cancelled orders
INSERT INTO advance_ledger (customer_id, branch_id, type, amount, reason, order_id, recorded_by)
SELECT
  o.customer_id,
  o.branch_id,
  'TOPUP'                                            AS type,
  op.amount,
  'Order #' || COALESCE(o.order_number, LEFT(o.id::text, 8)) || ' — Cancellation Reversal (backfill)' AS reason,
  o.id                                               AS order_id,
  'system'                                           AS recorded_by
FROM orders o
JOIN order_payments op ON op.order_id = o.id
WHERE o.status    = 'cancelled'
  AND op.mode     = 'ADVANCE'
  AND o.customer_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM advance_ledger al
    WHERE al.order_id = o.id
      AND al.type     = 'TOPUP'
      AND al.amount   = op.amount
  );

-- Re-evaluate lock state for all affected customers
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT o.customer_id
    FROM orders o
    JOIN order_payments op ON op.order_id = o.id
    WHERE o.status = 'cancelled'
      AND op.mode IN ('KHATA', 'ADVANCE')
      AND o.customer_id IS NOT NULL
  LOOP
    PERFORM check_customer_khata_lock_state(r.customer_id);
  END LOOP;
END $$;
