-- +migrate Up
-- Add QR code lock state to events table
ALTER TABLE events
ADD COLUMN qr_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN qr_locked_at TIMESTAMP,
ADD COLUMN qr_locked_by UUID;

-- Add index for faster lookups
CREATE INDEX idx_events_qr_locked ON events(qr_locked);

-- Add comments for clarity
COMMENT ON COLUMN events.qr_locked IS 'Whether new participants can join via QR code';
COMMENT ON COLUMN events.qr_locked_at IS 'Timestamp when QR was last locked/unlocked';
COMMENT ON COLUMN events.qr_locked_by IS 'User ID who last locked/unlocked the QR';

-- +migrate Down
-- Drop index
DROP INDEX IF EXISTS idx_events_qr_locked;

-- Remove columns
ALTER TABLE events
DROP COLUMN qr_locked_by,
DROP COLUMN qr_locked_at,
DROP COLUMN qr_locked;
