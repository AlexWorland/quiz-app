-- Remove resume capability fields from segments and events
DROP INDEX IF EXISTS idx_segments_previous_status;
DROP INDEX IF EXISTS idx_events_previous_status;

ALTER TABLE segments
  DROP COLUMN IF EXISTS previous_status,
  DROP COLUMN IF EXISTS ended_at;

ALTER TABLE events
  DROP COLUMN IF EXISTS previous_status,
  DROP COLUMN IF EXISTS ended_at;
