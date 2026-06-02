-- ============================================================
-- BOMBAY BETHAK: KHATA LIMIT / LINE OF CREDIT MIGRATION
-- SAFE: Only adds columns and creates functions/triggers.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Add LC columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS khata_limit NUMERIC(10,2) DEFAULT NULL;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS khata_unlock_percent NUMERIC(5,2) DEFAULT 30.00;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_khata_locked BOOLEAN DEFAULT false;

-- 2. Core lock-state function
--    net_khata = max(0, sum(khata_ledger) - sum(advance_ledger))
--    This matches the existing frontend balance formula exactly.
--    Lock  : net_khata >= khata_limit
--    Unlock: net_khata <= khata_limit * (1 - unlock_percent / 100)
CREATE OR REPLACE FUNCTION check_customer_khata_lock_state(p_cust_id UUID)
RETURNS void AS $$
DECLARE
  v_limit       NUMERIC;
  v_unlock_pct  NUMERIC;
  v_is_locked   BOOLEAN;
  v_khata_raw   NUMERIC;
  v_advance_raw NUMERIC;
  v_net_khata   NUMERIC;
  v_unlock_thr  NUMERIC;
BEGIN
  -- Fetch current customer state
  SELECT khata_limit, khata_unlock_percent, is_khata_locked
    INTO v_limit, v_unlock_pct, v_is_locked
    FROM customers WHERE id = p_cust_id;

  -- No limit set → always unlocked
  IF v_limit IS NULL THEN
    UPDATE customers SET is_khata_locked = false WHERE id = p_cust_id;
    RETURN;
  END IF;

  -- Compute raw ledger totals (all branches combined)
  SELECT COALESCE(SUM(CASE WHEN type = 'CREDIT' THEN amount ELSE -amount END), 0)
    INTO v_khata_raw
    FROM khata_ledger WHERE customer_id = p_cust_id;

  SELECT COALESCE(SUM(CASE WHEN type = 'TOPUP' THEN amount ELSE -amount END), 0)
    INTO v_advance_raw
    FROM advance_ledger WHERE customer_id = p_cust_id;

  -- Net outstanding = advance offsets khata
  v_net_khata := GREATEST(0, v_khata_raw - v_advance_raw);

  -- Unlock threshold (amount outstanding must drop TO OR BELOW this to unlock)
  v_unlock_thr := v_limit * (1.0 - v_unlock_pct / 100.0);

  IF NOT v_is_locked AND v_net_khata >= v_limit THEN
    UPDATE customers SET is_khata_locked = true WHERE id = p_cust_id;
  ELSIF v_is_locked AND v_net_khata <= v_unlock_thr THEN
    UPDATE customers SET is_khata_locked = false WHERE id = p_cust_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 3. Trigger wrapper (fires on khata_ledger changes)
CREATE OR REPLACE FUNCTION trg_khata_ledger_lock_check()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM check_customer_khata_lock_state(OLD.customer_id);
  ELSE
    PERFORM check_customer_khata_lock_state(NEW.customer_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 4. Trigger wrapper (fires on advance_ledger changes)
CREATE OR REPLACE FUNCTION trg_advance_ledger_lock_check()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM check_customer_khata_lock_state(OLD.customer_id);
  ELSE
    PERFORM check_customer_khata_lock_state(NEW.customer_id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger wrapper (fires when admin changes limit/unlock_percent on customers)
CREATE OR REPLACE FUNCTION trg_customer_limit_change_lock_check()
RETURNS TRIGGER AS $$
BEGIN
  -- Only re-evaluate if the limit-related columns changed
  IF OLD.khata_limit IS DISTINCT FROM NEW.khata_limit OR
     OLD.khata_unlock_percent IS DISTINCT FROM NEW.khata_unlock_percent THEN
    PERFORM check_customer_khata_lock_state(NEW.id);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 6. Drop old triggers if they exist (idempotent re-run safety)
DROP TRIGGER IF EXISTS trg_khata_lock_after_khata ON khata_ledger;
DROP TRIGGER IF EXISTS trg_khata_lock_after_advance ON advance_ledger;
DROP TRIGGER IF EXISTS trg_khata_lock_after_customer_update ON customers;

-- 7. Attach triggers
CREATE TRIGGER trg_khata_lock_after_khata
  AFTER INSERT OR UPDATE OR DELETE ON khata_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_khata_ledger_lock_check();

CREATE TRIGGER trg_khata_lock_after_advance
  AFTER INSERT OR UPDATE OR DELETE ON advance_ledger
  FOR EACH ROW EXECUTE FUNCTION trg_advance_ledger_lock_check();

CREATE TRIGGER trg_khata_lock_after_customer_update
  AFTER UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION trg_customer_limit_change_lock_check();

-- 8. Back-fill: re-evaluate lock state for all existing customers
--    (safe no-op for those without a limit)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM customers LOOP
    PERFORM check_customer_khata_lock_state(r.id);
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
