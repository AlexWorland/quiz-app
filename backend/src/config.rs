use anyhow::Result;

/// Application configuration loaded from environment variables
#[derive(Debug, Clone)]
pub struct Config {
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

    // Speech-to-Text
    pub default_stt_provider: String,
    pub deepgram_api_key: Option<String>,
    pub assemblyai_api_key: Option<String>,

    // Server
    pub backend_port: u16,
    pub frontend_url: String,
}

impl Config {
    /// Load configuration from environment variables
    pub fn from_env() -> Result<Self> {
        Ok(Self {
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
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            openai_api_key: std::env::var("OPENAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),

            // STT Providers
            default_stt_provider: std::env::var("DEFAULT_STT_PROVIDER")
                .unwrap_or_else(|_| "deepgram".to_string()),
            deepgram_api_key: std::env::var("DEEPGRAM_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            assemblyai_api_key: std::env::var("ASSEMBLYAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),

            // Server
            backend_port: std::env::var("BACKEND_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:5173".to_string()),
        })
    }
}
