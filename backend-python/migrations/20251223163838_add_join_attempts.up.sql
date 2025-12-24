-- Add join attempt tracking for race condition handling
CREATE TABLE IF NOT EXISTS join_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    device_id UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'in_progress',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Add index for efficient lookups
CREATE INDEX idx_join_attempts_event_device ON join_attempts(event_id, device_id);
CREATE INDEX idx_join_attempts_status ON join_attempts(status);
CREATE INDEX idx_join_attempts_started_at ON join_attempts(started_at);

-- Add grace period field to event_participants for mid-scan lock handling
ALTER TABLE event_participants
ADD COLUMN IF NOT EXISTS join_started_at TIMESTAMP WITH TIME ZONE;

COMMENT ON TABLE join_attempts IS 'Tracks in-progress join attempts to prevent race conditions';
COMMENT ON COLUMN event_participants.join_started_at IS 'Timestamp when the join process started (for grace period handling)';

