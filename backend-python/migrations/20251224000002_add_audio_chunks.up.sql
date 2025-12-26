-- Add audio chunks table for 1-minute chunked recording
CREATE TABLE audio_chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    chunk_index INTEGER NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    duration_seconds FLOAT,
    file_size_bytes INTEGER NOT NULL,
    is_finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_audio_chunks_segment ON audio_chunks(segment_id);
CREATE INDEX idx_audio_chunks_finalized ON audio_chunks(is_finalized);
CREATE UNIQUE INDEX idx_audio_chunks_segment_index ON audio_chunks(segment_id, chunk_index);

COMMENT ON TABLE audio_chunks IS 'Stores metadata for 1-minute audio recording chunks';

-- Add processing logs table for host visibility
CREATE TABLE processing_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    segment_id UUID NOT NULL REFERENCES segments(id) ON DELETE CASCADE,
    stage VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    level VARCHAR(20) DEFAULT 'info',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_processing_logs_segment ON processing_logs(segment_id);
CREATE INDEX idx_processing_logs_created_at ON processing_logs(created_at);

COMMENT ON TABLE processing_logs IS 'Processing logs for audio chunk combination and transcription';

