DROP INDEX IF EXISTS idx_segments_presenter_user_id;
ALTER TABLE segments DROP COLUMN IF EXISTS presenter_user_id;

