use std::net::SocketAddr;
use std::sync::Arc;

use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

use quiz_backend::{AppState, create_app, config::Config, ws::hub::Hub};

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

    // Validate production configuration
    // config validation would go here if needed

    let config = Arc::new(config);

    // Create database connection pool
    let db = PgPoolOptions::new()
        .max_connections(10)
        .connect(&config.database_url)
        .await?;

    tracing::info!("Connected to database");

    // Run migrations
    sqlx::migrate!("./migrations")
        .run(&db)
        .await
        .map_err(|e| {
            tracing::error!("Migration failed: {}", e);
            e
        })?;
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
    let app = create_app(state);

    // Start server
    let addr = SocketAddr::from(([0, 0, 0, 0], config.backend_port));
    tracing::info!("Server listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr)
        .await
        .map_err(|e| {
            tracing::error!("Failed to bind to {}: {}", addr, e);
            e
        })?;
    
    tracing::info!("Starting Axum server...");
    axum::serve(listener, app)
        .await
        .map_err(|e| {
            tracing::error!("Server error: {}", e);
            e
        })?;

    tracing::info!("Server shut down");
    Ok(())
}
