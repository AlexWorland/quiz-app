-- Add resume capability fields to segments and events
ALTER TABLE segments
  ADD COLUMN previous_status VARCHAR(50),
  ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE events
  ADD COLUMN previous_status VARCHAR(50),
  ADD COLUMN ended_at TIMESTAMP WITH TIME ZONE;

-- Add indexes for resume queries
CREATE INDEX idx_segments_previous_status ON segments(previous_status) WHERE previous_status IS NOT NULL;
CREATE INDEX idx_events_previous_status ON events(previous_status) WHERE previous_status IS NOT NULL;
