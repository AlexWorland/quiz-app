-- Initial schema for quiz application

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'participant',
    avatar_url VARCHAR(500),
    avatar_type VARCHAR(20) DEFAULT 'emoji',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    host_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    join_code VARCHAR(6) UNIQUE NOT NULL,
    mode VARCHAR(20) DEFAULT 'listen_only',
    status VARCHAR(20) DEFAULT 'waiting',
    num_fake_answers INT DEFAULT 3,
    time_per_question INT DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    presenter_name VARCHAR(100) NOT NULL,
    title VARCHAR(200),
    order_index INT NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    recording_started_at TIMESTAMPTZ,
    recording_ended_at TIMESTAMPTZ,
    quiz_started_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer TEXT NOT NULL,
    order_index INT NOT NULL,
    is_ai_generated BOOLEAN DEFAULT FALSE,
    source_transcript TEXT,
    quality_score FLOAT,
    generated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE transcripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE NOT NULL,
    chunk_text TEXT NOT NULL,
    chunk_index INT NOT NULL,
    timestamp_start FLOAT,
    timestamp_end FLOAT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE event_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    total_score INT DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id)
);

CREATE TABLE segment_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    score INT DEFAULT 0,
    questions_answered INT DEFAULT 0,
    questions_correct INT DEFAULT 0,
    UNIQUE(segment_id, user_id)
);

CREATE TABLE responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID REFERENCES segments(id) ON DELETE CASCADE NOT NULL,
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    selected_answer TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    response_time_ms INT NOT NULL,
    points_earned INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(segment_id, question_id, user_id)
);

CREATE TABLE session_answers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES questions(id) ON DELETE CASCADE NOT NULL,
    answers JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_ai_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    llm_provider VARCHAR(20) DEFAULT 'claude',
    llm_api_key_encrypted TEXT,
    ollama_model VARCHAR(100) DEFAULT 'llama2',
    stt_provider VARCHAR(20) DEFAULT 'deepgram',
    stt_api_key_encrypted TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE canvas_strokes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
    stroke_data JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_events_host_id ON events(host_id);
CREATE INDEX idx_events_join_code ON events(join_code);
CREATE INDEX idx_segments_event_id ON segments(event_id);
CREATE INDEX idx_questions_segment_id ON questions(segment_id);
CREATE INDEX idx_event_participants_event_id ON event_participants(event_id);
CREATE INDEX idx_event_participants_user_id ON event_participants(user_id);
CREATE INDEX idx_segment_scores_segment_id ON segment_scores(segment_id);
CREATE INDEX idx_segment_scores_user_id ON segment_scores(user_id);
CREATE INDEX idx_responses_user_id ON responses(user_id);
CREATE INDEX idx_responses_segment_id ON responses(segment_id);
