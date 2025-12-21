-- Add display_name field to users table
-- This allows non-unique display names while keeping username unique for authentication
ALTER TABLE users ADD COLUMN display_name VARCHAR(100);

-- Set display_name to username for existing users
UPDATE users SET display_name = username;

-- Make display_name NOT NULL after setting values
ALTER TABLE users ALTER COLUMN display_name SET NOT NULL;

-- Add index on display_name for faster lookups (non-unique)
CREATE INDEX idx_users_display_name ON users(display_name);
