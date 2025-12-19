-- +migrate Up
-- Track participant join state throughout event lifecycle
ALTER TABLE event_participants
ADD COLUMN join_status VARCHAR(50) DEFAULT 'joined';

-- Add index for faster state-based queries
CREATE INDEX idx_event_participants_join_status ON event_participants(join_status);

-- Add comment for clarity
COMMENT ON COLUMN event_participants.join_status IS 'Current join state of participant: joined, waiting_for_segment, active_in_quiz, segment_complete';

-- +migrate Down
-- Drop index
DROP INDEX IF EXISTS idx_event_participants_join_status;

-- Remove column
ALTER TABLE event_participants
DROP COLUMN join_status;
