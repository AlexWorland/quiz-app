use axum_test::TestServer;
#[cfg(test)]
use quiz_backend::{create_app, test_utils, AppState};
use std::sync::Arc;
use aws_sdk_s3::Client as S3Client;
use quiz_backend::ws::hub::Hub;
use uuid::Uuid;

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
    assert_eq!(body["status"], "healthy");
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

    let username = format!("testuser_register_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username.clone(),
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert!(body["token"].is_string());
    assert_eq!(body["user"]["username"], username);
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

    let username = format!("testuser_login_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username.clone(),
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
            "username": username.clone(),
            "password": "testpass123"
        }))
        .await;

    assert_eq!(login_response.status_code(), 200);
    let body: serde_json::Value = login_response.json();
    assert!(body["token"].is_string());
    assert_eq!(body["user"]["username"], username);
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
    let username = format!("testuser_event_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username,
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(register_response.status_code(), 200);
    let register_body: serde_json::Value = register_response.json();
    let token = register_body["token"].as_str().unwrap();

    // Create event
    let response = server
        .post("/api/quizzes")
        .add_header(axum::http::HeaderName::from_static("authorization"), axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap())
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

#[tokio::test]
async fn test_update_profile_success() {
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
    let username = format!("profile_user_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username,
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(register_response.status_code(), 200);
    let register_body: serde_json::Value = register_response.json();
    let token = register_body["token"].as_str().unwrap();

    // Update profile
    let updated_username = format!("profile_updated_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let response = server
        .put("/api/auth/profile")
        .add_header(axum::http::HeaderName::from_static("authorization"), axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap())
        .json(&serde_json::json!({
            "username": updated_username.clone(),
            "avatar_url": "https://example.com/avatar.png",
            "avatar_type": "custom"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["username"], updated_username);
    assert_eq!(body["avatar_url"], "https://example.com/avatar.png");
    assert_eq!(body["avatar_type"], "custom");
}

#[tokio::test]
async fn test_update_profile_conflict_username() {
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

    // Register two users
    let uuid_a = Uuid::new_v4().to_string().split('-').next().unwrap().to_string();
    let uuid_b = Uuid::new_v4().to_string().split('-').next().unwrap().to_string();
    let username_a = format!("user_a_{}", uuid_a);
    let username_b = format!("user_b_{}", uuid_b);
    
    let first = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username_a.clone(),
            "password": "pass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;
    assert_eq!(first.status_code(), 200);
    let first_body: serde_json::Value = first.json();
    let first_token = first_body["token"].as_str().unwrap();

    let second = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username_b.clone(),
            "password": "pass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;
    assert_eq!(second.status_code(), 200);

    // Attempt to rename user_a to user_b (should conflict)
    let conflict = server
        .put("/api/auth/profile")
        .add_header(axum::http::HeaderName::from_static("authorization"), axum::http::HeaderValue::from_str(&format!("Bearer {}", first_token)).unwrap())
        .json(&serde_json::json!({
            "username": username_b
        }))
        .await;

    assert_eq!(conflict.status_code(), 409);
}

#[tokio::test]
async fn test_update_profile_validation_error() {
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

    let username = format!("val_user_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username,
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(register_response.status_code(), 200);
    let register_body: serde_json::Value = register_response.json();
    let token = register_body["token"].as_str().unwrap();

    // Too-short username
    let response = server
        .put("/api/auth/profile")
        .add_header(axum::http::HeaderName::from_static("authorization"), axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap())
        .json(&serde_json::json!({
            "username": "ab"
        }))
        .await;

    assert_eq!(response.status_code(), 400);
}

