-- Add full name to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Seed fixed costs in system_settings (empty array by default)
INSERT INTO system_settings (key, value)
VALUES ('fixed_costs', '[]')
ON CONFLICT (key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
