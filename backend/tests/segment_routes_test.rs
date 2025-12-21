use axum_test::TestServer;
use quiz_backend::{create_app, test_utils, AppState};
use uuid::Uuid;

mod test_helpers;
use test_helpers::{create_test_user_with_token, create_test_app_state, create_test_event, create_test_segment};

#[tokio::test]
async fn test_add_segment_ownership_verification() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let event = create_test_event(&state.db, user1.id, Some("User1 Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to add segment as user2 (not owner)
    let response = server
        .post(&format!("/api/quizzes/{}/questions", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token2)).unwrap(),
        )
        .json(&serde_json::json!({
            "presenter_name": "Test Presenter",
            "title": "Test Segment"
        }))
        .await;

    assert_eq!(response.status_code(), 403); // Forbidden
}

#[tokio::test]
async fn test_add_segment_order_index_calculation_first() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Add first segment
    let response = server
        .post(&format!("/api/quizzes/{}/questions", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "presenter_name": "First Presenter",
            "title": "First Segment"
        }))
        .await;

    if response.status_code() != 200 {
        eprintln!("Response body: {}", response.text());
    }
    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["order_index"], 0); // First segment should have order_index 0
}

#[tokio::test]
async fn test_add_segment_order_index_calculation_subsequent() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;

    // Create first segment directly
    let _segment1 = create_test_segment(&state.db, event.id, Some("First"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Add second segment via API
    let response = server
        .post(&format!("/api/quizzes/{}/questions", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "presenter_name": "Second Presenter",
            "title": "Second Segment"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["order_index"], 1); // Second segment should have order_index 1
}

#[tokio::test]
async fn test_add_segment_default_status() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post(&format!("/api/quizzes/{}/questions", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "presenter_name": "Test Presenter",
            "title": "Test Segment"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "pending"); // Default status
}

#[tokio::test]
async fn test_update_segment_ownership_verification() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let event = create_test_event(&state.db, user1.id, Some("User1 Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to update segment as user2 (not owner)
    let response = server
        .put(&format!("/api/quizzes/{}/questions/{}", event.id, segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token2)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Hacked Title"
        }))
        .await;

    assert_eq!(response.status_code(), 403); // Forbidden
}

#[tokio::test]
async fn test_update_segment_partial_updates() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Original Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Update only presenter_name
    let response = server
        .put(&format!("/api/quizzes/{}/questions/{}", event.id, segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "presenter_name": "Updated Presenter"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["presenter_name"], "Updated Presenter");
    // Title should remain unchanged
    if let Some(ref title) = segment.title {
        assert_eq!(body["title"].as_str(), Some(title.as_str()));
    } else {
        assert!(body["title"].is_null());
    }
}

#[tokio::test]
async fn test_update_segment_status_transitions() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Update status to recording
    let response = server
        .put(&format!("/api/quizzes/{}/questions/{}", event.id, segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "status": "recording"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording");
}

#[tokio::test]
async fn test_update_segment_invalid_id() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;
    let invalid_segment_id = Uuid::new_v4();

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put(&format!("/api/quizzes/{}/questions/{}", event.id, invalid_segment_id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Updated Title"
        }))
        .await;

    assert_eq!(response.status_code(), 404);
}

#[tokio::test]
async fn test_delete_segment_ownership_verification() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let event = create_test_event(&state.db, user1.id, Some("User1 Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to delete segment as user2 (not owner)
    let response = server
        .delete(&format!("/api/quizzes/{}/questions/{}", event.id, segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token2)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 403); // Forbidden
}

#[tokio::test]
async fn test_delete_segment_cascade_effects() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Presenter"), None).await;

    // Create a question for the segment
    use test_helpers::create_test_question;
    let question = create_test_question(&state.db, segment.id, Some("Test Question?"), Some("Answer")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Delete the segment
    let response = server
        .delete(&format!("/api/quizzes/{}/questions/{}", event.id, segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204);

    // Verify question is also deleted (cascade)
    let question_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM questions WHERE id = $1"
    )
    .bind(question.id)
    .fetch_one(&state.db)
    .await
    .expect("Failed to check question");

    assert_eq!(question_count, 0, "Question should be deleted via cascade");
}
