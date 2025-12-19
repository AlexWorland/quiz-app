use axum_test::TestServer;
use quiz_backend::{create_app, test_utils, AppState};
use std::sync::Arc;
use aws_sdk_s3::Client as S3Client;
use quiz_backend::ws::hub::Hub;

// Note: These tests require a test database to be running
// Set TEST_DATABASE_URL environment variable or use default: postgres://quiz:quiz@localhost:5432/quiz_test

#[tokio::test]
async fn test_health_check() {
    let pool = test_utils::setup_test_db().await;
    let config = test_utils::test_config();
    let hub = Arc::new(Hub::new());
    
    // Create a minimal S3 client for testing (won't actually be used)
    let s3_config = aws_config::from_env().load().await;
    let s3_client = S3Client::new(&s3_config);

    let state = AppState {
        db: pool,
        config: Arc::new(config),
        hub,
        s3_client,
    };

    let app = create_app(state);
    let server = TestServer::new(app).unwrap();

    let response = server.get("/api/health").await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "ok");
}

#[tokio::test]
async fn test_register_user() {
    let pool = test_utils::setup_test_db().await;
    let config = test_utils::test_config();
    let hub = Arc::new(Hub::new());
    
    let s3_config = aws_config::from_env().load().await;
    let s3_client = S3Client::new(&s3_config);

    let state = AppState {
        db: pool,
        config: Arc::new(config),
        hub,
        s3_client,
    };

    let app = create_app(state);
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": "testuser",
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert!(body["token"].is_string());
    assert_eq!(body["user"]["username"], "testuser");
}

#[tokio::test]
async fn test_login_user() {
    let pool = test_utils::setup_test_db().await;
    let config = test_utils::test_config();
    let hub = Arc::new(Hub::new());
    
    let s3_config = aws_config::from_env().load().await;
    let s3_client = S3Client::new(&s3_config);

    let state = AppState {
        db: pool.clone(),
        config: Arc::new(config),
        hub,
        s3_client,
    };

    // First register a user
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": "testuser",
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(register_response.status_code(), 200);

    // Then login
    let login_response = server
        .post("/api/auth/login")
        .json(&serde_json::json!({
            "username": "testuser",
            "password": "testpass123"
        }))
        .await;

    assert_eq!(login_response.status_code(), 200);
    let body: serde_json::Value = login_response.json();
    assert!(body["token"].is_string());
    assert_eq!(body["user"]["username"], "testuser");
}

#[tokio::test]
async fn test_create_event() {
    let pool = test_utils::setup_test_db().await;
    let config = test_utils::test_config();
    let hub = Arc::new(Hub::new());
    
    let s3_config = aws_config::from_env().load().await;
    let s3_client = S3Client::new(&s3_config);

    let state = AppState {
        db: pool.clone(),
        config: Arc::new(config),
        hub,
        s3_client,
    };

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Register and get token
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": "testuser",
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    let register_body: serde_json::Value = register_response.json();
    let token = register_body["token"].as_str().unwrap();

    // Create event
    let response = server
        .post("/api/quizzes")
        .add_header("Authorization", format!("Bearer {}", token))
        .json(&serde_json::json!({
            "title": "Test Quiz",
            "mode": "normal",
            "num_fake_answers": 3,
            "time_per_question": 30
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["title"], "Test Quiz");
    assert!(body["id"].is_string());
    assert!(body["join_code"].is_string());
}

