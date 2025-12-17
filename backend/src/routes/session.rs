use axum::{
    extract::{Extension, Path, State},
    Json,
};
use rand::Rng;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, Result};
use crate::models::{
    CreateSessionRequest, GameSession, ParticipantInfo, Quiz, SessionParticipant,
    SessionResponse, User,
};
use crate::AppState;

/// Generate a random 6-character join code
fn generate_join_code() -> String {
    const CHARSET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// Create a new game session
pub async fn create_session(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateSessionRequest>,
) -> Result<Json<SessionResponse>> {
    if auth_user.role != "presenter" {
        return Err(AppError::Forbidden);
    }

    // Verify quiz ownership
    let _quiz = sqlx::query_as::<_, Quiz>("SELECT * FROM quizzes WHERE id = $1 AND presenter_id = $2")
        .bind(req.quiz_id)
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("Quiz not found".to_string()))?;

    // Generate unique join code
    let mut join_code = generate_join_code();
    let mut attempts = 0;
    while attempts < 10 {
        let existing: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM game_sessions WHERE join_code = $1 AND status != 'finished'",
        )
        .bind(&join_code)
        .fetch_one(&state.db)
        .await?;

        if existing == 0 {
            break;
        }
        join_code = generate_join_code();
        attempts += 1;
    }

    // Create session
    let session = sqlx::query_as::<_, GameSession>(
        r#"
        INSERT INTO game_sessions (id, quiz_id, join_code, status, current_question_index)
        VALUES ($1, $2, $3, 'waiting', 0)
        RETURNING *
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(req.quiz_id)
    .bind(&join_code)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(SessionResponse {
        id: session.id,
        quiz_id: session.quiz_id,
        join_code: session.join_code,
        status: session.status,
        current_question_index: session.current_question_index.unwrap_or(0),
        participants: vec![],
    }))
}

/// Get session info by join code
pub async fn get_session(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<SessionResponse>> {
    let session = sqlx::query_as::<_, GameSession>(
        "SELECT * FROM game_sessions WHERE join_code = $1",
    )
    .bind(&code.to_uppercase())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Session not found".to_string()))?;

    // Get participants with user info
    let participants = sqlx::query_as::<_, (Uuid, String, Option<String>, Option<i32>)>(
        r#"
        SELECT u.id, u.username, u.avatar_url, sp.total_score
        FROM session_participants sp
        JOIN users u ON u.id = sp.user_id
        WHERE sp.session_id = $1
        ORDER BY sp.total_score DESC
        "#,
    )
    .bind(session.id)
    .fetch_all(&state.db)
    .await?
    .into_iter()
    .map(|(user_id, username, avatar_url, total_score)| ParticipantInfo {
        user_id,
        username,
        avatar_url,
        total_score: total_score.unwrap_or(0),
    })
    .collect();

    Ok(Json(SessionResponse {
        id: session.id,
        quiz_id: session.quiz_id,
        join_code: session.join_code,
        status: session.status,
        current_question_index: session.current_question_index.unwrap_or(0),
        participants,
    }))
}

/// Join a game session
pub async fn join_session(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(code): Path<String>,
) -> Result<Json<SessionResponse>> {
    // Find session
    let session = sqlx::query_as::<_, GameSession>(
        "SELECT * FROM game_sessions WHERE join_code = $1",
    )
    .bind(&code.to_uppercase())
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Session not found".to_string()))?;

    // Check if session is joinable
    if session.status == "finished" {
        return Err(AppError::Validation("Session has already ended".to_string()));
    }

    // Check if user is already in the session
    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM session_participants WHERE session_id = $1 AND user_id = $2",
    )
    .bind(session.id)
    .bind(auth_user.id)
    .fetch_one(&state.db)
    .await?;

    if existing == 0 {
        // Add participant to session
        sqlx::query(
            r#"
            INSERT INTO session_participants (id, session_id, user_id, total_score)
            VALUES ($1, $2, $3, 0)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(session.id)
        .bind(auth_user.id)
        .execute(&state.db)
        .await?;
    }

    // Return updated session info
    get_session(State(state), Path(code)).await
}
