// Library exports for use in tests
pub mod auth;
pub mod config;
pub mod db;
pub mod error;
pub mod models;
pub mod routes;
pub mod services;
pub mod ws;

use std::sync::Arc;
use axum::Router;
use axum::routing::{get, post, put, delete};
use tower_http::trace::TraceLayer;
use tower_http::cors::{Any, CorsLayer};
use axum::http::{header::{AUTHORIZATION, CONTENT_TYPE}, Method};
use crate::config::Config;
use crate::ws::hub::Hub;

/// Application state shared across all handlers
#[derive(Clone)]
pub struct AppState {
    pub db: sqlx::PgPool,
    pub config: Arc<Config>,
    pub hub: Arc<Hub>,
    pub s3_client: aws_sdk_s3::Client,
}

/// Build CORS layer based on environment
fn build_cors_layer(config: &Config) -> CorsLayer {
    if config.is_production() {
        if let Some(ref origins) = config.cors_allowed_origins {
            let origins: Vec<_> = origins
                .iter()
                .filter_map(|o| o.parse().ok())
                .collect();

            CorsLayer::new()
                .allow_origin(origins)
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::DELETE])
                .allow_headers([AUTHORIZATION, CONTENT_TYPE])
        } else {
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        }
    } else {
        CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any)
    }
}

/// Build the application router for testing
pub fn create_app(state: AppState) -> Router {
    Router::new()
        // Health check
        .route("/api/health", get(routes::health::health_check))

        // Authentication routes
        .route("/api/auth/register", post(routes::auth::register))
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/auth/profile", put(routes::auth::update_profile))

        // Quiz routes (presenter) - keeping for backward compatibility
        .route("/api/quizzes", get(routes::quiz::list_quizzes))
        .route("/api/quizzes", post(routes::quiz::create_quiz))
        .route("/api/quizzes/:id", get(routes::quiz::get_quiz))
        .route("/api/quizzes/:id", put(routes::quiz::update_quiz))
        .route("/api/quizzes/:id", delete(routes::quiz::delete_quiz))
        .route("/api/quizzes/:id/questions", post(routes::quiz::add_question))
        .route("/api/quizzes/:id/questions/:qid", put(routes::quiz::update_question))
        .route("/api/quizzes/:id/questions/:qid", delete(routes::quiz::delete_question))

        // Event routes (new API)
        .route("/api/events/join/:code", get(routes::quiz::get_event_by_code))
        .route("/api/events/:id/segments", get(routes::quiz::get_event_with_segments))
        .route("/api/events/:event_id/segments/:segment_id", get(routes::quiz::get_segment))
        
        // Segment routes
        .route("/api/segments/:id/recording/start", post(routes::quiz::start_recording))
        .route("/api/segments/:id/recording/pause", post(routes::quiz::pause_recording))
        .route("/api/segments/:id/recording/resume", post(routes::quiz::resume_recording))
        .route("/api/segments/:id/recording/stop", post(routes::quiz::stop_recording))
        .route("/api/segments/:id/recording/restart", post(routes::quiz::restart_recording))
        
        // Question routes
        .route("/api/segments/:id/questions", get(routes::quiz::get_segment_questions))
        .route("/api/segments/:id/questions", post(routes::quiz::create_question_for_segment))
        .route("/api/segments/:id/questions/bulk", post(routes::quiz::bulk_import_questions))
        .route("/api/questions/:id", put(routes::quiz::update_question_by_id))
        .route("/api/questions/:id", delete(routes::quiz::delete_question_by_id))
        
        // Leaderboard routes
        .route("/api/events/:id/leaderboard", get(routes::quiz::get_master_leaderboard))
        .route("/api/segments/:id/leaderboard", get(routes::quiz::get_segment_leaderboard))
        
        // Canvas routes
        .route("/api/events/:id/canvas", get(routes::quiz::get_canvas_strokes))
        .route("/api/events/:id/canvas", delete(routes::quiz::clear_canvas))

        // Game session routes
        .route("/api/sessions", post(routes::session::create_session))
        .route("/api/sessions/:code", get(routes::session::get_session))
        .route("/api/sessions/:code/join", post(routes::session::join_session))

        // Settings routes
        .route("/api/settings/ai", get(routes::settings::get_ai_settings))
        .route("/api/settings/ai", put(routes::settings::update_ai_settings))
        .route("/api/settings/ai/test", post(routes::settings::test_ai_connection))

        // Upload routes
        .route("/api/upload/avatar", post(routes::upload::upload_avatar))

        // WebSocket routes
        .route("/api/ws/event/:event_id", get(routes::ws::ws_handler))
        .route("/api/ws/audio/:segment_id", get(routes::ws::audio_ws_handler))

        // Add middleware
        .layer(TraceLayer::new_for_http())
        .layer(build_cors_layer(&state.config))
        .with_state(state)
}

#[cfg(test)]
pub mod test_utils {
    use sqlx::PgPool;
    use crate::config::Config;

    pub async fn setup_test_db() -> PgPool {
        let url = std::env::var("TEST_DATABASE_URL")
            .unwrap_or_else(|_| "postgres://quiz:quiz@localhost:5432/quiz_test".to_string());
        let pool = PgPool::connect(&url).await.expect("Failed to connect to test database");
        sqlx::migrate!().run(&pool).await.expect("Failed to run migrations");
        pool
    }

    pub fn test_config() -> Config {
        Config {
            rust_env: "test".to_string(),
            database_url: "postgres://quiz:quiz@localhost:5432/quiz_test".to_string(),
            jwt_secret: "test_secret_key_for_testing_only".to_string(),
            jwt_expiry_hours: 24,
            encryption_key: "32-byte-secret-key-change-me!!!".to_string(),
            cors_allowed_origins: None,
            default_ai_provider: "claude".to_string(),
            anthropic_api_key: None,
            openai_api_key: None,
            ollama_base_url: "http://localhost:11434".to_string(),
            ollama_model: "llama2".to_string(),
            default_stt_provider: "deepgram".to_string(),
            deepgram_api_key: None,
            assemblyai_api_key: None,
            minio_endpoint: "localhost:9000".to_string(),
            minio_access_key: "minioadmin".to_string(),
            minio_secret_key: "minioadmin".to_string(),
            minio_bucket: "avatars".to_string(),
            enable_streaming_transcription: false,
            enable_ai_quality_scoring: false,
            backend_port: 8080,
            frontend_url: "http://localhost:5173".to_string(),
            canvas_sync_limit: 100,
        }
    }
}

