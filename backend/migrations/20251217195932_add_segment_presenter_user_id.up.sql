-- Add presenter_user_id column (nullable for backward compatibility)
ALTER TABLE segments
ADD COLUMN presenter_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_segments_presenter_user_id ON segments(presenter_user_id);

-- Update existing segments: try to match presenter_name to user username
UPDATE segments s
SET presenter_user_id = u.id
FROM users u
WHERE s.presenter_name = u.username
  AND s.presenter_user_id IS NULL;

