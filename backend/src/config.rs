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
    pub fn from_env() -> crate::error::Result<Self> {
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
            anthropic_api_key: std::env::var("ANTHROPIC_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            openai_api_key: std::env::var("OPENAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            ollama_base_url: std::env::var("OLLAMA_BASE_URL")
                .unwrap_or_else(|_| "http://localhost:11434".to_string()),
            ollama_model: std::env::var("OLLAMA_MODEL")
                .unwrap_or_else(|_| "llama2".to_string()),

            // Speech-to-Text
            default_stt_provider: std::env::var("DEFAULT_STT_PROVIDER")
                .unwrap_or_else(|_| "deepgram".to_string()),
            deepgram_api_key: std::env::var("DEEPGRAM_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            assemblyai_api_key: std::env::var("ASSEMBLYAI_API_KEY").ok()
                .filter(|s| !s.is_empty()),
            enable_streaming_transcription: std::env::var("ENABLE_STREAMING_TRANSCRIPTION")
                .map(|s| matches!(s.to_lowercase().as_str(), "true" | "1" | "yes" | "on"))
                .unwrap_or(false),

            // AI Quality Scoring
            enable_ai_quality_scoring: std::env::var("ENABLE_AI_QUALITY_SCORING")
                .map(|s| matches!(s.to_lowercase().as_str(), "true" | "1" | "yes" | "on"))
                .unwrap_or(false),

            // Server
            backend_port: std::env::var("BACKEND_PORT")
                .unwrap_or_else(|_| "8080".to_string())
                .parse()
                .unwrap_or(8080),
            frontend_url: std::env::var("FRONTEND_URL")
                .unwrap_or_else(|_| "http://localhost:3000".to_string()),

            // CORS
            cors_allowed_origins: std::env::var("CORS_ALLOWED_ORIGINS").ok()
                .map(|s| s.split(',').map(|s| s.trim().to_string()).collect()),

            // Canvas sync limit
            canvas_sync_limit: std::env::var("CANVAS_SYNC_LIMIT")
                .unwrap_or_else(|_| "100".to_string())
                .parse()
                .unwrap_or(100),
        })
    }

    /// Check if running in production environment
    pub fn is_production(&self) -> bool {
        self.rust_env == "production"
    }

    /// Validate production configuration requirements
    /// Returns Ok(()) if validation passes or not in production mode
    /// Returns Err with details about missing/invalid configurations in production mode
    pub fn validate_for_production(&self) -> crate::error::Result<()> {
        // Skip validation if not in production
        if !self.is_production() {
            return Ok(());
        }

        let mut errors = Vec::new();

        // Check JWT_SECRET is not default
        if self.jwt_secret == "development-secret-change-in-production" {
            errors.push("JWT_SECRET must be changed from default value in production".to_string());
        }

        // Check ENCRYPTION_KEY is not default
        if self.encryption_key == "32-byte-secret-key-change-me!!!" {
            errors.push("ENCRYPTION_KEY must be changed from default value in production".to_string());
        }

        // Check CORS_ALLOWED_ORIGINS is configured
        if self.cors_allowed_origins.is_none() || self.cors_allowed_origins.as_ref().map(|o| o.is_empty()).unwrap_or(true) {
            errors.push("CORS_ALLOWED_ORIGINS must be configured in production".to_string());
        }

        if errors.is_empty() {
            Ok(())
        } else {
            Err(crate::error::AppError::Validation(errors.join("; ")))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::sync::Mutex;

    // Mutex to ensure tests run sequentially and don't interfere with each other
    static TEST_MUTEX: Mutex<()> = Mutex::new(());

    fn clear_env_vars() {
        env::remove_var("RUST_ENV");
        env::remove_var("DATABASE_URL");
        env::remove_var("JWT_SECRET");
        env::remove_var("JWT_EXPIRY_HOURS");
        env::remove_var("ENCRYPTION_KEY");
        env::remove_var("MINIO_ENDPOINT");
        env::remove_var("MINIO_ACCESS_KEY");
        env::remove_var("MINIO_SECRET_KEY");
        env::remove_var("MINIO_BUCKET");
        env::remove_var("DEFAULT_AI_PROVIDER");
        env::remove_var("ANTHROPIC_API_KEY");
        env::remove_var("OPENAI_API_KEY");
        env::remove_var("OLLAMA_BASE_URL");
        env::remove_var("OLLAMA_MODEL");
        env::remove_var("DEFAULT_STT_PROVIDER");
        env::remove_var("DEEPGRAM_API_KEY");
        env::remove_var("ASSEMBLYAI_API_KEY");
        env::remove_var("ENABLE_STREAMING_TRANSCRIPTION");
        env::remove_var("ENABLE_AI_QUALITY_SCORING");
        env::remove_var("BACKEND_PORT");
        env::remove_var("FRONTEND_URL");
        env::remove_var("CORS_ALLOWED_ORIGINS");
        env::remove_var("CANVAS_SYNC_LIMIT");
    }

    #[test]
    fn test_config_from_env_defaults() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();

        let config = Config::from_env().unwrap();

        assert_eq!(config.rust_env, "development");
        assert_eq!(config.database_url, "postgres://quiz:quiz@localhost:5432/quiz");
        assert_eq!(config.jwt_secret, "development-secret-change-in-production");
        assert_eq!(config.jwt_expiry_hours, 24);
        assert_eq!(config.encryption_key, "32-byte-secret-key-change-me!!!");
        assert_eq!(config.minio_endpoint, "localhost:9000");
        assert_eq!(config.minio_access_key, "minioadmin");
        assert_eq!(config.minio_secret_key, "minioadmin");
        assert_eq!(config.minio_bucket, "avatars");
        assert_eq!(config.default_ai_provider, "claude");
        assert!(config.anthropic_api_key.is_none());
        assert!(config.openai_api_key.is_none());
        assert_eq!(config.ollama_base_url, "http://localhost:11434");
        assert_eq!(config.ollama_model, "llama2");
        assert_eq!(config.default_stt_provider, "deepgram");
        assert!(config.deepgram_api_key.is_none());
        assert!(config.assemblyai_api_key.is_none());
        assert!(!config.enable_streaming_transcription);
        assert!(!config.enable_ai_quality_scoring);
        assert_eq!(config.backend_port, 8080);
        assert_eq!(config.frontend_url, "http://localhost:3000");
        assert!(config.cors_allowed_origins.is_none());
        assert_eq!(config.canvas_sync_limit, 100);
    }

    #[test]
    fn test_config_from_env_custom_values() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();

        env::set_var("RUST_ENV", "production");
        env::set_var("DATABASE_URL", "postgres://user:pass@host:5432/db");
        env::set_var("JWT_SECRET", "custom-secret");
        env::set_var("JWT_EXPIRY_HOURS", "48");
        env::set_var("ENCRYPTION_KEY", "custom-32-byte-key-for-testing!!!");
        env::set_var("MINIO_ENDPOINT", "minio.example.com");
        env::set_var("DEFAULT_AI_PROVIDER", "openai");
        env::set_var("ANTHROPIC_API_KEY", "anthropic-key");
        env::set_var("OPENAI_API_KEY", "openai-key");
        env::set_var("OLLAMA_BASE_URL", "http://ollama:11434");
        env::set_var("OLLAMA_MODEL", "codellama");
        env::set_var("DEFAULT_STT_PROVIDER", "assemblyai");
        env::set_var("DEEPGRAM_API_KEY", "deepgram-key");
        env::set_var("ASSEMBLYAI_API_KEY", "assemblyai-key");
        env::set_var("ENABLE_STREAMING_TRANSCRIPTION", "true");
        env::set_var("ENABLE_AI_QUALITY_SCORING", "true");
        env::set_var("BACKEND_PORT", "9000");
        env::set_var("FRONTEND_URL", "https://app.example.com");
        env::set_var("CORS_ALLOWED_ORIGINS", "https://app.example.com,https://admin.example.com");
        env::set_var("CANVAS_SYNC_LIMIT", "50");

        let config = Config::from_env().unwrap();

        assert_eq!(config.rust_env, "production");
        assert_eq!(config.database_url, "postgres://user:pass@host:5432/db");
        assert_eq!(config.jwt_secret, "custom-secret");
        assert_eq!(config.jwt_expiry_hours, 48);
        assert_eq!(config.encryption_key, "custom-32-byte-key-for-testing!!!");
        assert_eq!(config.minio_endpoint, "minio.example.com");
        assert_eq!(config.default_ai_provider, "openai");
        assert_eq!(config.anthropic_api_key, Some("anthropic-key".to_string()));
        assert_eq!(config.openai_api_key, Some("openai-key".to_string()));
        assert_eq!(config.ollama_base_url, "http://ollama:11434");
        assert_eq!(config.ollama_model, "codellama");
        assert_eq!(config.default_stt_provider, "assemblyai");
        assert_eq!(config.deepgram_api_key, Some("deepgram-key".to_string()));
        assert_eq!(config.assemblyai_api_key, Some("assemblyai-key".to_string()));
        assert!(config.enable_streaming_transcription);
        assert!(config.enable_ai_quality_scoring);
        assert_eq!(config.backend_port, 9000);
        assert_eq!(config.frontend_url, "https://app.example.com");
        assert_eq!(config.cors_allowed_origins, Some(vec![
            "https://app.example.com".to_string(),
            "https://admin.example.com".to_string()
        ]));
        assert_eq!(config.canvas_sync_limit, 50);

        clear_env_vars();
    }

    #[test]
    fn test_config_from_env_invalid_jwt_expiry() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();
        env::set_var("JWT_EXPIRY_HOURS", "invalid");

        let config = Config::from_env().unwrap();
        assert_eq!(config.jwt_expiry_hours, 24); // Should fall back to default

        clear_env_vars();
    }

    #[test]
    fn test_config_from_env_invalid_backend_port() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();
        env::set_var("BACKEND_PORT", "invalid");

        let config = Config::from_env().unwrap();
        assert_eq!(config.backend_port, 8080); // Should fall back to default

        clear_env_vars();
    }

    #[test]
    fn test_config_from_env_invalid_canvas_sync_limit() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();
        env::set_var("CANVAS_SYNC_LIMIT", "invalid");

        let config = Config::from_env().unwrap();
        assert_eq!(config.canvas_sync_limit, 100); // Should fall back to default

        clear_env_vars();
    }

    #[test]
    fn test_config_from_env_empty_api_keys() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();
        env::set_var("ANTHROPIC_API_KEY", "");
        env::set_var("OPENAI_API_KEY", "");
        env::set_var("DEEPGRAM_API_KEY", "");
        env::set_var("ASSEMBLYAI_API_KEY", "");

        let config = Config::from_env().unwrap();
        assert!(config.anthropic_api_key.is_none());
        assert!(config.openai_api_key.is_none());
        assert!(config.deepgram_api_key.is_none());
        assert!(config.assemblyai_api_key.is_none());

        clear_env_vars();
    }

    #[test]
    fn test_config_from_env_boolean_parsing() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();

        // Test various true values
        env::set_var("ENABLE_STREAMING_TRANSCRIPTION", "true");
        env::set_var("ENABLE_AI_QUALITY_SCORING", "1");
        let config = Config::from_env().unwrap();
        assert!(config.enable_streaming_transcription);
        assert!(config.enable_ai_quality_scoring);

        clear_env_vars();

        // Test various false values
        env::set_var("ENABLE_STREAMING_TRANSCRIPTION", "false");
        env::set_var("ENABLE_AI_QUALITY_SCORING", "0");
        let config = Config::from_env().unwrap();
        assert!(!config.enable_streaming_transcription);
        assert!(!config.enable_ai_quality_scoring);

        clear_env_vars();

        // Test invalid boolean values (should default to false)
        env::set_var("ENABLE_STREAMING_TRANSCRIPTION", "maybe");
        let config = Config::from_env().unwrap();
        assert!(!config.enable_streaming_transcription);

        clear_env_vars();
    }

    #[test]
    fn test_config_is_production() {
        let _lock = TEST_MUTEX.lock().unwrap();
        clear_env_vars();

        let mut config = Config::from_env().unwrap();
        assert!(!config.is_production()); // Default is "development"

        config.rust_env = "production".to_string();
        assert!(config.is_production());

        config.rust_env = "staging".to_string();
        assert!(!config.is_production());
    }
}