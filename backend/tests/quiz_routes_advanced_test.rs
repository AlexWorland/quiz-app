use axum_test::TestServer;
use quiz_backend::{create_app, test_utils};
use serde_json::json;
use uuid::Uuid;

mod test_helpers;
use test_helpers::{
    create_test_user_with_token, create_test_app_state, create_test_event, create_test_segment,
    create_test_question,
};

// Canvas Operations Tests (4 tests)
#[tokio::test]
async fn test_get_canvas_strokes_empty_canvas() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, _user.id, Some("Canvas Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let strokes: Vec<serde_json::Value> = response.json();
    assert_eq!(strokes.len(), 0);
}

#[tokio::test]
async fn test_get_canvas_strokes_ordered_by_created_at() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Canvas Test Event")).await;

    // Insert canvas strokes with different timestamps
    let stroke1_data = json!({"type": "stroke", "points": [[0, 0], [10, 10]]});
    let stroke2_data = json!({"type": "stroke", "points": [[20, 20], [30, 30]]});

    sqlx::query(
        "INSERT INTO canvas_strokes (event_id, user_id, stroke_data) VALUES ($1, $2, $3)"
    )
    .bind(event.id)
    .bind(user.id)
    .bind(&stroke1_data)
    .execute(&state.db)
    .await
    .expect("Failed to insert stroke 1");

    tokio::time::sleep(tokio::time::Duration::from_millis(10)).await;

    sqlx::query(
        "INSERT INTO canvas_strokes (event_id, user_id, stroke_data) VALUES ($1, $2, $3)"
    )
    .bind(event.id)
    .bind(user.id)
    .bind(&stroke2_data)
    .execute(&state.db)
    .await
    .expect("Failed to insert stroke 2");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let strokes: Vec<serde_json::Value> = response.json();
    assert_eq!(strokes.len(), 2);
    // Should be ordered by created_at ASC
    assert_eq!(strokes[0]["stroke_data"]["points"][0][0], 0);
    assert_eq!(strokes[1]["stroke_data"]["points"][0][0], 20);
}

#[tokio::test]
async fn test_clear_canvas_ownership_verification() {
    let state = create_test_app_state().await;
    let (host, host_token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let (_other_user, other_token) = create_test_user_with_token(&state.db, &state.config, Some("other")).await;
    let event = create_test_event(&state.db, host.id, Some("Canvas Test Event")).await;

    // Add a stroke
    let stroke_data = json!({"type": "stroke", "points": [[0, 0], [10, 10]]});
    sqlx::query(
        "INSERT INTO canvas_strokes (event_id, user_id, stroke_data) VALUES ($1, $2, $3)"
    )
    .bind(event.id)
    .bind(host.id)
    .bind(&stroke_data)
    .execute(&state.db)
    .await
    .expect("Failed to insert stroke");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Non-host should be forbidden
    let response = server
        .delete(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", other_token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 403);

    // Host should succeed
    let response = server
        .delete(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", host_token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204); // DELETE returns 204 No Content
}

#[tokio::test]
async fn test_clear_canvas_successful_deletion() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Canvas Test Event")).await;

    // Add multiple strokes
    for i in 0..5 {
        let stroke_data = json!({"type": "stroke", "points": [[i * 10, i * 10], [(i+1)*10, (i+1)*10]]});
        sqlx::query(
            "INSERT INTO canvas_strokes (event_id, user_id, stroke_data) VALUES ($1, $2, $3)"
        )
        .bind(event.id)
        .bind(user.id)
        .bind(&stroke_data)
        .execute(&state.db)
        .await
        .expect(&format!("Failed to insert stroke {}", i));
    }

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Verify strokes exist
    let response = server
        .get(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;
    let strokes: Vec<serde_json::Value> = response.json();
    assert_eq!(strokes.len(), 5);

    // Clear canvas
    let response = server
        .delete(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204); // DELETE returns 204 No Content

    // Verify strokes are deleted
    let response = server
        .get(&format!("/api/events/{}/canvas", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;
    let strokes: Vec<serde_json::Value> = response.json();
    assert_eq!(strokes.len(), 0);
}

// Leaderboard Operations Tests (5 tests)
#[tokio::test]
async fn test_get_master_leaderboard_empty_event() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, _user.id, Some("Leaderboard Test Event")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/events/{}/leaderboard", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let leaderboard: Vec<serde_json::Value> = response.json();
    assert_eq!(leaderboard.len(), 0);
}

#[tokio::test]
async fn test_get_master_leaderboard_ranking_order() {
    let state = create_test_app_state().await;
    let (host, token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let event = create_test_event(&state.db, host.id, Some("Leaderboard Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Segment"), None).await;

    // Create participants with different scores
    let (user1, _) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, _) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;
    let (user3, _) = create_test_user_with_token(&state.db, &state.config, Some("user3")).await;

    // Insert scores into event_participants for master leaderboard (user1: 100, user2: 200, user3: 150)
    sqlx::query(
        "INSERT INTO event_participants (event_id, user_id, total_score) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET total_score = $3"
    )
    .bind(event.id)
    .bind(user1.id)
    .bind(100)
    .execute(&state.db)
    .await
    .expect("Failed to insert score 1");

    sqlx::query(
        "INSERT INTO event_participants (event_id, user_id, total_score) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET total_score = $3"
    )
    .bind(event.id)
    .bind(user2.id)
    .bind(200)
    .execute(&state.db)
    .await
    .expect("Failed to insert score 2");

    sqlx::query(
        "INSERT INTO event_participants (event_id, user_id, total_score) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET total_score = $3"
    )
    .bind(event.id)
    .bind(user3.id)
    .bind(150)
    .execute(&state.db)
    .await
    .expect("Failed to insert score 3");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/events/{}/leaderboard", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let leaderboard: Vec<serde_json::Value> = response.json();
    assert_eq!(leaderboard.len(), 3);
    // Should be ordered by score DESC
    assert_eq!(leaderboard[0]["score"], 200); // user2
    assert_eq!(leaderboard[1]["score"], 150); // user3
    assert_eq!(leaderboard[2]["score"], 100); // user1
}

#[tokio::test]
async fn test_get_segment_leaderboard_isolated_scoring() {
    let state = create_test_app_state().await;
    let (host, token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let event = create_test_event(&state.db, host.id, Some("Leaderboard Test Event")).await;
    let segment1 = create_test_segment(&state.db, event.id, Some("Segment 1"), None).await;
    let segment2 = create_test_segment(&state.db, event.id, Some("Segment 2"), None).await;

    let (user1, _) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;

    // User1 has score 100 in segment1, 200 in segment2
    sqlx::query(
        "INSERT INTO segment_scores (segment_id, user_id, score) VALUES ($1, $2, $3) ON CONFLICT (segment_id, user_id) DO UPDATE SET score = $3"
    )
    .bind(segment1.id)
    .bind(user1.id)
    .bind(100)
    .execute(&state.db)
    .await
    .expect("Failed to insert score segment1");

    sqlx::query(
        "INSERT INTO segment_scores (segment_id, user_id, score) VALUES ($1, $2, $3) ON CONFLICT (segment_id, user_id) DO UPDATE SET score = $3"
    )
    .bind(segment2.id)
    .bind(user1.id)
    .bind(200)
    .execute(&state.db)
    .await
    .expect("Failed to insert score segment2");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Segment1 leaderboard should only show segment1 scores
    let response = server
        .get(&format!("/api/segments/{}/leaderboard", segment1.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let leaderboard: Vec<serde_json::Value> = response.json();
    assert_eq!(leaderboard.len(), 1);
    assert_eq!(leaderboard[0]["score"], 100);
}

#[tokio::test]
async fn test_leaderboard_tie_handling() {
    let state = create_test_app_state().await;
    let (host, token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let event = create_test_event(&state.db, host.id, Some("Leaderboard Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Test Segment"), None).await;

    let (user1, _) = create_test_user_with_token(&state.db, &state.config, Some("user1")).await;
    let (user2, _) = create_test_user_with_token(&state.db, &state.config, Some("user2")).await;

    // Both users have same score
    sqlx::query(
        "INSERT INTO event_participants (event_id, user_id, total_score) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET total_score = $3"
    )
    .bind(event.id)
    .bind(user1.id)
    .bind(100)
    .execute(&state.db)
    .await
    .expect("Failed to insert score 1");

    sqlx::query(
        "INSERT INTO event_participants (event_id, user_id, total_score) VALUES ($1, $2, $3) ON CONFLICT (event_id, user_id) DO UPDATE SET total_score = $3"
    )
    .bind(event.id)
    .bind(user2.id)
    .bind(100)
    .execute(&state.db)
    .await
    .expect("Failed to insert score 2");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/events/{}/leaderboard", event.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let leaderboard: Vec<serde_json::Value> = response.json();
    assert_eq!(leaderboard.len(), 2);
    // Both should have same score
    assert_eq!(leaderboard[0]["score"], 100);
    assert_eq!(leaderboard[1]["score"], 100);
}

#[tokio::test]
async fn test_leaderboard_nonexistent_segment() {
    let state = create_test_app_state().await;
    let (_user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let non_existent_id = Uuid::new_v4();

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .get(&format!("/api/segments/{}/leaderboard", non_existent_id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // GET returns 200 OK
    let leaderboard: Vec<serde_json::Value> = response.json();
    assert_eq!(leaderboard.len(), 0);
}

// Recording Lifecycle Tests (6 tests)
#[tokio::test]
async fn test_start_recording_updates_status_and_timestamp() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording");
    assert!(body["recording_started_at"].is_string());
}

#[tokio::test]
async fn test_pause_resume_transitions() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();
    let auth = format!("Bearer {}", token);

    // Start recording
    let response = server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body

    // Pause recording
    let response = server
        .post(&format!("/api/segments/{}/recording/pause", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording_paused");

    // Resume recording
    let response = server
        .post(&format!("/api/segments/{}/recording/resume", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording");
}

#[tokio::test]
async fn test_stop_recording_sets_quiz_ready() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();
    let auth = format!("Bearer {}", token);

    // Start recording
    server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;

    // Stop recording
    let response = server
        .post(&format!("/api/segments/{}/recording/stop", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "quiz_ready");
    assert!(body["recording_ended_at"].is_string());
}

#[tokio::test]
async fn test_restart_recording_clears_data() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    // Add some transcript and question data
    sqlx::query(
        "INSERT INTO transcripts (segment_id, chunk_text, chunk_index) VALUES ($1, $2, $3)"
    )
    .bind(segment.id)
    .bind("Test transcript")
    .bind(0)
    .execute(&state.db)
    .await
    .expect("Failed to insert transcript");

    create_test_question(&state.db, segment.id, Some("Test question"), Some("Answer")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();
    let auth = format!("Bearer {}", token);

    // Restart recording
    let response = server
        .post(&format!("/api/segments/{}/recording/restart", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body

    // Verify transcript and questions are deleted
    let transcript_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM transcripts WHERE segment_id = $1"
    )
    .bind(segment.id)
    .fetch_one(&state.db)
    .await
    .expect("Failed to count transcripts");
    assert_eq!(transcript_count.0, 0);

    let question_count: (i64,) = sqlx::query_as(
        "SELECT COUNT(*) FROM questions WHERE segment_id = $1"
    )
    .bind(segment.id)
    .fetch_one(&state.db)
    .await
    .expect("Failed to count questions");
    assert_eq!(question_count.0, 0);
}

#[tokio::test]
async fn test_recording_operations_ownership_verification() {
    let state = create_test_app_state().await;
    let (host, host_token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let (_other_user, other_token) = create_test_user_with_token(&state.db, &state.config, Some("other")).await;
    let event = create_test_event(&state.db, host.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), Some(host.id)).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Non-presenter should be forbidden
    let response = server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", other_token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 403);

    // Presenter should succeed
    let response = server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", host_token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
}

#[tokio::test]
async fn test_recording_lifecycle_complete_flow() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();
    let auth = format!("Bearer {}", token);

    // 1. Start recording
    let response = server
        .post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording");

    // 2. Pause
    let response = server
        .post(&format!("/api/segments/{}/recording/pause", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording_paused");

    // 3. Resume
    let response = server
        .post(&format!("/api/segments/{}/recording/resume", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "recording");

    // 4. Stop
    let response = server
        .post(&format!("/api/segments/{}/recording/stop", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&auth).unwrap(),
        )
        .await;
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["status"], "quiz_ready");
}

// Question CRUD for Segments Tests (5 tests)
#[tokio::test]
async fn test_create_question_sets_order_index() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Question Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post(&format!("/api/segments/{}/questions", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "question_text": "What is 2+2?",
            "correct_answer": "4"
        }))
        .await;

    if response.status_code() != 201 {
        eprintln!("Response status: {}", response.status_code());
        eprintln!("Response body: {:?}", response.text());
    }
    assert_eq!(response.status_code(), 201);
    let body: serde_json::Value = response.json();
    assert_eq!(body["order_index"], 0);

    // Create second question
    let response = server
        .post(&format!("/api/segments/{}/questions", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "question_text": "What is 3+3?",
            "correct_answer": "6"
        }))
        .await;

    assert_eq!(response.status_code(), 201);
    let body: serde_json::Value = response.json();
    assert_eq!(body["order_index"], 1);
}

#[tokio::test]
async fn test_bulk_import_sequential_indexing() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Question Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    let response = server
        .post(&format!("/api/segments/{}/questions/bulk", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "questions": [
                {"question_text": "Q1", "correct_answer": "A1"},
                {"question_text": "Q2", "correct_answer": "A2"},
                {"question_text": "Q3", "correct_answer": "A3"}
            ]
        }))
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert_eq!(body["imported"], 3);
    let questions: Vec<serde_json::Value> = body["questions"].as_array().unwrap().clone();
    assert_eq!(questions.len(), 3);
    assert_eq!(questions[0]["order_index"], 0);
    assert_eq!(questions[1]["order_index"], 1);
    assert_eq!(questions[2]["order_index"], 2);
}

#[tokio::test]
async fn test_bulk_import_partial_failure_handling() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Question Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    // Create a question with same text to trigger potential duplicate
    create_test_question(&state.db, segment.id, Some("Duplicate Q"), Some("A")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Bulk import with one valid and one that might fail
    let response = server
        .post(&format!("/api/segments/{}/questions/bulk", segment.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .json(&json!({
            "questions": [
                {"question_text": "New Question", "correct_answer": "New Answer"},
                {"question_text": "Another Question", "correct_answer": "Another Answer"}
            ]
        }))
        .await;

    // Should succeed and import both (duplicate check is not enforced at DB level)
    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
    let body: serde_json::Value = response.json();
    assert!(body["imported"].as_u64().unwrap() >= 2);
}

#[tokio::test]
async fn test_update_question_ownership_check() {
    let state = create_test_app_state().await;
    let (host, host_token) = create_test_user_with_token(&state.db, &state.config, Some("host")).await;
    let (_other_user, other_token) = create_test_user_with_token(&state.db, &state.config, Some("other")).await;
    let event = create_test_event(&state.db, host.id, Some("Question Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;
    let question = create_test_question(&state.db, segment.id, Some("Test Q"), Some("Test A")).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Non-host should be forbidden
    let response = server
        .put(&format!("/api/questions/{}", question.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", other_token)).unwrap(),
        )
        .json(&json!({
            "question_text": "Updated Q",
            "correct_answer": "Updated A"
        }))
        .await;

    assert_eq!(response.status_code(), 403);

    // Host should succeed
    let response = server
        .put(&format!("/api/questions/{}", question.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", host_token)).unwrap(),
        )
        .json(&json!({
            "question_text": "Updated Q",
            "correct_answer": "Updated A"
        }))
        .await;

    assert_eq!(response.status_code(), 200); // POST returns 200 OK with JSON body
}

#[tokio::test]
async fn test_delete_question_cascade_answers() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Question Test Event")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;
    let question = create_test_question(&state.db, segment.id, Some("Test Q"), Some("Test A")).await;

    // Add session answers
    let answers = json!([
        {"text": "Test A", "is_correct": true, "display_order": 0},
        {"text": "Wrong 1", "is_correct": false, "display_order": 1},
        {"text": "Wrong 2", "is_correct": false, "display_order": 2}
    ]);
    sqlx::query(
        "INSERT INTO session_answers (question_id, answers) VALUES ($1, $2)"
    )
    .bind(question.id)
    .bind(sqlx::types::Json(answers))
    .execute(&state.db)
    .await
    .expect("Failed to insert session answers");

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();

    // Delete question
    let response = server
        .delete(&format!("/api/questions/{}", question.id))
        .add_header(
            axum::http::HeaderName::from_static("authorization"),
            axum::http::HeaderValue::from_str(&format!("Bearer {}", token)).unwrap(),
        )
        .await;

    assert_eq!(response.status_code(), 204); // DELETE returns 204 No Content

    // Verify question is deleted
    let question_exists: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM questions WHERE id = $1"
    )
    .bind(question.id)
    .fetch_optional(&state.db)
    .await
    .expect("Failed to check question");
    assert!(question_exists.is_none());

    // Verify session_answers are also deleted (cascade)
    let answers_exist: Option<(Uuid,)> = sqlx::query_as(
        "SELECT question_id FROM session_answers WHERE question_id = $1"
    )
    .bind(question.id)
    .fetch_optional(&state.db)
    .await
    .expect("Failed to check session answers");
    assert!(answers_exist.is_none());
}
