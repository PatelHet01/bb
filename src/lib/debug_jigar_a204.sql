-- ============================================================
-- DIAGNOSTIC: jigar A-204 (9879566969) — Balance Verification
-- FIXED: Uses CTEs to avoid Cartesian product from multi-table JOIN
-- Run in Supabase SQL Editor
-- ============================================================

-- Step 1: Get customer
SELECT id, name, mobile_number, branch_id
FROM customers
WHERE mobile_number = '9879566969';

-- Step 2: Full khata_ledger — all rows (NO LIMIT)
SELECT kl.id, kl.type, kl.amount, kl.reason, kl.order_id, kl.recorded_by, kl.created_at
FROM khata_ledger kl
JOIN customers c ON c.id = kl.customer_id
WHERE c.mobile_number = '9879566969'
ORDER BY kl.created_at ASC;

-- Step 3: Full advance_ledger — all rows
SELECT al.id, al.type, al.amount, al.reason, al.order_id, al.recorded_by, al.created_at
FROM advance_ledger al
JOIN customers c ON c.id = al.customer_id
WHERE c.mobile_number = '9879566969'
ORDER BY al.created_at ASC;

-- Step 4: CORRECT net balance (CTE-based, no Cartesian product)
-- Aggregates each table independently before joining
WITH khata_agg AS (
  SELECT
    kl.customer_id,
    COUNT(*)                                                             AS khata_entries,
    SUM(CASE WHEN kl.type = 'CREDIT'  THEN kl.amount ELSE 0 END)       AS sum_credit,
    SUM(CASE WHEN kl.type != 'CREDIT' THEN kl.amount ELSE 0 END)       AS sum_payment,
    SUM(CASE WHEN kl.type = 'CREDIT'  THEN kl.amount ELSE 0 END)
      - SUM(CASE WHEN kl.type != 'CREDIT' THEN kl.amount ELSE 0 END)   AS khata_raw
  FROM khata_ledger kl
  JOIN customers c ON c.id = kl.customer_id
  WHERE c.mobile_number = '9879566969'
  GROUP BY kl.customer_id
),
advance_agg AS (
  SELECT
    al.customer_id,
    COUNT(*)                                                              AS advance_entries,
    SUM(CASE WHEN al.type = 'TOPUP'   THEN al.amount ELSE 0 END)        AS sum_topup,
    SUM(CASE WHEN al.type != 'TOPUP'  THEN al.amount ELSE 0 END)        AS sum_deduction,
    SUM(CASE WHEN al.type = 'TOPUP'   THEN al.amount ELSE 0 END)
      - SUM(CASE WHEN al.type != 'TOPUP' THEN al.amount ELSE 0 END)     AS advance_raw
  FROM advance_ledger al
  JOIN customers c ON c.id = al.customer_id
  WHERE c.mobile_number = '9879566969'
  GROUP BY al.customer_id
)
SELECT
  c.name,
  c.mobile_number,
  COALESCE(k.khata_entries, 0)    AS khata_entries,
  COALESCE(a.advance_entries, 0)  AS advance_entries,
  COALESCE(k.sum_credit, 0)       AS sum_credit, 
  COALESCE(k.sum_payment, 0)      AS sum_payment,
  COALESCE(k.khata_raw, 0)        AS khata_raw,
  COALESCE(a.sum_topup, 0)        AS sum_topup,
  COALESCE(a.sum_deduction, 0)    AS sum_deduction,
  COALESCE(a.advance_raw, 0)      AS advance_raw,
  COALESCE(k.khata_raw, 0) - COALESCE(a.advance_raw, 0) AS net_balance_correct
FROM customers c
LEFT JOIN khata_agg  k ON k.customer_id = c.id
LEFT JOIN advance_agg a ON a.customer_id = c.id
WHERE c.mobile_number = '9879566969';
