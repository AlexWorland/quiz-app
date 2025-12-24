-- Add questions_to_generate column to events table
ALTER TABLE events 
ADD COLUMN questions_to_generate INTEGER DEFAULT 5;

COMMENT ON COLUMN events.questions_to_generate IS 
'Number of questions AI should generate from audio transcript (1-20, default: 5)';

