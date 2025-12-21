-- Remove display_name field
DROP INDEX IF EXISTS idx_users_display_name;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;
