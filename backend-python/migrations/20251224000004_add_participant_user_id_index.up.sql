-- Add index on event_participants.user_id for improved query performance
CREATE INDEX IF NOT EXISTS idx_event_participants_user_id ON event_participants(user_id);

