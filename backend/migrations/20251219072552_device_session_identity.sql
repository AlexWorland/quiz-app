-- +migrate Up
-- Add device tracking columns to event_participants
ALTER TABLE event_participants
ADD COLUMN device_id UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN session_token VARCHAR(255) UNIQUE,
ADD COLUMN join_timestamp TIMESTAMP DEFAULT NOW(),
ADD COLUMN last_heartbeat TIMESTAMP DEFAULT NOW();

-- Create unique constraint to prevent same device from joining same event twice
ALTER TABLE event_participants
ADD CONSTRAINT unique_device_per_event UNIQUE(event_id, device_id);

-- Add index for faster device lookups
CREATE INDEX idx_event_participants_device_id ON event_participants(device_id);
CREATE INDEX idx_event_participants_session_token ON event_participants(session_token);

-- +migrate Down
-- Drop constraints and columns
DROP INDEX IF EXISTS idx_event_participants_session_token;
DROP INDEX IF EXISTS idx_event_participants_device_id;

ALTER TABLE event_participants
DROP CONSTRAINT unique_device_per_event,
DROP COLUMN last_heartbeat,
DROP COLUMN join_timestamp,
DROP COLUMN session_token,
DROP COLUMN device_id;
