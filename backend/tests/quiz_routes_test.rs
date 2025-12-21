use axum_test::TestServer;
use quiz_backend::{create_app, test_utils, AppState};
use uuid::Uuid;

mod test_helpers;
use test_helpers::{create_test_user_with_token, create_test_app_state, create_test_event, create_test_segment};

#[tokio::test]
async fn test_list_quizzes_returns_only_users_events() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, _token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    // Create events for both users
    let _event1 = create_test_event(&state.db, user1.id, Some("User1 Event")).await;
    let _event2 = create_test_event(&state.db, user2.id, Some("User2 Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // List events for user1 - should only see their own events
    let response = server
        .get("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token1)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200);
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 1);
    assert_eq!(body[0]["title"], "User1 Event");
    assert_eq!(body[0]["host_id"].as_str().unwrap(), user1.id.to_string());
}

#[tokio::test]
async fn test_list_quizzes_empty_for_new_user() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200);
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 0);
}

#[tokio::test]
async fn test_list_quizzes_ordered_by_created_at_desc() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    // Create multiple events with delays to ensure different timestamps
    let _event1 = create_test_event(&state.db, user.id, Some("First Event")).await;
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    let _event2 = create_test_event(&state.db, user.id, Some("Second Event")).await;
    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;
    let _event3 = create_test_event(&state.db, user.id, Some("Third Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200);
    let body: Vec<serde_json::Value> = response.json();
    assert_eq!(body.len(), 3);
    // Should be ordered by created_at DESC, so newest first
    assert_eq!(body[0]["title"], "Third Event");
    assert_eq!(body[1]["title"], "Second Event");
    assert_eq!(body[2]["title"], "First Event");
}

#[tokio::test]
async fn test_create_quiz_default_mode() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz"
        }))
        .await;

    assert_eq!(response.status_code(), 200, "Response: {:?}", response.text());
    let body: serde_json::Value = response.json();
    assert_eq!(body["mode"], "listen_only"); // Default mode
}

#[tokio::test]
async fn test_create_quiz_default_num_fake_answers() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["num_fake_answers"], 3); // Default value
}

#[tokio::test]
async fn test_create_quiz_default_time_per_question() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["time_per_question"], 30); // Default value
}

#[tokio::test]
async fn test_create_quiz_default_question_gen_interval() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["question_gen_interval_seconds"], 30); // Default value
}

#[tokio::test]
async fn test_create_quiz_question_gen_interval_clamped() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Test clamping to minimum (10)
    let response_low = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz Low",
            "question_gen_interval_seconds": 5  // Below minimum
        }))
        .await;

    assert_eq!(response_low.status_code(), 200);
    let body_low: serde_json::Value = response_low.json();
    assert_eq!(body_low["question_gen_interval_seconds"], 10); // Clamped to minimum

    // Test clamping to maximum (300)
    let response_high = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz High",
            "question_gen_interval_seconds": 500  // Above maximum
        }))
        .await;

    assert_eq!(response_high.status_code(), 200);
    let body_high: serde_json::Value = response_high.json();
    assert_eq!(body_high["question_gen_interval_seconds"], 300); // Clamped to maximum
}

#[tokio::test]
async fn test_create_quiz_custom_values() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Custom Quiz",
            "description": "Custom description",
            "mode": "normal",
            "num_fake_answers": 4,
            "time_per_question": 45,
            "question_gen_interval_seconds": 60
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["title"], "Custom Quiz");
    assert_eq!(body["description"], "Custom description");
    assert_eq!(body["mode"], "normal");
    assert_eq!(body["num_fake_answers"], 4);
    assert_eq!(body["time_per_question"], 45);
    assert_eq!(body["question_gen_interval_seconds"], 60);
}

#[tokio::test]
async fn test_create_quiz_join_code_generation() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post("/api/quizzes")
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Test Quiz"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert!(body["join_code"].is_string());
    assert!(!body["join_code"].as_str().unwrap().is_empty());
}

#[tokio::test]
async fn test_get_quiz_valid_id() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Requires authentication (route is in protected_quiz_routes)
    let response = server
        .get(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["id"].as_str().unwrap(), event.id.to_string());
    assert_eq!(body["title"], "Test Event");
}

#[tokio::test]
async fn test_get_quiz_invalid_id() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let invalid_id = Uuid::new_v4();

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/quizzes/{}", invalid_id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 404);
}

#[tokio::test]
async fn test_update_quiz_ownership_verification() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let event = create_test_event(&state.db, user1.id, Some("User1 Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to update as user2 (not owner)
    let response = server
        .put(&format!("/api/quizzes/{}", event.id))
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
async fn test_update_quiz_partial_update_title_only() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Original Title")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Updated Title"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["title"], "Updated Title");
    // Other fields should remain unchanged
    assert_eq!(body["mode"], event.mode);
}

#[tokio::test]
async fn test_update_quiz_partial_update_description_only() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "description": "New description"
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["description"], "New description");
    assert_eq!(body["title"], event.title); // Title unchanged
}

#[tokio::test]
async fn test_update_quiz_all_fields() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Original Title")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&serde_json::json!({
            "title": "Updated Title",
            "description": "Updated description",
            "status": "active",
            "num_fake_answers": 5,
            "time_per_question": 60,
            "question_gen_interval_seconds": 90
        }))
        .await;

    assert_eq!(response.status_code(), 200);
    let body: serde_json::Value = response.json();
    assert_eq!(body["title"], "Updated Title");
    assert_eq!(body["description"], "Updated description");
    assert_eq!(body["status"], "active");
    assert_eq!(body["num_fake_answers"], 5);
    assert_eq!(body["time_per_question"], 60);
    assert_eq!(body["question_gen_interval_seconds"], 90);
}

#[tokio::test]
async fn test_update_quiz_invalid_id() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let invalid_id = Uuid::new_v4();

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .put(&format!("/api/quizzes/{}", invalid_id))
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
async fn test_delete_quiz_ownership_verification() {
    let state = create_test_app_state().await;
    let (user1, token1) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, token2) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    let event = create_test_event(&state.db, user1.id, Some("User1 Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Try to delete as user2 (not owner)
    let response = server
        .delete(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token2)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 403); // Forbidden
}

#[tokio::test]
async fn test_delete_quiz_successful_deletion() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("To Delete")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .delete(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204);

    // Verify event is deleted
    let get_response = server
        .get(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(get_response.status_code(), 404);
}

#[tokio::test]
async fn test_delete_quiz_cascade_deletion() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Event with Segments")).await;

    // Create a segment for the event
    let segment = create_test_segment(&state.db, event.id, Some("Test Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Delete the event
    let response = server
        .delete(&format!("/api/quizzes/{}", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204);

    // Verify segment is also deleted (cascade)
    let segment_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM segments WHERE id = $1"
    )
    .bind(segment.id)
    .fetch_one(&state.db)
    .await
    .expect("Failed to check segment");

    assert_eq!(segment_count, 0, "Segment should be deleted via cascade");
}

#[tokio::test]
async fn test_delete_quiz_invalid_id() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let invalid_id = Uuid::new_v4();

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .delete(&format!("/api/quizzes/{}", invalid_id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 404);
}
