-- +migrate Up
-- Track previous state for segments to enable resume
ALTER TABLE segments
ADD COLUMN previous_status VARCHAR(50),
ADD COLUMN was_ended_at TIMESTAMP,
ADD COLUMN end_reason VARCHAR(100);

-- Track previous state for events to enable resume
ALTER TABLE events
ADD COLUMN previous_status VARCHAR(50),
ADD COLUMN was_ended_at TIMESTAMP,
ADD COLUMN end_reason VARCHAR(100);

-- Add indexes for faster lookups
CREATE INDEX idx_segments_was_ended_at ON segments(was_ended_at);
CREATE INDEX idx_events_was_ended_at ON events(was_ended_at);

-- Add comment for clarity
COMMENT ON COLUMN segments.previous_status IS 'Status before segment was ended, used for resume functionality';
COMMENT ON COLUMN events.previous_status IS 'Status before event was ended, used for resume functionality';

-- +migrate Down
-- Drop indexes
DROP INDEX IF EXISTS idx_events_was_ended_at;
DROP INDEX IF EXISTS idx_segments_was_ended_at;

-- Remove columns
ALTER TABLE events
DROP COLUMN end_reason,
DROP COLUMN was_ended_at,
DROP COLUMN previous_status;

ALTER TABLE segments
DROP COLUMN end_reason,
DROP COLUMN was_ended_at,
DROP COLUMN previous_status;
