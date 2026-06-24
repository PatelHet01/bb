-- ============================================================
-- PRE-MIGRATION DATA EXPORT
-- Run each query separately in Supabase SQL Editor → Export as CSV
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

-- 3. Per-customer balance summary
-- FIXED: Uses CTEs to avoid Cartesian product — each table aggregated independently
WITH khata_agg AS (
  SELECT
    customer_id,
    COUNT(*)                                                            AS khata_entries,
    SUM(CASE WHEN type = 'CREDIT'  THEN amount ELSE 0 END)             AS sum_credit,
    SUM(CASE WHEN type != 'CREDIT' THEN amount ELSE 0 END)             AS sum_payment,
    SUM(CASE WHEN type = 'CREDIT'  THEN amount ELSE 0 END)
      - SUM(CASE WHEN type != 'CREDIT' THEN amount ELSE 0 END)         AS khata_raw
  FROM khata_ledger
  GROUP BY customer_id
),
advance_agg AS (
  SELECT
    customer_id,
    COUNT(*)                                                            AS advance_entries,
    SUM(CASE WHEN type = 'TOPUP'   THEN amount ELSE 0 END)             AS sum_topup,
    SUM(CASE WHEN type != 'TOPUP'  THEN amount ELSE 0 END)             AS sum_deduction,
    SUM(CASE WHEN type = 'TOPUP'   THEN amount ELSE 0 END)
      - SUM(CASE WHEN type != 'TOPUP' THEN amount ELSE 0 END)          AS advance_raw
  FROM advance_ledger
  GROUP BY customer_id
)
SELECT
  c.id,
  c.name,
  c.mobile_number,
  c.branch_id,
  COALESCE(k.khata_entries, 0)    AS khata_entries,
  COALESCE(a.advance_entries, 0)  AS advance_entries,
  COALESCE(k.sum_credit, 0)       AS sum_credit,
  COALESCE(k.sum_payment, 0)      AS sum_payment,
  COALESCE(k.khata_raw, 0)        AS khata_raw,
  COALESCE(a.sum_topup, 0)        AS sum_topup,
  COALESCE(a.sum_deduction, 0)    AS sum_deduction,
  COALESCE(a.advance_raw, 0)      AS advance_raw,
  COALESCE(k.khata_raw, 0) - COALESCE(a.advance_raw, 0) AS net_balance
FROM customers c
LEFT JOIN khata_agg  k ON k.customer_id = c.id
LEFT JOIN advance_agg a ON a.customer_id = c.id
WHERE k.customer_id IS NOT NULL OR a.customer_id IS NOT NULL
ORDER BY ABS(COALESCE(k.khata_raw, 0) - COALESCE(a.advance_raw, 0)) DESC;
