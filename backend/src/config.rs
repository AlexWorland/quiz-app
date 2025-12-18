use anyhow::Result;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
    // Environment
    pub rust_env: String,

    // Database
    pub database_url: String,

    // JWT Authentication
    pub jwt_secret: String,
    pub jwt_expiry_hours: i64,

    // Encryption
    pub encryption_key: String,

    // MinIO/S3
    pub minio_endpoint: String,
    pub minio_access_key: String,
    pub minio_secret_key: String,
    pub minio_bucket: String,

    // AI Providers
    pub default_ai_provider: String,
    pub anthropic_api_key: Option<String>,
    pub openai_api_key: Option<String>,
    pub ollama_base_url: String,
    pub ollama_model: String,

    // Speech-to-Text
    pub default_stt_provider: String,
    pub deepgram_api_key: Option<String>,
    pub assemblyai_api_key: Option<String>,
    /// Enable streaming transcription for real-time speech-to-text processing.
    /// When enabled, uses WebSocket-based streaming (Deepgram streaming API).
    /// When disabled, falls back to REST-based pseudo-streaming with periodic polling.
    /// Production consideration: Enable for high-volume events to reduce latency.
    pub enable_streaming_transcription: bool,

    // AI Quality Scoring
    /// Enable AI-based quality scoring for generated questions.
    /// When enabled, uses AI to evaluate question quality (clarity, answerability, factual accuracy).
    /// When disabled, uses only heuristic-based scoring.
    /// Adds additional API costs but provides more accurate quality assessment.
    pub enable_ai_quality_scoring: bool,

    // Server
    pub backend_port: u16,
    pub frontend_url: String,

    // CORS
    pub cors_allowed_origins: Option<Vec<String>>,

    // Canvas sync performance
    pub canvas_sync_limit: usize, // Maximum number of strokes to sync on join (default: 100)
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        Ok(Self {
            // Environment
            rust_env: std::env::var("RUST_ENV")
                .unwrap_or_else(|_| "development".to_string()),

            // Database
            database_url: std::env::var("DATABASE_URL")
                .unwrap_or_else(|_| "postgres://quiz:quiz@localhost:5432/quiz".to_string()),

            // JWT
            jwt_secret: std::env::var("JWT_SECRET")
                .unwrap_or_else(|_| "development-secret-change-in-production".to_string()),
            jwt_expiry_hours: std::env::var("JWT_EXPIRY_HOURS")
                .unwrap_or_else(|_| "24".to_string())
                .parse()
                .unwrap_or(24),

            // Encryption
            encryption_key: std::env::var("ENCRYPTION_KEY")
                .unwrap_or_else(|_| "32-byte-secret-key-change-me!!!".to_string()),

            // MinIO
            minio_endpoint: std::env::var("MINIO_ENDPOINT")
                .unwrap_or_else(|_| "localhost:9000".to_string()),
            minio_access_key: std::env::var("MINIO_ACCESS_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            minio_secret_key: std::env::var("MINIO_SECRET_KEY")
                .unwrap_or_else(|_| "minioadmin".to_string()),
            minio_bucket: std::env::var("MINIO_BUCKET")
                .unwrap_or_else(|_| "avatars".to_string()),

            // AI Providers
            default_ai_provider: std::env::var("DEFAULT_AI_PROVIDER")
                .unwrap_or_else(|_| "claude".to_string()),
            // Default question generation interval (can be overridden per event)
            // Note: This is a fallback; events can have their own interval setting
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            openai_api_key: std::env::var("OPENAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            ollama_model: std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama2".to_string()),

            // STT Providers
            default_stt_provider: std::env::var("DEFAULT_STT_PROVIDER")
                .unwrap_or_else(|_| "deepgram".to_string()),
            deepgram_api_key: std::env::var("DEEPGRAM_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            assemblyai_api_key: std::env::var("ASSEMBLYAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            enable_streaming_transcription: std::env::var("ENABLE_STREAMING_TRANSCRIPTION")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),

            // AI Quality Scoring
            enable_ai_quality_scoring: std::env::var("ENABLE_AI_QUALITY_SCORING")
                .unwrap_or_else(|_| "false".to_string())
                .parse()
                .unwrap_or(false),

            // Server
            backend_port: std::env::var("BACKEND_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),

            // CORS
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS")
                .ok()
                .filter(|s| !s.is_empty())
                .map(|s| s.split(',').map(|o| o.trim().to_string()).collect()),

            // Canvas sync performance
            // Limits the number of strokes synced when a user joins an event
            // This prevents performance issues with events that have many canvas strokes
            // Tradeoff: Users joining late may not see all historical strokes
            // Consider pagination or time-based filtering for very large events
            canvas_sync_limit: std::env::var("CANVAS_SYNC_LIMIT")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
        })
    }

    /// Returns true if running in production mode
    pub fn is_production(&self) -> bool {
        self.rust_env == "production"
    }

    /// Validate configuration for production deployment.
    /// Returns an error if critical security settings are using default values.
    pub fn validate_for_production(&self) -> Result<()> {
        if !self.is_production() {
            return Ok(());
        }

        let mut errors = Vec::new();

        // Check for default JWT secret
        if self.jwt_secret == "development-secret-change-in-production" {
            errors.push("JWT_SECRET must be changed from the default value for production");
        }

        // Check for default encryption key
        if self.encryption_key == "32-byte-secret-key-change-me!!!" {
            errors.push("ENCRYPTION_KEY must be changed from the default value for production");
        }

        // Check that at least one AI provider is configured
        let has_ai_provider = self.anthropic_api_key.is_some()
            || self.openai_api_key.is_some()
            || !self.ollama_base_url.is_empty();
        if !has_ai_provider {
            errors.push("At least one AI provider must be configured (ANTHROPIC_API_KEY, OPENAI_API_KEY, or OLLAMA_BASE_URL)");
        }

        // Check that CORS origins are configured in production
        if self.cors_allowed_origins.is_none() {
            errors.push("CORS_ALLOWED_ORIGINS must be set for production (comma-separated list of allowed origins)");
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(anyhow::anyhow!(
                "Production configuration validation failed:\n  - {}",
                errors.join("\n  - ")
            ))
        }
    }
}
