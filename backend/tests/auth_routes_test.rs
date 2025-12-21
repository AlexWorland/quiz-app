use axum_test::TestServer;
use quiz_backend::{create_app, test_utils, AppState};
use std::sync::Arc;
use aws_sdk_s3::Client as S3Client;
use quiz_backend::ws::hub::Hub;
use uuid::Uuid;

mod test_helpers;
use test_helpers::{create_test_user_with_token, create_test_app_state};

#[tokio::test]
async fn test_register_username_too_short() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": "ab",  // Too short (< 3 chars)
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("3 characters"));
}

#[tokio::test]
async fn test_register_empty_password() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": "testuser",
            "password": "",  // Empty password
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("required"));
}

#[tokio::test]
async fn test_register_duplicate_username() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let username = format!("duplicate_{}", Uuid::new_v4().to_string().split('-').next().unwrap());

    // Register first user
    let first_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username.clone(),
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(first_response.status_code(), 200);

    // Try to register with same username
    let duplicate_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username,
            "password": "testpass123",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(duplicate_response.status_code(), 409);
    let body: serde_json::Value = duplicate_response.json();
    assert!(body["error"].as_str().unwrap().contains("already taken"));
}

#[tokio::test]
async fn test_register_valid_registration() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let username = format!("validuser_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
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
    assert_eq!(body["user"]["email"], format!("{}@quizapp.local", username));
}

#[tokio::test]
async fn test_register_email_generation() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let username = format!("emailtest_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
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
    assert_eq!(body["user"]["email"], format!("{}@quizapp.local", username));
}

#[tokio::test]
async fn test_register_avatar_handling() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let username = format!("avatartest_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username,
            "password": "testpass123",
            "avatar_url": "https://example.com/avatar.png",
            "avatar_type": "custom"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["user"]["avatar_url"], "https://example.com/avatar.png");
    assert_eq!(body["user"]["avatar_type"], "custom");
}

#[tokio::test]
async fn test_login_nonexistent_user() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/auth/login")
        .json(&serde_json::json!({
            "username": "nonexistent_user_12345",
            "password": "anypassword"
        }))
        .await;

    assert_eq!(response.status_code(), 401);
}

#[tokio::test]
async fn test_login_invalid_password() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Register a user first
    let username = format!("logintest_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let register_response = server
        .post("/api/auth/register")
        .json(&serde_json::json!({
            "username": username.clone(),
            "password": "correctpassword",
            "avatar_url": "😀",
            "avatar_type": "emoji"
        }))
        .await;

    assert_eq!(register_response.status_code(), 200);

    // Try to login with wrong password
    let login_response = server
        .post("/api/auth/login")
        .json(&serde_json::json!({
            "username": username,
            "password": "wrongpassword"
        }))
        .await;

    assert_eq!(login_response.status_code(), 401);
}

#[tokio::test]
async fn test_login_valid_credentials() {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Register a user first
    let username = format!("validlogin_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
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

    // Login with correct credentials
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
async fn test_me_authenticated_request() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

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

#[tokio::test]
async fn test_me_user_deleted_after_token() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    // Delete the user
    sqlx::query("DELETE FROM users WHERE id = $1")
        .bind(user.id)
        .execute(&state.db)
        .await
        .expect("Failed to delete user");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get("/api/auth/me")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 404);
}

#[tokio::test]
async fn test_update_profile_username_validation_too_short() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "username": "ab"  // Too short
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("3 characters"));
}

#[tokio::test]
async fn test_update_profile_username_validation_too_long() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let long_username = "a".repeat(51); // 51 characters (> 50)

    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "username": long_username
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("50 characters"));
}

#[tokio::test]
async fn test_update_profile_username_uniqueness() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, _token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to update user1's username to user2's actual username
    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token1)).unwrap(),
        )
        .json(&serde_json::json!({
            "username": user2.username  // Use the actual unique username
        }))
        .await;

    assert_eq!(response.status_code(), 409);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("already taken"));
}

#[tokio::test]
async fn test_update_profile_avatar_url_length_limit() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let long_url = "https://example.com/".to_string() + &"a".repeat(500); // > 500 chars

    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "avatar_url": long_url
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("500 characters"));
}

#[tokio::test]
async fn test_update_profile_avatar_type_validation() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "avatar_type": "invalid_type"
        }))
        .await;

    assert_eq!(response.status_code(), 400);
    let body: serde_json::Value = response.json();
    assert!(body["error"].as_str().unwrap().contains("emoji, preset, custom"));
}

#[tokio::test]
async fn test_update_profile_partial_update_username_only() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let new_username = format!("updated_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "username": new_username.clone()
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["username"], new_username);
    // Avatar should remain unchanged
    if let Some(ref avatar_url) = user.avatar_url {
        assert_eq!(body["avatar_url"].as_str(), Some(avatar_url.as_str()));
    } else {
        assert!(body["avatar_url"].is_null());
    }
}

#[tokio::test]
async fn test_update_profile_partial_update_avatar_only() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "avatar_url": "https://example.com/new-avatar.png",
            "avatar_type": "custom"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["avatar_url"], "https://example.com/new-avatar.png");
    assert_eq!(body["avatar_type"], "custom");
    // Username should remain unchanged
    assert_eq!(body["username"], user.username);
}

#[tokio::test]
async fn test_update_profile_all_fields() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let new_username = format!("allfields_{}", Uuid::new_v4().to_string().split('-').next().unwrap());
    let response = server
        .put("/api/auth/profile")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "username": new_username.clone(),
            "avatar_url": "https://example.com/updated.png",
            "avatar_type": "preset"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["username"], new_username);
    assert_eq!(body["avatar_url"], "https://example.com/updated.png");
    assert_eq!(body["avatar_type"], "preset");
}
