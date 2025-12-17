-- Add question_gen_interval_seconds to events table
ALTER TABLE events ADD COLUMN question_gen_interval_seconds INT DEFAULT 30;

-- Add constraint to ensure valid range (10-300 seconds)
ALTER TABLE events ADD CONSTRAINT check_question_gen_interval 
    CHECK (question_gen_interval_seconds >= 10 AND question_gen_interval_seconds <= 300);
