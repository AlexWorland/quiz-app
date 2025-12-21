use sqlx::{Connection, PgConnection, PgPool};
use crate::config::Config;

async fn ensure_test_database(url: &str) {
    let (base, db_with_params) = url.rsplit_once('/').unwrap_or((url, "quiz_test"));
    let db_name = db_with_params
        .split('?')
        .next()
        .unwrap_or(db_with_params);
    let admin_url = format!("{}/postgres", base);

    let mut conn = PgConnection::connect(&admin_url)
        .await
        .expect("Failed to connect to admin database");

    let exists: Option<i32> =
        sqlx::query_scalar::<_, i32>("SELECT 1 FROM pg_database WHERE datname = $1")
        .bind(db_name)
        .fetch_optional(&mut conn)
        .await
        .expect("Failed to check test database existence");

    if exists.is_none() {
        let escaped_name = db_name.replace('"', "\"\"");
        let create_stmt = format!("CREATE DATABASE \"{}\"", escaped_name);
        match sqlx::query(&create_stmt)
            .execute(&mut conn)
            .await
        {
            Ok(_) => {},
            Err(sqlx::Error::Database(db_err)) if db_err.code().as_deref() == Some("23505") => {
                // Database already exists (race condition), that's fine
            },
            Err(e) => panic!("Failed to create test database: {}", e),
        }
    }
}

pub async fn setup_test_db() -> PgPool {
    let url = std::env::var("TEST_DATABASE_URL")
        .unwrap_or_else(|_| "postgres://quiz:quiz@localhost:5432/quiz_test".to_string());
    ensure_test_database(&url).await;
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
