-- ============================================================
-- PRE-MIGRATION DATA EXPORT
-- Run BOTH queries in Supabase SQL Editor → Export as CSV
-- Save as: khata_ledger_export_YYYY-MM-DD.csv
--          advance_ledger_export_YYYY-MM-DD.csv
-- ============================================================

-- 1. Full khata_ledger export
SELECT
  kl.id,
  kl.customer_id,
  c.name       AS customer_name,
  c.mobile_number,
  c.branch_id  AS customer_branch,
  kl.branch_id AS ledger_branch,
  kl.type,
  kl.amount,
  kl.reason,
  kl.order_id,
  kl.recorded_by,
  kl.created_at
FROM khata_ledger kl
LEFT JOIN customers c ON c.id = kl.customer_id
ORDER BY c.name, kl.created_at;

-- 2. Full advance_ledger export
SELECT
  al.id,
  al.customer_id,
  c.name       AS customer_name,
  c.mobile_number,
  c.branch_id  AS customer_branch,
  al.branch_id AS ledger_branch,
  al.type,
  al.amount,
  al.reason,
  al.order_id,
  al.recorded_by,
  al.created_at
FROM advance_ledger al
LEFT JOIN customers c ON c.id = al.customer_id
ORDER BY c.name, al.created_at;

-- 3. Per-customer balance summary (truth table to verify after migration)
SELECT
  c.id,
  c.name,
  c.mobile_number,
  c.branch_id,
  COALESCE(SUM(CASE WHEN kl.type = 'CREDIT'  THEN kl.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN kl.type != 'CREDIT' THEN kl.amount ELSE 0 END), 0) AS khata_raw,
  COALESCE(SUM(CASE WHEN al.type = 'TOPUP'   THEN al.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN al.type != 'TOPUP'  THEN al.amount ELSE 0 END), 0) AS advance_raw,
  (
    COALESCE(SUM(CASE WHEN kl.type = 'CREDIT' THEN kl.amount ELSE 0 END), 0)
    - COALESCE(SUM(CASE WHEN kl.type != 'CREDIT' THEN kl.amount ELSE 0 END), 0)
    - (
      COALESCE(SUM(CASE WHEN al.type = 'TOPUP' THEN al.amount ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN al.type != 'TOPUP' THEN al.amount ELSE 0 END), 0)
    )
  ) AS net_balance,
  COUNT(DISTINCT kl.id) AS khata_row_count,
  COUNT(DISTINCT al.id) AS advance_row_count
FROM customers c
LEFT JOIN khata_ledger kl ON kl.customer_id = c.id
LEFT JOIN advance_ledger al ON al.customer_id = c.id
GROUP BY c.id, c.name, c.mobile_number, c.branch_id
HAVING COUNT(DISTINCT kl.id) > 0 OR COUNT(DISTINCT al.id) > 0
ORDER BY ABS(net_balance) DESC;
