use axum::{
    body::Body,
    http::{Request, StatusCode},
    middleware::Next,
    response::Response,
};
use axum_test::TestServer;
use quiz_backend::{create_app, test_utils, AppState};
use quiz_backend::auth::middleware::presenter_only;
use quiz_backend::auth::middleware::AuthUser;
use quiz_backend::auth::jwt::generate_token;
use std::sync::Arc;
use uuid::Uuid;

mod test_helpers;
use test_helpers::{create_test_user_with_token, create_test_app_state};

#[tokio::test]
async fn test_auth_middleware_missing_authorization_header() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Make request without Authorization header
    let response = server
        .get("/api/auth/me")
        .await;

    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_auth_middleware_invalid_bearer_format() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Make request with invalid Bearer format
    let response = server
        .get("/api/auth/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_static("InvalidFormat token123"),
        )
        .await;

    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_auth_middleware_invalid_jwt_token() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Make request with invalid JWT token
    let response = server
        .get("/api/auth/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_static("Bearer invalid.token.here"),
        )
        .await;

    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_auth_middleware_expired_jwt_token() {
    let state = create_test_app_state().await;
    
    // Create a user and generate an expired token
    let (user, _) = create_test_user_with_token(&state.db, &state.config, None).await;
    
    // Generate token with negative expiry (expired)
    let expired_token = generate_token(
        user.id,
        &user.role,
        &state.config.jwt_secret,
        -1, // Negative hours = expired
    ).expect("Failed to generate expired token");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Wait a moment to ensure token is expired
    tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;

    let response = server
        .get("/api/auth/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", expired_token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_auth_middleware_valid_token() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Make request with valid token
    let response = server
        .get("/api/auth/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["id"].as_str().unwrap(), user.id.to_string());
    assert_eq!(body["username"], user.username);
}

// Note: presenter_only middleware tests are better tested through integration tests
// with actual routes that use it. The middleware logic is simple enough that
// testing through HTTP requests provides better coverage.
// 
// For unit testing presenter_only in isolation, we would need to create a mock router,
// which is complex. Instead, we test it through routes that use it (e.g., session routes).
