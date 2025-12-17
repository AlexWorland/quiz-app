use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    routing::{get, post, put, delete},
    Router,
};
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod auth;
mod config;
mod db;
mod error;
mod models;
mod routes;
mod services;
mod ws;

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

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Initialize tracing/logging
    tracing_subscriber::registry()
        .with(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "quiz_backend=debug,tower_http=debug".into()),
        )
        .with(tracing_subscriber::fmt::layer())
        .init();

    tracing::info!("Starting Quiz Application Backend");

    // Load configuration
    let config = Config::from_env()?;
    let config = Arc::new(config);

    // Create database connection pool
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to database");

    // Run migrations
    sqlx::migrate!("./migrations").run(&db).await?;
    tracing::info!("Database migrations completed");

    // Initialize S3/MinIO client
    let s3_config = aws_config::from_env()
        .endpoint_url(format!("http://{}", config.minio_endpoint))
        .load()
        .await;

    let s3_client = aws_sdk_s3::Client::new(&s3_config);

    // Initialize WebSocket hub
    let hub = Arc::new(Hub::new());

    // Create application state
    let state = AppState {
        db,
        config: config.clone(),
        hub,
        s3_client,
    };

    // Build router
    let app = Router::new()
        // Health check
        .route("/api/health", get(routes::health::health_check))

        // Authentication routes
        .route("/api/auth/register", post(routes::auth::register))
        .route("/api/auth/login", post(routes::auth::login))
        .route("/api/auth/me", get(routes::auth::me))
        .route("/api/auth/profile", put(routes::auth::update_profile))

        // Quiz routes (presenter)
        .route("/api/quizzes", get(routes::quiz::list_quizzes))
        .route("/api/quizzes", post(routes::quiz::create_quiz))
        .route("/api/quizzes/:id", get(routes::quiz::get_quiz))
        .route("/api/quizzes/:id", put(routes::quiz::update_quiz))
        .route("/api/quizzes/:id", delete(routes::quiz::delete_quiz))
        .route("/api/quizzes/:id/questions", post(routes::quiz::add_question))
        .route("/api/quizzes/:id/questions/:qid", put(routes::quiz::update_question))
        .route("/api/quizzes/:id/questions/:qid", delete(routes::quiz::delete_question))

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
        .route("/api/ws/:session_code", get(routes::ws::ws_handler))
        .route("/api/ws/audio/:quiz_id", get(routes::ws::audio_ws_handler))

        // Add middleware
        .layer(TraceLayer::new_for_http())
        .layer(
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any),
        )
        .with_state(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
