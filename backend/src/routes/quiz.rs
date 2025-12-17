use axum::{
    extract::{Path, State},
    Extension, Json,
    http::StatusCode,
};
use uuid::Uuid;
use rand::Rng;
use sqlx::Row;

use crate::auth::middleware::AuthUser;
use crate::error::{AppError, Result};
use crate::models::*;
use crate::models::question::LeaderboardEntry as ModelLeaderboardEntry;
use crate::AppState;

/// Generate a unique 6-character join code
fn generate_join_code() -> String {
    const CHARSET: &[u8] = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    let mut rng = rand::thread_rng();
    (0..6)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

/// List all events for the current user (both hosted and joined)
pub async fn list_quizzes(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<Vec<EventResponse>>> {
    // Get events hosted by user
    let hosted = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE host_id = $1 ORDER BY created_at DESC"
    )
    .bind(auth_user.id)
    .fetch_all(&state.db)
    .await?;

    let events: Vec<EventResponse> = hosted.into_iter().map(|e| e.into()).collect();
    Ok(Json(events))
}

/// Create a new event
pub async fn create_quiz(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateEventRequest>,
) -> Result<Json<EventResponse>> {
    let join_code = generate_join_code();
    let mode = req.mode.unwrap_or_else(|| "listen_only".to_string());
    let num_fake_answers = req.num_fake_answers.unwrap_or(3);
    let time_per_question = req.time_per_question.unwrap_or(30);

    let event = sqlx::query_as::<_, Event>(
        r#"
        INSERT INTO events (host_id, title, description, join_code, mode, num_fake_answers, time_per_question)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
        "#,
    )
    .bind(auth_user.id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(join_code)
    .bind(mode)
    .bind(num_fake_answers)
    .bind(time_per_question)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(event.into()))
}

/// Get a specific event with its segments
pub async fn get_quiz(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<EventResponse>> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    Ok(Json(event.into()))
}

/// Update an event
pub async fn update_quiz(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<UpdateEventRequest>,
) -> Result<Json<EventResponse>> {
    // Verify ownership
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Event>(
        r#"
        UPDATE events
        SET title = COALESCE($2, title),
            description = COALESCE($3, description),
            status = COALESCE($4, status),
            num_fake_answers = COALESCE($5, num_fake_answers),
            time_per_question = COALESCE($6, time_per_question)
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&req.title)
    .bind(&req.description)
    .bind(&req.status)
    .bind(req.num_fake_answers)
    .bind(req.time_per_question)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Delete an event
pub async fn delete_quiz(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<StatusCode> {
    // Verify ownership
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM events WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Add a segment to an event
pub async fn add_question(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<CreateSegmentRequest>,
) -> Result<Json<SegmentResponse>> {
    // Verify event ownership
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Get the next order index
    let next_index: (i64,) = sqlx::query_as(
        "SELECT COALESCE(MAX(order_index), -1) + 1 FROM segments WHERE event_id = $1"
    )
    .bind(id)
    .fetch_one(&state.db)
    .await?;

    let segment = sqlx::query_as::<_, Segment>(
        r#"
        INSERT INTO segments (event_id, presenter_name, title, order_index, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING *
        "#,
    )
    .bind(id)
    .bind(&req.presenter_name)
    .bind(&req.title)
    .bind(next_index.0 as i32)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(segment.into()))
}

/// Update a segment
pub async fn update_question(
    State(state): State<AppState>,
    Path((event_id, segment_id)): Path<(Uuid, Uuid)>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<UpdateSegmentRequest>,
) -> Result<Json<SegmentResponse>> {
    // Verify event ownership
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let segment = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET presenter_name = COALESCE($2, presenter_name),
            title = COALESCE($3, title),
            status = COALESCE($4, status)
        WHERE id = $1 AND event_id = $5
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .bind(&req.presenter_name)
    .bind(&req.title)
    .bind(&req.status)
    .bind(event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    Ok(Json(segment.into()))
}

/// Delete a segment
pub async fn delete_question(
    State(state): State<AppState>,
    Path((event_id, segment_id)): Path<(Uuid, Uuid)>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<StatusCode> {
    // Verify event ownership
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    sqlx::query(
        "DELETE FROM segments WHERE id = $1 AND event_id = $2"
    )
    .bind(segment_id)
    .bind(event_id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get event by join code
pub async fn get_event_by_code(
    State(state): State<AppState>,
    Path(code): Path<String>,
) -> Result<Json<EventResponse>> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE join_code = $1"
    )
    .bind(code)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    Ok(Json(event.into()))
}

/// Get event with segments
pub async fn get_event_with_segments(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<serde_json::Value>> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    let segments = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE event_id = $1 ORDER BY order_index ASC"
    )
    .bind(id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(serde_json::json!({
        "event": event,
        "segments": segments.into_iter().map(|s| SegmentResponse::from(s)).collect::<Vec<_>>()
    })))
}

/// Start recording for a segment
pub async fn start_recording(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<SegmentResponse>> {
    // Get segment and verify event ownership
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(segment.event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET status = 'recording',
            recording_started_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Pause recording for a segment
pub async fn pause_recording(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<SegmentResponse>> {
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(segment.event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET status = 'recording_paused'
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Resume recording for a segment
pub async fn resume_recording(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<SegmentResponse>> {
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(segment.event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET status = 'recording'
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Stop recording and mark segment as quiz_ready
pub async fn stop_recording(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<SegmentResponse>> {
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(segment.event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    let updated = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET status = 'quiz_ready',
            recording_ended_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Restart recording (clear transcript and questions)
pub async fn restart_recording(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<SegmentResponse>> {
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Segment not found".to_string()))?;

    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(segment.event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Delete transcripts and questions for this segment
    sqlx::query("DELETE FROM transcripts WHERE segment_id = $1")
        .bind(segment_id)
        .execute(&state.db)
        .await?;

    sqlx::query("DELETE FROM questions WHERE segment_id = $1")
        .bind(segment_id)
        .execute(&state.db)
        .await?;

    let updated = sqlx::query_as::<_, Segment>(
        r#"
        UPDATE segments
        SET status = 'pending',
            recording_started_at = NULL,
            recording_ended_at = NULL,
            quiz_started_at = NULL
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(updated.into()))
}

/// Get questions for a segment
pub async fn get_segment_questions(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
) -> Result<Json<Vec<crate::models::QuestionResponse>>> {
    use crate::models::Question;
    
    let questions = sqlx::query_as::<_, Question>(
        "SELECT * FROM questions WHERE segment_id = $1 ORDER BY order_index ASC"
    )
    .bind(segment_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(questions.into_iter().map(|q| q.into()).collect()))
}

/// Update a question (by question ID)
pub async fn update_question_by_id(
    State(state): State<AppState>,
    Path(question_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<crate::models::UpdateQuestionRequest>,
) -> Result<Json<crate::models::QuestionResponse>> {
    use crate::models::Question;
    
    // Verify question ownership through segment -> event
    let host_id_result: Option<(Uuid,)> = sqlx::query_as(
        "SELECT e.host_id FROM questions q 
         JOIN segments s ON q.segment_id = s.id 
         JOIN events e ON s.event_id = e.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(&state.db)
    .await?;

    let host_id = host_id_result.ok_or(AppError::NotFound("Question not found".to_string()))?.0;
    
    if host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Update question
    let updated = sqlx::query_as::<_, Question>(
        r#"
        UPDATE questions
        SET question_text = COALESCE($2, question_text),
            correct_answer = COALESCE($3, correct_answer),
            order_index = COALESCE($4, order_index)
        WHERE id = $1
        RETURNING *
        "#
    )
    .bind(question_id)
    .bind(&req.question_text)
    .bind(&req.correct_answer)
    .bind(&req.order_index)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Question not found".to_string()))?;

    Ok(Json(updated.into()))
}

/// Delete a question (by question ID)
pub async fn delete_question_by_id(
    State(state): State<AppState>,
    Path(question_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<StatusCode> {
    // Verify question ownership through segment -> event
    let host_id_result: Option<(Uuid,)> = sqlx::query_as(
        "SELECT e.host_id FROM questions q 
         JOIN segments s ON q.segment_id = s.id 
         JOIN events e ON s.event_id = e.id 
         WHERE q.id = $1"
    )
    .bind(question_id)
    .fetch_optional(&state.db)
    .await?;

    let host_id = host_id_result.ok_or(AppError::NotFound("Question not found".to_string()))?.0;
    
    if host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    // Delete question
    sqlx::query("DELETE FROM questions WHERE id = $1")
        .bind(question_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

/// Get master leaderboard for an event
pub async fn get_master_leaderboard(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<ModelLeaderboardEntry>>> {
    let rankings = sqlx::query_as::<_, ModelLeaderboardEntry>(
        r#"
        SELECT 
            ROW_NUMBER() OVER (ORDER BY ep.total_score DESC) as rank,
            ep.user_id,
            u.username,
            u.avatar_url,
            ep.total_score as score
        FROM event_participants ep
        JOIN users u ON ep.user_id = u.id
        WHERE ep.event_id = $1
        ORDER BY ep.total_score DESC
        "#,
    )
    .bind(event_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rankings))
}

/// Get segment leaderboard
pub async fn get_segment_leaderboard(
    State(state): State<AppState>,
    Path(segment_id): Path<Uuid>,
) -> Result<Json<Vec<ModelLeaderboardEntry>>> {
    let rankings = sqlx::query_as::<_, ModelLeaderboardEntry>(
        r#"
        SELECT 
            ROW_NUMBER() OVER (ORDER BY ss.score DESC) as rank,
            ss.user_id,
            u.username,
            u.avatar_url,
            ss.score
        FROM segment_scores ss
        JOIN users u ON ss.user_id = u.id
        WHERE ss.segment_id = $1
        ORDER BY ss.score DESC
        "#,
    )
    .bind(segment_id)
    .fetch_all(&state.db)
    .await?;

    Ok(Json(rankings))
}

/// Get canvas strokes for an event
pub async fn get_canvas_strokes(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
) -> Result<Json<Vec<serde_json::Value>>> {
    let strokes = sqlx::query(
        r#"
        SELECT stroke_data, created_at, user_id
        FROM canvas_strokes
        WHERE event_id = $1
        ORDER BY created_at ASC
        "#,
    )
    .bind(event_id)
    .fetch_all(&state.db)
    .await?;

    let mut result = Vec::new();
    for row in strokes {
        let stroke_data: serde_json::Value = row.try_get("stroke_data")?;
        let created_at: chrono::DateTime<chrono::Utc> = row.try_get("created_at")?;
        let user_id: Uuid = row.try_get("user_id")?;
        
        result.push(serde_json::json!({
            "stroke_data": stroke_data,
            "created_at": created_at,
            "user_id": user_id
        }));
    }

    Ok(Json(result))
}

/// Clear canvas (host only)
pub async fn clear_canvas(
    State(state): State<AppState>,
    Path(event_id): Path<Uuid>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<StatusCode> {
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("Event not found".to_string()))?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden);
    }

    sqlx::query("DELETE FROM canvas_strokes WHERE event_id = $1")
        .bind(event_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}
