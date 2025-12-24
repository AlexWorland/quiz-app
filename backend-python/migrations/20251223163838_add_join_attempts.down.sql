-- Remove join attempt tracking
DROP TABLE IF EXISTS join_attempts;

-- Remove grace period field from event_participants
ALTER TABLE event_participants
DROP COLUMN IF EXISTS join_started_at;

