use axum_test::TestServer;
use std::sync::Arc;
use aws_sdk_s3::Client as S3Client;
use quiz_backend::{create_app, test_utils, AppState};
use quiz_backend::ws::hub::Hub;
use quiz_backend::models::{User, Event, Segment, Question};
use quiz_backend::auth::jwt::generate_token;
use uuid::Uuid;

/// Create a test user with a JWT token
pub async fn create_test_user_with_token(
    pool: &sqlx::PgPool,
    config: &quiz_backend::config::Config,
    username: Option<&str>,
) -> (User, String) {
    let username = username.map(|s| s.to_string()).unwrap_or_else(|| {
        format!("testuser_{}", Uuid::new_v4().to_string().split('-').next().unwrap())
    });
    
    // Make sure username is unique even if provided
    let unique_username = if username.starts_with("user") {
        format!("{}_{}", username, Uuid::new_v4().to_string().split('-').next().unwrap())
    } else {
        username
    };

    let user_id = Uuid::new_v4();
    let password_hash = "$argon2id$v=19$m=19456,t=2,p=1$test_salt$test_hash"; // Dummy hash for testing

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, email, password_hash, role, avatar_url, avatar_type)
        VALUES ($1, $2, $3, $4, 'participant', $5, $6)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(unique_username.as_str())
    .bind(format!("{}@quizapp.local", unique_username))
    .bind(password_hash)
    .bind(Some("😀"))
    .bind(Some("emoji"))
    .fetch_one(pool)
    .await
    .expect("Failed to create test user");

    let token = generate_token(user.id, &user.role, &config.jwt_secret, config.jwt_expiry_hours)
        .expect("Failed to generate token");

    (user, token)
}

/// Create a test event with a host
pub async fn create_test_event(
    pool: &sqlx::PgPool,
    host_id: Uuid,
    title: Option<&str>,
) -> Event {
    let title = title.unwrap_or("Test Event");
    // Generate a 6-character join code (database constraint)
    let uuid_part = Uuid::new_v4().to_string().replace('-', "").chars().take(5).collect::<String>();
    let join_code = format!("T{}", uuid_part).to_uppercase();

    sqlx::query_as::<_, Event>(
        r#"
        INSERT INTO events (host_id, title, description, join_code, mode, num_fake_answers, time_per_question, question_gen_interval_seconds)
        VALUES ($1, $2, $3, $4, 'listen_only', 3, 30, 30)
        RETURNING *
        "#,
    )
    .bind(host_id)
    .bind(title)
    .bind(Some("Test description"))
    .bind(join_code)
    .fetch_one(pool)
    .await
    .expect("Failed to create test event")
}

/// Create a test segment for an event
pub async fn create_test_segment(
    pool: &sqlx::PgPool,
    event_id: Uuid,
    presenter_name: Option<&str>,
    presenter_user_id: Option<Uuid>,
) -> Segment {
    let presenter_name = presenter_name.unwrap_or("Test Presenter");

    // Get the next order index
    let next_index: (i32,) = sqlx::query_as(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM segments WHERE event_id = $1"
    )
    .bind(event_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get next order index");

    sqlx::query_as::<_, Segment>(
        r#"
        INSERT INTO segments (event_id, presenter_name, presenter_user_id, title, order_index, status)
        VALUES ($1, $2, $3, $4, $5, 'pending')
        RETURNING *
        "#,
    )
    .bind(event_id)
    .bind(presenter_name)
    .bind(presenter_user_id)
    .bind(Some("Test Segment"))
    .bind(next_index.0)
    .fetch_one(pool)
    .await
    .expect("Failed to create test segment")
}

/// Create a test question for a segment
pub async fn create_test_question(
    pool: &sqlx::PgPool,
    segment_id: Uuid,
    question_text: Option<&str>,
    correct_answer: Option<&str>,
) -> Question {
    let question_text = question_text.unwrap_or("What is 2+2?");
    let correct_answer = correct_answer.unwrap_or("4");

    // Get the next order index
    let next_index: (i32,) = sqlx::query_as(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM questions WHERE segment_id = $1"
    )
    .bind(segment_id)
    .fetch_one(pool)
    .await
    .expect("Failed to get next order index");

    sqlx::query_as::<_, Question>(
        r#"
        INSERT INTO questions (segment_id, question_text, correct_answer, order_index, is_ai_generated)
        VALUES ($1, $2, $3, $4, false)
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .bind(question_text)
    .bind(correct_answer)
    .bind(next_index.0)
    .fetch_one(pool)
    .await
    .expect("Failed to create test question")
}

/// Create an authenticated request helper
pub fn create_authenticated_request(token: &str) -> (axum::http::HeaderName, axum::http::HeaderValue) {
    (
        axum::http::HeaderName::from_static("authorization"),
        axum::http::HeaderValue::from_str(&format!("Bearer {}", token))
            .expect("Failed to create auth header"),
    )
}

/// Create a test app state with all dependencies
pub async fn create_test_app_state() -> AppState {
    let pool = test_utils::setup_test_db().await;
    let config = test_utils::test_config();
    let hub = Arc::new(Hub::new());
    
    // Create a minimal S3 client for testing
    let s3_config = aws_config::from_env().load().await;
    let s3_client = S3Client::new(&s3_config);

    AppState {
        db: pool,
        config: Arc::new(config),
        hub,
        s3_client,
    }
}

/// Create a test server with app state
pub async fn create_test_server() -> (TestServer, AppState) {
    let state = create_test_app_state().await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).expect("Failed to create test server");
    (server, state)
}

/// Create a test server with a pre-created user and token
pub async fn create_test_server_with_user() -> (TestServer, AppState, User, String) {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let app = create_app(state.clone());
    let server = TestServer::new(app).expect("Failed to create test server");
    (server, state, user, token)
}
