-- Remove fake_answers field from questions table
ALTER TABLE questions
DROP COLUMN IF EXISTS fake_answers;

