-- ============================================================
-- BOMBAY BETHAK: CUSTOMER PORTAL PASSWORD MIGRATION
-- Run this in Supabase SQL Editor to enable password login.
-- ============================================================

-- Add password_hash and is_temp_password columns to customers
ALTER TABLE customers ADD COLUMN IF NOT EXISTS password_hash TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_temp_password BOOLEAN DEFAULT false;

-- Reload postgrest schema to expose the new columns to the API
NOTIFY pgrst, 'reload schema';
