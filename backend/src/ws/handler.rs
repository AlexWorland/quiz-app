use axum::extract::ws::{WebSocket, Message};
use futures::{SinkExt, StreamExt};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use rand::seq::SliceRandom;
use rand::thread_rng;
use sqlx::Row;

use crate::AppState;
use crate::ws::messages::{GameMessage, ServerMessage, ParticipantMessage};
use crate::ws::hub::Participant;
use crate::services::scoring::calculate_speed_based_score;
use crate::services::ai::{AIProvider, ClaudeProvider, OpenAIProvider, OllamaProvider};
use crate::services::crypto::decrypt_string;
use crate::error::Result;

/// Helper macro to unwrap_or with logging when default is used
/// Usage: unwrap_or_log!(value, default, "message")
macro_rules! unwrap_or_log {
    ($value:expr, $default:expr, $message:expr) => {
        match $value {
            Some(v) => v,
            None => {
                tracing::warn!("Using default value for {}: {:?}", $message, $default);
                $default
            }
        }
    };
}

/// Safely serialize a value to JSON string, returning error message on failure
fn serialize_to_json<T: serde::Serialize>(value: &T) -> std::result::Result<String, String> {
    serde_json::to_string(value)
        .map_err(|e| format!("JSON serialization failed: {}", e))
}

/// Safely serialize a value to JSON Value, returning error message on failure
fn serialize_to_json_value<T: serde::Serialize>(value: &T) -> std::result::Result<serde_json::Value, String> {
    serde_json::to_value(value)
        .map_err(|e| format!("JSON serialization failed: {}", e))
}

/// Safely send a message through WebSocket, logging errors instead of panicking
async fn send_ws_message<T: serde::Serialize>(
    tx: &tokio::sync::mpsc::UnboundedSender<String>,
    message: T,
) {
    match serialize_to_json(&message) {
        Ok(json_str) => {
            if let Err(e) = tx.send(json_str) {
                tracing::warn!("Failed to send WebSocket message: {}", e);
            }
        }
        Err(e) => {
            tracing::error!("Failed to serialize WebSocket message: {}", e);
            // Send error message to client
            let error_msg = ServerMessage::Error {
                message: "Internal error: failed to serialize message".to_string(),
            };
            if let Ok(error_json) = serialize_to_json(&error_msg) {
                let _ = tx.send(error_json);
            }
        }
    }
}

/// Safely broadcast a message to all event participants, logging errors
async fn broadcast_ws_message<T: serde::Serialize>(
    hub: &std::sync::Arc<crate::ws::hub::Hub>,
    event_id: uuid::Uuid,
    message: T,
) {
    match serialize_to_json_value(&message) {
        Ok(json_value) => {
            hub.broadcast_to_event(event_id, &json_value).await;
        }
        Err(e) => {
            tracing::error!("Failed to serialize broadcast message: {}", e);
        }
    }
}

/// Check if user is authorized to control the current segment
/// Returns true if user is event host OR segment presenter
async fn is_segment_controller(
    db: &sqlx::PgPool,
    event_id: Uuid,
    segment_id: Uuid,
    user_id: Uuid,
) -> Result<bool> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM events e
            JOIN segments s ON s.event_id = e.id
            WHERE e.id = $1
              AND s.id = $2
              AND (e.host_id = $3 OR s.presenter_user_id = $3)
        )
        "#
    )
    .bind(event_id)
    .bind(segment_id)
    .bind(user_id)
    .fetch_one(db)
    .await?;

    Ok(result)
}

/// Get all segment winners for an event
async fn get_all_segment_winners(
    db: &sqlx::PgPool,
    event_id: Uuid,
) -> Result<Vec<crate::ws::messages::SegmentWinner>> {
    let rows = sqlx::query(
        r#"
        SELECT
            s.id as segment_id,
            COALESCE(s.title, s.presenter_name) as segment_title,
            u.username as winner_name,
            ss.score as winner_score
        FROM segments s
        LEFT JOIN LATERAL (
            SELECT user_id, score
            FROM segment_scores
            WHERE segment_id = s.id
            ORDER BY score DESC
            LIMIT 1
        ) ss ON true
        LEFT JOIN users u ON ss.user_id = u.id
        WHERE s.event_id = $1 AND s.status = 'completed'
        ORDER BY s.order_index
        "#
    )
    .bind(event_id)
    .fetch_all(db)
    .await?;

    let mut winners = Vec::new();
    for row in rows {
        winners.push(crate::ws::messages::SegmentWinner {
            segment_id: row.try_get("segment_id")?,
            segment_title: row.try_get::<Option<String>, _>("segment_title")?
                .unwrap_or_else(|| "Untitled Segment".to_string()),
            winner_name: row.try_get::<Option<String>, _>("winner_name")?
                .unwrap_or_else(|| "No winner".to_string()),
            winner_score: row.try_get::<Option<i32>, _>("winner_score")?.unwrap_or(0),
        });
    }

    Ok(winners)
}

/// Trigger event completion when all segments are done
async fn trigger_event_complete(
    state: &AppState,
    event_id: Uuid,
) -> Result<()> {
    // Update event status
    sqlx::query("UPDATE events SET status = 'finished' WHERE id = $1")
        .bind(event_id)
        .execute(&state.db)
        .await?;

    // Calculate final leaderboard
    let final_leaderboard_result = sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
        r#"
        SELECT 
            ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank,
            user_id,
            username,
            avatar_url,
            total_score as score
        FROM (
            SELECT 
                ep.user_id,
                u.username,
                u.avatar_url,
                ep.total_score
            FROM event_participants ep
            JOIN users u ON ep.user_id = u.id
            WHERE ep.event_id = $1
            ORDER BY ep.total_score DESC
        ) ranked
        "#
    )
    .bind(event_id)
    .fetch_all(&state.db)
    .await?;

    let final_leaderboard: Vec<crate::ws::messages::LeaderboardEntry> = final_leaderboard_result
        .into_iter()
        .map(|e| crate::ws::messages::LeaderboardEntry {
            rank: e.rank as i32,
            user_id: e.user_id,
            username: e.username,
            avatar_url: e.avatar_url,
            score: e.score,
        })
        .collect();

    // Get segment winners
    let segment_winners = get_all_segment_winners(&state.db, event_id).await?;

    // Broadcast event complete
    broadcast_ws_message(&state.hub, event_id, crate::ws::messages::ServerMessage::EventComplete {
        event_id,
        final_leaderboard: final_leaderboard.clone(),
        winner: final_leaderboard.first().cloned(),
        segment_winners,
    }).await;

    Ok(())
}

/// Get or generate fake answers for a question
async fn get_or_generate_answers(
    state: &AppState,
    question_id: Uuid,
    question_text: &str,
    correct_answer: &str,
    event_id: Uuid,
) -> Result<Vec<String>> {
    // Check if session_answers already exists
    let existing = sqlx::query_scalar::<_, sqlx::types::Json<Vec<crate::models::question::GeneratedAnswer>>>(
        "SELECT answers FROM session_answers WHERE question_id = $1"
    )
    .bind(question_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(answers_json) = existing {
        // Answers already exist, extract them
        let answers: Vec<crate::models::question::GeneratedAnswer> = answers_json.0;
        let mut all_answers: Vec<String> = answers.iter().map(|a| a.text.clone()).collect();
        
        // Shuffle
        let mut rng = thread_rng();
        all_answers.shuffle(&mut rng);
        
        return Ok(all_answers);
    }

    // Need to generate fake answers
    // Get event to find num_fake_answers and AI provider settings
    let event_info = sqlx::query_as::<_, (i32, Uuid)>(
        "SELECT num_fake_answers, host_id FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error fetching event {}: {}", event_id, e);
        crate::error::AppError::Internal(format!("Failed to fetch event: {}", e))
    })?;

    let (num_fake, host_id) = event_info.ok_or_else(|| crate::error::AppError::Internal("Event not found".to_string()))?;

    // Get AI provider for host (or use default)
    let ai_provider: Box<dyn AIProvider> = {
        // Try to get user's AI settings
        let user_settings = sqlx::query_as::<_, (String, Option<String>, Option<String>)>(
            "SELECT llm_provider, llm_api_key_encrypted, ollama_model FROM user_ai_settings WHERE user_id = $1"
        )
        .bind(host_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error fetching AI settings for user {}: {}", host_id, e);
            crate::error::AppError::Internal(format!("Failed to fetch AI settings: {}", e))
        })?;

        if let Some((provider, key_encrypted, ollama_model)) = user_settings {
            let encryption_key = &state.config.encryption_key;
            
            // Try to decrypt user's API key, fall back to config if decryption fails
            let api_key = if let Some(encrypted) = key_encrypted {
                decrypt_string(&encrypted, encryption_key).ok()
            } else {
                None
            };
            
            match provider.as_str() {
                "claude" => {
                    if let Some(key) = api_key {
                        Box::new(ClaudeProvider::new(key))
                    } else if let Some(api_key) = &state.config.anthropic_api_key {
                        Box::new(ClaudeProvider::new(api_key.clone()))
                    } else {
                        create_default_ai_provider(&state.config)?
                    }
                }
                "openai" => {
                    if let Some(key) = api_key {
                        Box::new(OpenAIProvider::new(key))
                    } else if let Some(api_key) = &state.config.openai_api_key {
                        Box::new(OpenAIProvider::new(api_key.clone()))
                    } else {
                        create_default_ai_provider(&state.config)?
                    }
                }
                "ollama" => {
                    // Use user's configured Ollama model, or fall back to config default
                    let model = ollama_model.unwrap_or_else(|| state.config.ollama_model.clone());
                    Box::new(OllamaProvider::new(
                        state.config.ollama_base_url.clone(),
                        model,
                    ))
                }
                _ => create_default_ai_provider(&state.config)?,
            }
        } else {
            create_default_ai_provider(&state.config)?
        }
    };

    // Generate fake answers
    let fake_answers = ai_provider.generate_fake_answers(
        question_text,
        correct_answer,
        num_fake as usize,
    ).await?;

    // Create GeneratedAnswer structs
    let mut generated_answers: Vec<crate::models::question::GeneratedAnswer> = vec![
        crate::models::question::GeneratedAnswer {
            text: correct_answer.to_string(),
            is_correct: true,
            display_order: 0,
        }
    ];

    for (idx, fake) in fake_answers.iter().enumerate() {
        generated_answers.push(crate::models::question::GeneratedAnswer {
            text: fake.clone(),
            is_correct: false,
            display_order: (idx + 1) as i32,
        });
    }

    // Store in database
    sqlx::query(
        "INSERT INTO session_answers (question_id, answers) VALUES ($1, $2)"
    )
    .bind(question_id)
    .bind(sqlx::types::Json(generated_answers.clone()))
    .execute(&state.db)
    .await?;

    // Extract text and shuffle
    let mut all_answers: Vec<String> = generated_answers.iter().map(|a| a.text.clone()).collect();
    let mut rng = thread_rng();
    all_answers.shuffle(&mut rng);

    Ok(all_answers)
}

/// Get the effective Ollama model for a user, falling back to config default
/// This centralizes the logic for selecting the Ollama model
async fn get_ollama_model(
    user_id: Option<uuid::Uuid>,
    config: &crate::config::Config,
    db: &sqlx::PgPool,
) -> String {
    if let Some(uid) = user_id {
        if let Ok(Some(model)) = sqlx::query_scalar::<_, Option<String>>(
            "SELECT ollama_model FROM user_ai_settings WHERE user_id = $1"
        )
        .bind(uid)
        .fetch_optional(db)
        .await
        {
            if let Some(m) = model {
                if !m.is_empty() {
                    return m;
                }
            }
        }
    }
    config.ollama_model.clone()
}

/// Create default AI provider from config
fn create_default_ai_provider(config: &crate::config::Config) -> Result<Box<dyn AIProvider>> {
    match config.default_ai_provider.as_str() {
        "claude" => {
            let api_key = config.anthropic_api_key.clone()
                .ok_or_else(|| crate::error::AppError::Internal("Claude API key not configured".to_string()))?;
            Ok(Box::new(ClaudeProvider::new(api_key)))
        }
        "openai" => {
            let api_key = config.openai_api_key.clone()
                .ok_or_else(|| crate::error::AppError::Internal("OpenAI API key not configured".to_string()))?;
            Ok(Box::new(OpenAIProvider::new(api_key)))
        }
        "ollama" => {
            Ok(Box::new(OllamaProvider::new(
                config.ollama_base_url.clone(),
                config.ollama_model.clone(),
            )))
        }
        _ => {
            // Default to Claude if available, otherwise OpenAI
            if let Some(api_key) = &config.anthropic_api_key {
                Ok(Box::new(ClaudeProvider::new(api_key.clone())))
            } else if let Some(api_key) = &config.openai_api_key {
                Ok(Box::new(OpenAIProvider::new(api_key.clone())))
            } else {
                Err(crate::error::AppError::Internal("No AI provider configured".to_string()))
            }
        }
    }
}

/// Handle incoming WebSocket connections for game sessions
pub async fn handle_ws_connection(
    socket: WebSocket,
    event_id_str: String,
    state: AppState,
) {
    // Parse event_id from path
    let event_id = match Uuid::parse_str(&event_id_str) {
        Ok(id) => id,
        Err(_) => {
            tracing::error!("Invalid event_id: {}", event_id_str);
            return;
        }
    };

    let (mut sender, mut receiver) = socket.split();
    let mut user_id: Option<Uuid> = None;
    let mut username: Option<String> = None;
    let mut avatar_url: Option<String> = None;

    // Get broadcast receiver for this event
    let mut rx = state.hub.get_or_create_event_session(event_id).await;

    // Channel for direct messages to this client
    let (tx, mut direct_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Spawn task to forward broadcast messages and direct messages to this client
    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = rx.recv() => {
                    match msg {
                        Ok(val) => {
                            if sender.send(Message::Text(val.to_string())).await.is_err() {
                                break;
                            }
                        }
                        Err(_) => break,
                    }
                }
                msg = direct_rx.recv() => {
                    match msg {
                        Some(text) => {
                            if sender.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
    });

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                tracing::debug!("Received message: {}", text);
                
                // Try to parse as GameMessage or CanvasMessage
                if let Ok(canvas_msg) = serde_json::from_str::<crate::ws::messages::CanvasMessage>(&text) {
                    // Handle canvas message
                    match canvas_msg {
                        crate::ws::messages::CanvasMessage::DrawStroke { stroke } => {
                            if let Some(uid) = user_id {
                                // Store stroke in database
                                let stroke_json = match serialize_to_json_value(&stroke) {
                                    Ok(v) => v,
                                    Err(e) => {
                                        tracing::error!("Failed to serialize stroke: {}", e);
                                        continue; // Skip this message
                                    }
                                };
                                if let Err(e) = sqlx::query(
                                    "INSERT INTO canvas_strokes (event_id, user_id, stroke_data) VALUES ($1, $2, $3)"
                                )
                                .bind(event_id)
                                .bind(uid)
                                .bind(sqlx::types::Json(stroke_json.clone()))
                                .execute(&state.db)
                                .await
                                {
                                    tracing::error!("Failed to store stroke: {}", e);
                                }

                                // Broadcast stroke to all participants
                                let username = username.clone().unwrap_or_default();
                                let stroke_msg = crate::ws::messages::CanvasServerMessage::StrokeAdded {
                                    user_id: uid,
                                    username,
                                    stroke,
                                };
                                broadcast_ws_message(&state.hub, event_id, stroke_msg).await;
                            }
                        }
                        crate::ws::messages::CanvasMessage::ClearCanvas => {
                            // Only host can clear canvas
                            if let Some(uid) = user_id {
                                let is_host = match sqlx::query_scalar::<_, bool>(
                                    "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                                )
                                .bind(event_id)
                                .bind(uid)
                                .fetch_one(&state.db)
                                .await {
                                    Ok(result) => result,
                                    Err(e) => {
                                        tracing::error!("Database error checking host status for canvas clear: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Failed to verify permissions".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                        continue;
                                    }
                                };

                                if is_host {
                                    // Delete all strokes for this event
                                    if let Err(e) = sqlx::query(
                                        "DELETE FROM canvas_strokes WHERE event_id = $1"
                                    )
                                    .bind(event_id)
                                    .execute(&state.db)
                                    .await
                                    {
                                        tracing::error!("Failed to clear canvas: {}", e);
                                    }

                                    // Broadcast clear
                                    let clear_msg = crate::ws::messages::CanvasServerMessage::CanvasCleared;
                                    broadcast_ws_message(&state.hub, event_id, clear_msg).await;
                                } else {
                                    let error_msg = ServerMessage::Error {
                                        message: "Only host can clear canvas".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                }
                            }
                        }
                    }
                    continue;
                }

                // Try to parse as GameMessage
                let game_msg: GameMessage = match serde_json::from_str(&text) {
                    Ok(msg) => msg,
                    Err(e) => {
                        tracing::warn!("Failed to parse message: {} - {}", text, e);
                        let error_msg = ServerMessage::Error {
                            message: format!("Invalid message format: {}", e),
                        };
                        send_ws_message(&tx, error_msg).await;
                        continue;
                    }
                };

                match game_msg {
                    GameMessage::Join { user_id: uid, session_code: _ } => {
                        // Fetch user info from database
                        match sqlx::query_as::<_, (Uuid, String, Option<String>)>(
                            "SELECT id, username, avatar_url FROM users WHERE id = $1"
                        )
                        .bind(uid)
                        .fetch_optional(&state.db)
                        .await
                        {
                            Ok(Some((id, uname, av_url))) => {
                                user_id = Some(id);
                                username = Some(uname.clone());
                                avatar_url = av_url.clone();

                                // Add participant to hub
                                let participant = Participant {
                                    user_id: id,
                                    username: uname.clone(),
                                    avatar_url: av_url.clone(),
                                };
                                state.hub.add_participant(event_id, participant.clone()).await;

                                // Get current participants and check if user is presenter
                                let game_state = state.hub.get_game_state(event_id).await;
                                let mut is_presenter = false;
                                if let Some(ref gs) = game_state {
                                    if let Some(segment_id) = gs.current_segment_id {
                                        let presenter_check = sqlx::query_scalar::<_, Option<Uuid>>(
                                            "SELECT presenter_user_id FROM segments WHERE id = $1"
                                        )
                                        .bind(segment_id)
                                        .fetch_one(&state.db)
                                        .await;

                                        if let Ok(Some(presenter_id)) = presenter_check {
                                            is_presenter = presenter_id == id;
                                        }
                                    }
                                }

                                // Increment participant count if not presenter
                                if !is_presenter {
                                    state.hub.increment_participant_count(event_id).await;
                                }

                                let participants: Vec<ParticipantMessage> = if let Some(gs) = game_state {
                                    gs.participants.values().map(|p| ParticipantMessage {
                                        id: p.user_id,
                                        username: p.username.clone(),
                                        avatar_url: p.avatar_url.clone(),
                                    }).collect()
                                } else {
                                    vec![]
                                };

                                // Send connected message
                                let connected = ServerMessage::Connected { participants };
                                send_ws_message(&tx, connected).await;

                                // Send canvas sync on join - limit strokes for performance
                                // Performance tradeoff: Limiting strokes prevents slow initial load for events
                                // with extensive canvas history, but users joining late may not see all strokes.
                                // Consider pagination or time-based filtering (last N minutes) for very large events.
                                let sync_limit = state.config.canvas_sync_limit as i64;
                                let strokes_result = sqlx::query_scalar::<_, sqlx::types::Json<serde_json::Value>>(
                                    "SELECT stroke_data FROM canvas_strokes WHERE event_id = $1 ORDER BY created_at DESC LIMIT $2"
                                )
                                .bind(event_id)
                                .bind(sync_limit)
                                .fetch_all(&state.db)
                                .await;

                                if let Ok(strokes_json) = strokes_result {
                                    // Reverse to get chronological order (oldest first) since we queried DESC
                                    let mut strokes: Vec<crate::ws::messages::StrokeData> = strokes_json
                                        .into_iter()
                                        .rev()
                                        .filter_map(|json| {
                                            serde_json::from_value(json.0).ok()
                                        })
                                        .collect();

                                    if !strokes.is_empty() {
                                        tracing::debug!("Syncing {} canvas strokes to new client for event {}", strokes.len(), event_id);
                                        let sync_msg = crate::ws::messages::CanvasServerMessage::CanvasSync { strokes };
                                        send_ws_message(&tx, sync_msg).await;
                                    }
                                }

                                // Broadcast participant joined
                                let joined = ServerMessage::ParticipantJoined {
                                    user: ParticipantMessage {
                                        id: participant.user_id,
                                        username: participant.username,
                                        avatar_url: participant.avatar_url,
                                    },
                                };
                                broadcast_ws_message(&state.hub, event_id, joined).await;
                            }
                            Ok(None) => {
                                let error_msg = ServerMessage::Error {
                                    message: "User not found".to_string(),
                                };
                                send_ws_message(&tx, error_msg).await;
                            }
                            Err(e) => {
                                tracing::error!("Database error fetching user {}: {}", uid, e);
                                let error_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
                                let error_msg = ServerMessage::Error {
                                    message: format!("Failed to join event. Please try again. (Error ID: {})", error_id),
                                };
                                send_ws_message(&tx, error_msg).await;
                            }
                        }
                    }
                    GameMessage::Answer { question_id, selected_answer, response_time_ms } => {
                        let uid = match user_id {
                            Some(id) => id,
                            None => {
                                let error_msg = ServerMessage::Error {
                                    message: "Not joined to event".to_string(),
                                };
                                send_ws_message(&tx, error_msg).await;
                                continue;
                            }
                        };
                        
                        // Get current game state
                        let game_state = state.hub.get_game_state(event_id).await;
                        let Some(state_ref) = game_state else {
                            let error_msg = ServerMessage::Error {
                                message: "Game not active".to_string(),
                            };
                            send_ws_message(&tx, error_msg).await;
                            continue;
                        };

                        let Some(current_question_id) = state_ref.current_question_id else {
                            let error_msg = ServerMessage::Error {
                                message: "No active question".to_string(),
                            };
                            send_ws_message(&tx, error_msg).await;
                            continue;
                        };

                        if current_question_id != question_id {
                            let error_msg = ServerMessage::Error {
                                message: "Question mismatch".to_string(),
                            };
                            send_ws_message(&tx, error_msg).await;
                            continue;
                        }

                        // Get question to check correct answer
                        let question_result = sqlx::query_as::<_, (String, Uuid)>(
                            "SELECT correct_answer, segment_id FROM questions WHERE id = $1"
                        )
                        .bind(question_id)
                        .fetch_optional(&state.db)
                        .await
                        .map_err(|e| {
                            tracing::error!("Database error fetching question {}: {}", question_id, e);
                            e
                        });

                        match question_result {
                            Ok(Some((correct_answer, segment_id))) => {
                                let is_correct = selected_answer.trim().eq_ignore_ascii_case(&correct_answer.trim());
                                
                                // Calculate points
                                let time_limit_ms = state_ref.time_limit_seconds * 1000;
                                let points = if is_correct {
                                    calculate_speed_based_score(time_limit_ms, response_time_ms)
                                } else {
                                    0
                                };

                                // Store response in database
                                let store_result = sqlx::query(
                                    r#"
                                    INSERT INTO responses (segment_id, question_id, user_id, selected_answer, 
                                                          is_correct, response_time_ms, points_earned)
                                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                                    ON CONFLICT (segment_id, question_id, user_id) 
                                    DO UPDATE SET selected_answer = $4, is_correct = $5, 
                                                  response_time_ms = $6, points_earned = $7
                                    "#
                                )
                                .bind(segment_id)
                                .bind(question_id)
                                .bind(uid)
                                .bind(&selected_answer)
                                .bind(is_correct)
                                .bind(response_time_ms)
                                .bind(points)
                                .execute(&state.db)
                                .await;

                                if store_result.is_err() {
                                    tracing::error!("Failed to store response: {:?}", store_result.err());
                                }

                                // Update segment score
                                let _ = sqlx::query(
                                    r#"
                                    INSERT INTO segment_scores (segment_id, user_id, score, questions_answered, questions_correct)
                                    VALUES ($1, $2, $3, 1, $4)
                                    ON CONFLICT (segment_id, user_id)
                                    DO UPDATE SET 
                                        score = segment_scores.score + $3,
                                        questions_answered = segment_scores.questions_answered + 1,
                                        questions_correct = segment_scores.questions_correct + $4
                                    "#
                                )
                                .bind(segment_id)
                                .bind(uid)
                                .bind(points)
                                .bind(if is_correct { 1 } else { 0 })
                                .execute(&state.db)
                                .await;

                                // Update event participant total score
                                let _ = sqlx::query(
                                    r#"
                                    INSERT INTO event_participants (event_id, user_id, total_score)
                                    VALUES ($1, $2, $3)
                                    ON CONFLICT (event_id, user_id)
                                    DO UPDATE SET total_score = event_participants.total_score + $3
                                    "#
                                )
                                .bind(event_id)
                                .bind(uid)
                                .bind(points)
                                .execute(&state.db)
                                .await;

                                // Record answer in hub
                                state.hub.record_answer(event_id, uid, selected_answer.clone()).await;

                                // Check if all participants have answered
                                let game_state_after = state.hub.get_game_state(event_id).await;
                                if let Some(state_after) = game_state_after {
                                    let answers_count = state_after.answers_received.len();
                                    let total_participants = state_after.total_participants;
                                    
                                    // Broadcast answer received
                                    let answer_received = ServerMessage::AnswerReceived { user_id: uid };
                                    broadcast_ws_message(&state.hub, event_id, answer_received).await;

                                    // If all participants answered, notify presenter
                                    if answers_count >= total_participants && total_participants > 0 {
                                        // Get segment presenter ID
                                        if let Some(seg_id) = state_after.current_segment_id {
                                            let presenter_id_result = sqlx::query_scalar::<_, Option<Uuid>>(
                                                "SELECT presenter_user_id FROM segments WHERE id = $1"
                                            )
                                            .bind(seg_id)
                                            .fetch_one(&state.db)
                                            .await;

                                            if let Ok(Some(presenter_id)) = presenter_id_result {
                                                // Send AllAnswered message directly to presenter
                                                let all_answered = ServerMessage::AllAnswered {
                                                    answer_count: answers_count,
                                                    total_participants,
                                                };
                                                // We need to send this to a specific user, not broadcast
                                                // For now, broadcast it - the presenter can filter
                                                broadcast_ws_message(&state.hub, event_id, all_answered).await;
                                            }
                                        }
                                    }
                                } else {
                                    // Broadcast answer received (fallback)
                                    let answer_received = ServerMessage::AnswerReceived { user_id: uid };
                                    broadcast_ws_message(&state.hub, event_id, answer_received).await;
                                }
                            }
                            Ok(None) => {
                                let error_msg = ServerMessage::Error {
                                    message: "Question not found".to_string(),
                                };
                                send_ws_message(&tx, error_msg).await;
                            }
                            Err(e) => {
                                tracing::error!("Database error fetching question {}: {}", question_id, e);
                                let error_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
                                let error_msg = ServerMessage::Error {
                                    message: format!("Failed to process answer. Please try again. (Error ID: {})", error_id),
                                };
                                send_ws_message(&tx, error_msg).await;
                            }
                        }
                    }
                    GameMessage::StartGame => {
                        // Host OR segment presenter can start game
                        if let Some(uid) = user_id {
                            // Get first segment for this event
                            let segment_result = sqlx::query_as::<_, (Uuid,)>(
                                "SELECT id FROM segments WHERE event_id = $1 ORDER BY order_index LIMIT 1"
                            )
                            .bind(event_id)
                            .fetch_optional(&state.db)
                            .await;

                            let segment_id = match segment_result {
                                Ok(Some((seg_id,))) => seg_id,
                                Ok(None) => {
                                    let error_msg = ServerMessage::Error {
                                        message: "No segments found for this event".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                                Err(e) => {
                                    tracing::error!("Database error fetching segment for start game: {}", e);
                                    let error_msg = ServerMessage::Error {
                                        message: "Failed to verify permissions".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                            };

                            // Check if user is host or segment presenter
                            match is_segment_controller(&state.db, event_id, segment_id, uid).await {
                                Ok(true) => {
                                    // User has permission, continue
                                }
                                Ok(false) => {
                                    let error_msg = ServerMessage::Error {
                                        message: "Only host or segment presenter can start game".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                                Err(e) => {
                                    tracing::error!("Database error checking controller status for start game: {}", e);
                                    let error_msg = ServerMessage::Error {
                                        message: "Failed to verify permissions".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                            }

                            // Get first question for this segment
                            let question_result = sqlx::query_as::<_, (Uuid, String, String, i32)>(
                                "SELECT id, question_text, correct_answer, order_index FROM questions 
                                 WHERE segment_id = $1 AND order_index = 0 
                                 ORDER BY order_index LIMIT 1"
                            )
                            .bind(segment_id)
                            .fetch_optional(&state.db)
                            .await;

                            match question_result {
                                Ok(Some((qid, qtext, correct, _))) => {
                                    // Get total questions for this segment
                                    let total_questions = sqlx::query_scalar::<_, i64>(
                                        "SELECT COUNT(*) FROM questions WHERE segment_id = $1"
                                    )
                                    .bind(segment_id)
                                    .fetch_one(&state.db)
                                    .await
                                    .unwrap_or(0) as i32;

                                    // Get time limit from event
                                    let time_limit = match sqlx::query_scalar::<_, i32>(
                                        "SELECT time_per_question FROM events WHERE id = $1"
                                    )
                                    .bind(event_id)
                                    .fetch_one(&state.db)
                                    .await {
                                        Ok(limit) => {
                                            if limit <= 0 {
                                                tracing::warn!("Invalid time_per_question {} for event {}, using default 30", limit, event_id);
                                                30
                                            } else {
                                                limit
                                            }
                                        },
                                        Err(e) => {
                                            tracing::warn!("Database error fetching time_per_question for event {}: {}, using default 30", event_id, e);
                                            30
                                        }
                                    };

                                    // Get or generate answers
                                    let all_answers = get_or_generate_answers(
                                        &state,
                                        qid,
                                        &qtext,
                                        &correct,
                                        event_id,
                                    ).await.unwrap_or_else(|e| {
                                        tracing::error!("Failed to get/generate answers: {}", e);
                                        vec![correct.clone()]
                                    });

                                    // Update game state
                                    state.hub.update_game_state(event_id, |game_state| {
                                        game_state.current_segment_id = Some(segment_id);
                                        game_state.current_question_id = Some(qid);
                                        game_state.current_question_index = 0;
                                        game_state.question_started_at = Some(Utc::now());
                                        game_state.time_limit_seconds = time_limit;
                                    }).await;
                                    state.hub.clear_answers(event_id).await;

                                    // Set phase to ShowingQuestion
                                    state.hub.set_quiz_phase(event_id, crate::ws::hub::QuizPhase::ShowingQuestion).await;

                                    // Broadcast game started
                                    let started = ServerMessage::GameStarted;
                                    broadcast_ws_message(&state.hub, event_id, started).await;

                                    // Broadcast phase change
                                    let phase_change = ServerMessage::PhaseChanged {
                                        phase: crate::ws::hub::QuizPhase::ShowingQuestion,
                                        question_index: 0,
                                        total_questions,
                                    };
                                    broadcast_ws_message(&state.hub, event_id, phase_change).await;

                                    // Broadcast first question
                                    let question_msg = ServerMessage::Question {
                                        question_id: qid,
                                        question_number: 1, // 1-indexed for display
                                        total_questions,
                                        text: qtext,
                                        answers: all_answers,
                                        time_limit,
                                    };
                                    broadcast_ws_message(&state.hub, event_id, question_msg).await;
                                }
                                Ok(None) => {
                                    let error_msg = ServerMessage::Error {
                                        message: "No questions found for this event".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                }
                                Err(e) => {
                                    tracing::error!("Database error fetching questions for segment {}: {}", segment_id, e);
                                    let error_id = uuid::Uuid::new_v4().to_string()[..8].to_string();
                                    let error_msg = ServerMessage::Error {
                                        message: format!("Failed to start game. Please try again. (Error ID: {})", error_id),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                }
                            }
                        }
                    }
                    GameMessage::NextQuestion => {
                        // Host OR segment presenter can advance questions
                        if let Some(uid) = user_id {
                            // Get next question for current segment
                            let game_state = state.hub.get_game_state(event_id).await;
                            if let Some(state_ref) = game_state {
                                if let Some(segment_id) = state_ref.current_segment_id {
                                    // Check if user is host or segment presenter
                                    match is_segment_controller(&state.db, event_id, segment_id, uid).await {
                                        Ok(true) => {
                                            // User has permission, continue
                                        }
                                        Ok(false) => {
                                            let error_msg = ServerMessage::Error {
                                                message: "Only host or segment presenter can advance questions".to_string(),
                                            };
                                            send_ws_message(&tx, error_msg).await;
                                            continue;
                                        }
                                        Err(e) => {
                                            tracing::error!("Database error checking controller status for advance question: {}", e);
                                            let error_msg = ServerMessage::Error {
                                                message: "Failed to verify permissions".to_string(),
                                            };
                                            send_ws_message(&tx, error_msg).await;
                                            continue;
                                        }
                                    }
                                    let next_index = state_ref.current_question_index + 1;
                                    
                                    let question_result = sqlx::query_as::<_, (Uuid, String, String, i32)>(
                                        "SELECT id, question_text, correct_answer, order_index FROM questions 
                                         WHERE segment_id = $1 AND order_index = $2 
                                         ORDER BY order_index LIMIT 1"
                                    )
                                    .bind(segment_id)
                                    .bind(next_index)
                                    .fetch_optional(&state.db)
                                    .await;

                                    match question_result {
                                        Ok(Some((qid, qtext, correct, _))) => {
                                            // Get total questions for this segment
                                            let total_questions = sqlx::query_scalar::<_, i64>(
                                                "SELECT COUNT(*) FROM questions WHERE segment_id = $1"
                                            )
                                            .bind(segment_id)
                                            .fetch_one(&state.db)
                                            .await
                                            .unwrap_or(0) as i32;

                                            // Set phase to ShowingQuestion
                                            state.hub.set_quiz_phase(event_id, crate::ws::hub::QuizPhase::ShowingQuestion).await;

                                            // Get or generate fake answers
                                            let all_answers = get_or_generate_answers(
                                                &state,
                                                qid,
                                                &qtext,
                                                &correct,
                                                event_id,
                                            ).await.unwrap_or_else(|e| {
                                                tracing::error!("Failed to get/generate answers: {}", e);
                                                // Fallback: just return correct answer
                                                vec![correct.clone()]
                                            });

                                            // Get time limit from event
                                            let time_limit = match sqlx::query_scalar::<_, i32>(
                                                "SELECT time_per_question FROM events WHERE id = $1"
                                            )
                                            .bind(event_id)
                                            .fetch_one(&state.db)
                                            .await {
                                                Ok(limit) => {
                                                    if limit <= 0 {
                                                        tracing::warn!("Invalid time_per_question {} for event {}, using default 30", limit, event_id);
                                                        30
                                                    } else {
                                                        limit
                                                    }
                                                },
                                                Err(e) => {
                                                    tracing::warn!("Database error fetching time_per_question for event {}: {}, using default 30", event_id, e);
                                                    30
                                                }
                                            };

                                            // Update game state
                                            state.hub.update_game_state(event_id, |state| {
                                                state.current_question_id = Some(qid);
                                                state.current_question_index = next_index;
                                                state.question_started_at = Some(Utc::now());
                                                state.time_limit_seconds = time_limit;
                                            }).await;
                                            state.hub.clear_answers(event_id).await;

                                            // Broadcast phase change
                                            let phase_change = ServerMessage::PhaseChanged {
                                                phase: crate::ws::hub::QuizPhase::ShowingQuestion,
                                                question_index: next_index,
                                                total_questions,
                                            };
                                            broadcast_ws_message(&state.hub, event_id, phase_change).await;

                                            // Broadcast question
                                            let question_msg = ServerMessage::Question {
                                                question_id: qid,
                                                question_number: next_index + 1, // 1-indexed for display
                                                total_questions,
                                                text: qtext,
                                                answers: all_answers,
                                                time_limit,
                                            };
                                            broadcast_ws_message(&state.hub, event_id, question_msg).await;
                                        }
                                        Ok(None) => {
                                            // No more questions - end game
                                            let ended = ServerMessage::GameEnded;
                                            broadcast_ws_message(&state.hub, event_id, ended).await;
                                        }
                                        Err(e) => {
                                            tracing::error!("Database error fetching next question for segment {}: {}", segment_id, e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    GameMessage::RevealAnswer => {
                        // Host OR segment presenter can reveal answers
                        if let Some(uid) = user_id {
                            // Get current question and calculate distribution
                            let game_state = state.hub.get_game_state(event_id).await;
                            if let Some(state_ref) = game_state {
                                if let Some(question_id) = state_ref.current_question_id {
                                    // Get question info first to get segment_id for authorization check
                                    let question_info = sqlx::query_as::<_, (String, i32, Option<Uuid>)>(
                                        "SELECT question_text, order_index, segment_id FROM questions WHERE id = $1"
                                    )
                                    .bind(question_id)
                                    .fetch_one(&state.db)
                                    .await;

                                    let (question_text, question_number, segment_id_opt) = match question_info {
                                        Ok(info) => info,
                                        Err(e) => {
                                            tracing::error!("Failed to get question info: {}", e);
                                            let error_msg = ServerMessage::Error {
                                                message: "Failed to get question information".to_string(),
                                            };
                                            send_ws_message(&tx, error_msg).await;
                                            continue;
                                        }
                                    };

                                    // Check authorization if we have a segment_id
                                    if let Some(segment_id) = segment_id_opt {
                                        match is_segment_controller(&state.db, event_id, segment_id, uid).await {
                                            Ok(true) => {
                                                // User has permission, continue
                                            }
                                            Ok(false) => {
                                                let error_msg = ServerMessage::Error {
                                                    message: "Only host or segment presenter can reveal answers".to_string(),
                                                };
                                                send_ws_message(&tx, error_msg).await;
                                                continue;
                                            }
                                            Err(e) => {
                                                tracing::error!("Database error checking controller status for reveal answer: {}", e);
                                                let error_msg = ServerMessage::Error {
                                                    message: "Failed to verify permissions".to_string(),
                                                };
                                                send_ws_message(&tx, error_msg).await;
                                                continue;
                                            }
                                        }
                                    } else {
                                        // No segment_id - fall back to host-only check
                                        let is_host = match sqlx::query_scalar::<_, bool>(
                                            "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                                        )
                                        .bind(event_id)
                                        .bind(uid)
                                        .fetch_one(&state.db)
                                        .await {
                                            Ok(result) => result,
                                            Err(e) => {
                                                tracing::error!("Database error checking host status for reveal answers: {}", e);
                                                let error_msg = ServerMessage::Error {
                                                    message: "Failed to verify permissions".to_string(),
                                                };
                                                send_ws_message(&tx, error_msg).await;
                                                continue;
                                            }
                                        };

                                        if !is_host {
                                            let error_msg = ServerMessage::Error {
                                                message: "Only host can reveal answers".to_string(),
                                            };
                                            send_ws_message(&tx, error_msg).await;
                                            continue;
                                        }
                                    }

                                    // Get correct answer
                                    let correct_result = sqlx::query_scalar::<_, String>(
                                        "SELECT correct_answer FROM questions WHERE id = $1"
                                    )
                                    .bind(question_id)
                                    .fetch_one(&state.db)
                                    .await;

                                    if let Ok(correct_answer) = correct_result {

                                        // Get total questions for segment
                                        let total_questions = if let Some(seg_id) = segment_id_opt {
                                            sqlx::query_scalar::<_, i64>(
                                                "SELECT COUNT(*) FROM questions WHERE segment_id = $1"
                                            )
                                            .bind(seg_id)
                                            .fetch_one(&state.db)
                                            .await
                                            .unwrap_or(0) as i32
                                        } else {
                                            0
                                        };

                                        // Set phase to RevealingAnswer
                                        state.hub.set_quiz_phase(event_id, crate::ws::hub::QuizPhase::RevealingAnswer).await;

                                        // Broadcast phase change
                                        let phase_change = ServerMessage::PhaseChanged {
                                            phase: crate::ws::hub::QuizPhase::RevealingAnswer,
                                            question_index: state_ref.current_question_index,
                                            total_questions,
                                        };
                                        broadcast_ws_message(&state.hub, event_id, phase_change).await;

                                        // Get all answers received
                                        let answers = &state_ref.answers_received;
                                        
                                        // Calculate distribution
                                        let mut distribution_map: std::collections::HashMap<String, i32> = std::collections::HashMap::new();
                                        for answer in answers.values() {
                                            *distribution_map.entry(answer.clone()).or_insert(0) += 1;
                                        }

                                        // Get all possible answers from session_answers
                                        let all_answers_result = sqlx::query_scalar::<_, sqlx::types::Json<Vec<crate::models::question::GeneratedAnswer>>>(
                                            "SELECT answers FROM session_answers WHERE question_id = $1"
                                        )
                                        .bind(question_id)
                                        .fetch_optional(&state.db)
                                        .await;

                                        let mut distribution = vec![];
                                        if let Ok(Some(answers_json)) = all_answers_result {
                                            let answers: Vec<crate::models::question::GeneratedAnswer> = answers_json.0;
                                            for answer_obj in answers {
                                                let count = distribution_map.get(&answer_obj.text).copied().unwrap_or(0);
                                                distribution.push(crate::ws::messages::AnswerDistributionMessage {
                                                    answer: answer_obj.text,
                                                    count,
                                                    is_correct: answer_obj.is_correct,
                                                });
                                            }
                                        } else {
                                            // Fallback: just show correct answer
                                            let count = distribution_map.get(&correct_answer).copied().unwrap_or(0);
                                            distribution.push(crate::ws::messages::AnswerDistributionMessage {
                                                answer: correct_answer.clone(),
                                                count,
                                                is_correct: true,
                                            });
                                        }

                                        // Query segment leaderboard
                                        let segment_leaderboard = if let Some(segment_id) = state_ref.current_segment_id {
                                            sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
                                                r#"
                                                SELECT
                                                    ROW_NUMBER() OVER (ORDER BY score DESC) as rank,
                                                    user_id,
                                                    username,
                                                    avatar_url,
                                                    score
                                                FROM (
                                                    SELECT
                                                        ss.user_id,
                                                        u.username,
                                                        u.avatar_url,
                                                        ss.score
                                                    FROM segment_scores ss
                                                    JOIN users u ON ss.user_id = u.id
                                                    WHERE ss.segment_id = $1
                                                    ORDER BY ss.score DESC
                                                ) ranked
                                                "#
                                            )
                                            .bind(segment_id)
                                            .fetch_all(&state.db)
                                            .await
                                            .unwrap_or_default()
                                            .into_iter()
                                            .map(|e| crate::ws::messages::LeaderboardEntry {
                                                rank: e.rank as i32,
                                                user_id: e.user_id,
                                                username: e.username,
                                                avatar_url: e.avatar_url,
                                                score: e.score,
                                            })
                                            .collect()
                                        } else {
                                            vec![]
                                        };

                                        // Query event leaderboard
                                        let event_leaderboard: Vec<crate::ws::messages::LeaderboardEntry> = sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
                                            r#"
                                            SELECT
                                                ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank,
                                                user_id,
                                                username,
                                                avatar_url,
                                                total_score as score
                                            FROM (
                                                SELECT
                                                    ep.user_id,
                                                    u.username,
                                                    u.avatar_url,
                                                    ep.total_score
                                                FROM event_participants ep
                                                JOIN users u ON ep.user_id = u.id
                                                WHERE ep.event_id = $1
                                                ORDER BY ep.total_score DESC
                                            ) ranked
                                            "#
                                        )
                                        .bind(event_id)
                                        .fetch_all(&state.db)
                                        .await
                                        .unwrap_or_default()
                                        .into_iter()
                                        .map(|e| crate::ws::messages::LeaderboardEntry {
                                            rank: e.rank as i32,
                                            user_id: e.user_id,
                                            username: e.username,
                                            avatar_url: e.avatar_url,
                                            score: e.score,
                                        })
                                        .collect();

                                        // Broadcast reveal
                                        let reveal = ServerMessage::Reveal {
                                            question_id,
                                            question_number: question_number as i32,
                                            question_text,
                                            correct_answer,
                                            distribution,
                                            segment_leaderboard,
                                            event_leaderboard,
                                        };
                                        broadcast_ws_message(&state.hub, event_id, reveal).await;
                                    }
                                }
                            }
                        }
                    }
                    GameMessage::ShowLeaderboard => {
                        // Set phase to ShowingLeaderboard
                        let game_state = state.hub.get_game_state(event_id).await;
                        if let Some(state_ref) = game_state {
                            // Get total questions for phase change message
                            let total_questions = if let Some(segment_id) = state_ref.current_segment_id {
                                sqlx::query_scalar::<_, i64>(
                                    "SELECT COUNT(*) FROM questions WHERE segment_id = $1"
                                )
                                .bind(segment_id)
                                .fetch_one(&state.db)
                                .await
                                .unwrap_or(0) as i32
                            } else {
                                0
                            };

                            state.hub.set_quiz_phase(event_id, crate::ws::hub::QuizPhase::ShowingLeaderboard).await;

                            // Broadcast phase change
                            let phase_change = ServerMessage::PhaseChanged {
                                phase: crate::ws::hub::QuizPhase::ShowingLeaderboard,
                                question_index: state_ref.current_question_index,
                                total_questions,
                            };
                            broadcast_ws_message(&state.hub, event_id, phase_change).await;

                            // Get leaderboard for current segment or event
                            if let Some(segment_id) = state_ref.current_segment_id {
                                // Get segment leaderboard
                                let leaderboard_result = sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
                                    r#"
                                    SELECT 
                                        ROW_NUMBER() OVER (ORDER BY score DESC) as rank,
                                        user_id,
                                        username,
                                        avatar_url,
                                        score
                                    FROM (
                                        SELECT 
                                            ss.user_id,
                                            u.username,
                                            u.avatar_url,
                                            ss.score
                                        FROM segment_scores ss
                                        JOIN users u ON ss.user_id = u.id
                                        WHERE ss.segment_id = $1
                                        ORDER BY ss.score DESC
                                    ) ranked
                                    "#
                                )
                                .bind(segment_id)
                                .fetch_all(&state.db)
                                .await;

                                if let Ok(entries) = leaderboard_result {
                                    let rankings: Vec<crate::ws::messages::LeaderboardEntry> = entries.into_iter().map(|e| {
                                        crate::ws::messages::LeaderboardEntry {
                                            rank: e.rank as i32,
                                            user_id: e.user_id,
                                            username: e.username,
                                            avatar_url: e.avatar_url,
                                            score: e.score,
                                        }
                                    }).collect();

                                    let leaderboard = ServerMessage::Leaderboard { rankings };
                                    broadcast_ws_message(&state.hub, event_id, leaderboard).await;
                                }
                            }
                        }
                    }
                    GameMessage::EndGame => {
                        // Verify authorization (host or segment presenter)
                        if let Some(uid) = user_id {
                            let game_state = state.hub.get_game_state(event_id).await;
                            let segment_id = match game_state {
                                Some(ref state_ref) => state_ref.current_segment_id,
                                None => {
                                    let error_msg = ServerMessage::Error {
                                        message: "No active segment".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                            };

                            if let Some(seg_id) = segment_id {
                                // Check authorization
                                let is_authorized = match is_segment_controller(
                                    &state.db,
                                    event_id,
                                    seg_id,
                                    uid,
                                ).await {
                                    Ok(authorized) => authorized,
                                    Err(e) => {
                                        tracing::error!("Error checking segment controller: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Failed to verify permissions".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                        continue;
                                    }
                                };

                                if !is_authorized {
                                    let error_msg = ServerMessage::Error {
                                        message: "Not authorized to end quiz".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }

                                // Get segment info
                                let segment = sqlx::query_as::<_, crate::models::event::Segment>(
                                    "SELECT * FROM segments WHERE id = $1"
                                )
                                .bind(seg_id)
                                .fetch_one(&state.db)
                                .await;

                                match segment {
                                    Ok(seg) => {
                                        // Get segment leaderboard
                                        let segment_lb_result = sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
                                            r#"
                                            SELECT 
                                                ROW_NUMBER() OVER (ORDER BY score DESC) as rank,
                                                user_id,
                                                username,
                                                avatar_url,
                                                score
                                            FROM (
                                                SELECT 
                                                    ss.user_id,
                                                    u.username,
                                                    u.avatar_url,
                                                    ss.score
                                                FROM segment_scores ss
                                                JOIN users u ON ss.user_id = u.id
                                                WHERE ss.segment_id = $1
                                                ORDER BY ss.score DESC
                                            ) ranked
                                            "#
                                        )
                                        .bind(seg_id)
                                        .fetch_all(&state.db)
                                        .await;

                                        let segment_lb: Vec<crate::ws::messages::LeaderboardEntry> = segment_lb_result
                                            .unwrap_or_default()
                                            .into_iter()
                                            .map(|e| crate::ws::messages::LeaderboardEntry {
                                                rank: e.rank as i32,
                                                user_id: e.user_id,
                                                username: e.username,
                                                avatar_url: e.avatar_url,
                                                score: e.score,
                                            })
                                            .collect();

                                        // Get event leaderboard
                                        let event_lb_result = sqlx::query_as::<_, crate::models::question::LeaderboardEntry>(
                                            r#"
                                            SELECT 
                                                ROW_NUMBER() OVER (ORDER BY total_score DESC) as rank,
                                                user_id,
                                                username,
                                                avatar_url,
                                                total_score as score
                                            FROM (
                                                SELECT 
                                                    ep.user_id,
                                                    u.username,
                                                    u.avatar_url,
                                                    ep.total_score
                                                FROM event_participants ep
                                                JOIN users u ON ep.user_id = u.id
                                                WHERE ep.event_id = $1
                                                ORDER BY ep.total_score DESC
                                            ) ranked
                                            "#
                                        )
                                        .bind(event_id)
                                        .fetch_all(&state.db)
                                        .await;

                                        let event_lb: Vec<crate::ws::messages::LeaderboardEntry> = event_lb_result
                                            .unwrap_or_default()
                                            .into_iter()
                                            .map(|e| crate::ws::messages::LeaderboardEntry {
                                                rank: e.rank as i32,
                                                user_id: e.user_id,
                                                username: e.username,
                                                avatar_url: e.avatar_url,
                                                score: e.score,
                                            })
                                            .collect();

                                        // Update segment status
                                        let _ = sqlx::query("UPDATE segments SET status = 'completed' WHERE id = $1")
                                            .bind(seg_id)
                                            .execute(&state.db)
                                            .await;

                                        // Update quiz phase
                                        state.hub.set_quiz_phase(event_id, crate::ws::hub::QuizPhase::SegmentComplete).await;

                                        // Broadcast segment complete
                                        let segment_complete = ServerMessage::SegmentComplete {
                                            segment_id: seg_id,
                                            segment_title: seg.title.unwrap_or_default(),
                                            presenter_name: seg.presenter_name,
                                            segment_leaderboard: segment_lb.clone(),
                                            event_leaderboard: event_lb.clone(),
                                            segment_winner: segment_lb.first().cloned(),
                                            event_leader: event_lb.first().cloned(),
                                        };
                                        broadcast_ws_message(&state.hub, event_id, segment_complete).await;

                                        // Check if all segments are complete
                                        let incomplete_count: (i64,) = match sqlx::query_as(
                                            "SELECT COUNT(*) FROM segments WHERE event_id = $1 AND status != 'completed'"
                                        )
                                        .bind(event_id)
                                        .fetch_one(&state.db)
                                        .await {
                                            Ok(count) => count,
                                            Err(e) => {
                                                tracing::error!("Database error checking incomplete segments: {}", e);
                                                (1,) // Assume incomplete to avoid premature completion
                                            }
                                        };

                                        if incomplete_count.0 == 0 {
                                            // All segments complete - end event
                                            if let Err(e) = trigger_event_complete(&state, event_id).await {
                                                tracing::error!("Failed to trigger event completion: {}", e);
                                            }
                                        }
                                    }
                                    Err(e) => {
                                        tracing::error!("Database error fetching segment {}: {}", seg_id, e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Failed to get segment information".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                    }
                                }
                            } else {
                                // No active segment - just end game
                                let ended = ServerMessage::GameEnded;
                                broadcast_ws_message(&state.hub, event_id, ended).await;
                            }
                        }
                    }
                    GameMessage::PassPresenter { next_presenter_user_id } => {
                        // Verify sender is current segment presenter or event host
                        if let Some(uid) = user_id {
                            let game_state = state.hub.get_game_state(event_id).await;
                            let segment_id = match game_state {
                                Some(ref state_ref) => state_ref.current_segment_id,
                                None => {
                                    let error_msg = ServerMessage::Error {
                                        message: "No active segment".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }
                            };

                            if let Some(seg_id) = segment_id {
                                // Check authorization
                                let is_authorized = match is_segment_controller(
                                    &state.db,
                                    event_id,
                                    seg_id,
                                    uid,
                                ).await {
                                    Ok(authorized) => authorized,
                                    Err(e) => {
                                        tracing::error!("Error checking segment controller: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Failed to verify permissions".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                        continue;
                                    }
                                };

                                if !is_authorized {
                                    let error_msg = ServerMessage::Error {
                                        message: "Not authorized to pass presenter".to_string(),
                                    };
                                    send_ws_message(&tx, error_msg).await;
                                    continue;
                                }

                                // Verify next presenter is a participant in this event
                                let next_presenter = sqlx::query_as::<_, (Uuid, String)>(
                                    "SELECT u.id, u.username FROM users u
                                     JOIN event_participants ep ON ep.user_id = u.id
                                     WHERE ep.event_id = $1 AND u.id = $2"
                                )
                                .bind(event_id)
                                .bind(next_presenter_user_id)
                                .fetch_optional(&state.db)
                                .await;

                                match next_presenter {
                                    Ok(Some((next_id, next_username))) => {
                                        // Update segment presenter_user_id
                                        let update_result = sqlx::query(
                                            "UPDATE segments SET presenter_user_id = $1 WHERE id = $2"
                                        )
                                        .bind(next_presenter_user_id)
                                        .bind(seg_id)
                                        .execute(&state.db)
                                        .await;

                                        if update_result.is_ok() {
                                            // Broadcast presenter change
                                            let presenter_changed = ServerMessage::PresenterChanged {
                                                previous_presenter_id: uid,
                                                new_presenter_id: next_presenter_user_id,
                                                new_presenter_name: next_username,
                                                segment_id: seg_id,
                                            };
                                            broadcast_ws_message(&state.hub, event_id, presenter_changed).await;

                                            // Check if all segments are complete (in case last segment was just completed)
                                            let incomplete_count: (i64,) = match sqlx::query_as(
                                                "SELECT COUNT(*) FROM segments WHERE event_id = $1 AND status != 'completed'"
                                            )
                                            .bind(event_id)
                                            .fetch_one(&state.db)
                                            .await {
                                                Ok(count) => count,
                                                Err(e) => {
                                                    tracing::error!("Database error checking incomplete segments after pass presenter: {}", e);
                                                    (1,) // Assume incomplete to avoid premature completion
                                                }
                                            };

                                            if incomplete_count.0 == 0 {
                                                // All segments complete - end event
                                                if let Err(e) = trigger_event_complete(&state, event_id).await {
                                                    tracing::error!("Failed to trigger event completion after pass presenter: {}", e);
                                                }
                                            }
                                        } else {
                                            let error_msg = ServerMessage::Error {
                                                message: "Failed to update presenter".to_string(),
                                            };
                                            send_ws_message(&tx, error_msg).await;
                                        }
                                    }
                                    Ok(None) => {
                                        let error_msg = ServerMessage::Error {
                                            message: "User not in event".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                    }
                                    Err(e) => {
                                        tracing::error!("Database error checking next presenter: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Failed to verify next presenter".to_string(),
                                        };
                                        send_ws_message(&tx, error_msg).await;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Message::Binary(_) => {
                // Binary messages not used for game WebSocket
            }
            Message::Close(_) => {
                tracing::info!("Client disconnected");
                if let Some(uid) = user_id {
                    // Check if user is presenter before decrementing
                    let game_state = state.hub.get_game_state(event_id).await;
                    let mut is_presenter = false;
                    if let Some(ref state_ref) = game_state {
                        if let Some(segment_id) = state_ref.current_segment_id {
                            let presenter_check = sqlx::query_scalar::<_, Option<Uuid>>(
                                "SELECT presenter_user_id FROM segments WHERE id = $1"
                            )
                            .bind(segment_id)
                            .fetch_one(&state.db)
                            .await;
                            
                            if let Ok(Some(presenter_id)) = presenter_check {
                                is_presenter = presenter_id == uid;
                            }
                        }
                    }

                    // Decrement participant count if not presenter
                    if !is_presenter {
                        state.hub.decrement_participant_count(event_id).await;
                    }

                    state.hub.remove_participant(event_id, uid).await;
                    
                    // Broadcast participant left
                    let left = ServerMessage::ParticipantLeft { user_id: uid };
                    broadcast_ws_message(&state.hub, event_id, left).await;
                }
                break;
            }
            _ => {}
        }
    }

    // Cancel send task
    send_task.abort();
}

/// Handle audio WebSocket connections for live transcription
pub async fn handle_audio_connection(
    socket: WebSocket,
    segment_id_str: String,
    state: AppState,
) {
    // Parse segment_id
    let segment_id = match Uuid::parse_str(&segment_id_str) {
        Ok(id) => id,
        Err(_) => {
            tracing::error!("Invalid segment_id: {}", segment_id_str);
            return;
        }
    };

    // Get segment info to find event_id and transcription settings
    let segment_info = sqlx::query_as::<_, (Uuid, Uuid)>(
        "SELECT event_id, (SELECT host_id FROM events WHERE id = segments.event_id) as host_id FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_optional(&state.db)
    .await
    .map_err(|e| {
        tracing::error!("Database error fetching segment {}: {}", segment_id, e);
        e
    });

    let (event_id, host_id) = match segment_info {
        Ok(Some((eid, hid))) => (eid, hid),
        _ => {
            tracing::error!("Segment not found: {}", segment_id);
            return;
        }
    };

    // Get transcription provider
    let transcription_provider: Box<dyn crate::services::transcription::TranscriptionProvider> = {
        // Try to get user's STT settings
        let user_settings = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT stt_provider, stt_api_key_encrypted FROM user_ai_settings WHERE user_id = $1"
        )
        .bind(host_id)
        .fetch_optional(&state.db)
        .await
        .map_err(|e| {
            tracing::error!("Database error fetching STT settings for user {}: {}", host_id, e);
            e
        })
        .ok()
        .flatten();

        if let Some((provider, key_encrypted)) = user_settings {
            let encryption_key = &state.config.encryption_key;
            
            // Try to decrypt user's API key, fall back to config if decryption fails
            let api_key = if let Some(encrypted) = key_encrypted {
                decrypt_string(&encrypted, encryption_key).ok()
            } else {
                None
            };
            
            match provider.as_str() {
                "deepgram" => {
                    if let Some(key) = api_key {
                        if key.is_empty() {
                            tracing::warn!("User Deepgram API key is empty, falling back to config");
                            if let Some(api_key) = &state.config.deepgram_api_key {
                                if api_key.is_empty() {
                                    match create_default_transcription_provider(&state.config) {
                                        Ok(provider) => provider,
                                        Err(e) => {
                                            tracing::error!("Failed to create transcription provider: {}", e);
                                            return;
                                        }
                                    }
                                } else {
                                    Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone()))
                                }
                            } else {
                                match create_default_transcription_provider(&state.config) {
                                    Ok(provider) => provider,
                                    Err(e) => {
                                        tracing::error!("Failed to create transcription provider: {}", e);
                                        return;
                                    }
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::DeepgramProvider::new(key))
                        }
                    } else if let Some(api_key) = &state.config.deepgram_api_key {
                        if api_key.is_empty() {
                            match create_default_transcription_provider(&state.config) {
                                Ok(provider) => provider,
                                Err(e) => {
                                    tracing::error!("Failed to create transcription provider: {}", e);
                                    return;
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone()))
                        }
                    } else {
                        match create_default_transcription_provider(&state.config) {
                            Ok(provider) => provider,
                            Err(e) => {
                                tracing::error!("Failed to create transcription provider: {}", e);
                                return;
                            }
                        }
                    }
                }
                "whisper" => {
                    if let Some(key) = api_key {
                        if key.is_empty() {
                            tracing::warn!("User OpenAI API key is empty, falling back to config");
                            if let Some(api_key) = &state.config.openai_api_key {
                                if api_key.is_empty() {
                                    match create_default_transcription_provider(&state.config) {
                                        Ok(provider) => provider,
                                        Err(e) => {
                                            tracing::error!("Failed to create transcription provider: {}", e);
                                            return;
                                        }
                                    }
                                } else {
                                    Box::new(crate::services::transcription::WhisperProvider::new(api_key.clone()))
                                }
                            } else {
                                match create_default_transcription_provider(&state.config) {
                                    Ok(provider) => provider,
                                    Err(e) => {
                                        tracing::error!("Failed to create transcription provider: {}", e);
                                        return;
                                    }
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::WhisperProvider::new(key))
                        }
                    } else if let Some(api_key) = &state.config.openai_api_key {
                        if api_key.is_empty() {
                            match create_default_transcription_provider(&state.config) {
                                Ok(provider) => provider,
                                Err(e) => {
                                    tracing::error!("Failed to create transcription provider: {}", e);
                                    return;
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::WhisperProvider::new(api_key.clone()))
                        }
                    } else {
                        match create_default_transcription_provider(&state.config) {
                            Ok(provider) => provider,
                            Err(e) => {
                                tracing::error!("Failed to create transcription provider: {}", e);
                                return;
                            }
                        }
                    }
                }
                "assemblyai" => {
                    if let Some(key) = api_key {
                        if key.is_empty() {
                            tracing::warn!("User AssemblyAI API key is empty, falling back to config");
                            if let Some(api_key) = &state.config.assemblyai_api_key {
                                if api_key.is_empty() {
                                    match create_default_transcription_provider(&state.config) {
                                        Ok(provider) => provider,
                                        Err(e) => {
                                            tracing::error!("Failed to create transcription provider: {}", e);
                                            return;
                                        }
                                    }
                                } else {
                                    Box::new(crate::services::transcription::AssemblyAIProvider::new(api_key.clone()))
                                }
                            } else {
                                match create_default_transcription_provider(&state.config) {
                                    Ok(provider) => provider,
                                    Err(e) => {
                                        tracing::error!("Failed to create transcription provider: {}", e);
                                        return;
                                    }
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::AssemblyAIProvider::new(key))
                        }
                    } else if let Some(api_key) = &state.config.assemblyai_api_key {
                        if api_key.is_empty() {
                            match create_default_transcription_provider(&state.config) {
                                Ok(provider) => provider,
                                Err(e) => {
                                    tracing::error!("Failed to create transcription provider: {}", e);
                                    return;
                                }
                            }
                        } else {
                            Box::new(crate::services::transcription::AssemblyAIProvider::new(api_key.clone()))
                        }
                    } else {
                        match create_default_transcription_provider(&state.config) {
                            Ok(provider) => provider,
                            Err(e) => {
                                tracing::error!("Failed to create transcription provider: {}", e);
                                return;
                            }
                        }
                    }
                }
                _ => {
                    match create_default_transcription_provider(&state.config) {
                        Ok(provider) => provider,
                        Err(e) => {
                            tracing::error!("Failed to create transcription provider: {}", e);
                            return;
                        }
                    }
                }
            }
        } else {
            match create_default_transcription_provider(&state.config) {
                Ok(provider) => provider,
                Err(e) => {
                    tracing::error!("Failed to create transcription provider: {}", e);
                    return;
                }
            }
        }
    };

    // Check if we should use streaming transcription
    let use_streaming = state.config.enable_streaming_transcription;

    if use_streaming {
        // Try Deepgram streaming first
        let deepgram_api_key = get_deepgram_api_key_for_streaming(&state, host_id).await;

        if let Some(api_key) = deepgram_api_key {
            tracing::info!("Using Deepgram streaming transcription for segment {}", segment_id);
            handle_audio_connection_streaming(
                socket,
                segment_id,
                event_id,
                host_id,
                state,
                api_key,
            ).await;
            return;
        }

        // Try AssemblyAI streaming next
        let assemblyai_api_key = get_assemblyai_api_key_for_streaming(&state, host_id).await;

        if let Some(api_key) = assemblyai_api_key {
            tracing::info!("Using AssemblyAI streaming transcription for segment {}", segment_id);
            handle_audio_connection_streaming_assemblyai(
                socket,
                segment_id,
                event_id,
                host_id,
                state,
                api_key,
            ).await;
            return;
        }

        tracing::warn!("Streaming transcription requested but no streaming API key available, falling back to REST");
    }

    // Fall back to REST-based transcription
    handle_audio_connection_rest(
        socket,
        segment_id,
        event_id,
        host_id,
        state,
        transcription_provider,
    ).await;
}

/// Get Deepgram API key for streaming transcription
async fn get_deepgram_api_key_for_streaming(
    state: &AppState,
    host_id: Uuid,
) -> Option<String> {
    // Try to get user's Deepgram settings
    let user_settings = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT stt_provider, stt_api_key_encrypted FROM user_ai_settings WHERE user_id = $1"
    )
    .bind(host_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    if let Some((provider, key_encrypted)) = user_settings {
        if provider == "deepgram" {
            // Try to decrypt user's API key
            if let Some(encrypted) = key_encrypted {
                if let Ok(key) = decrypt_string(&encrypted, &state.config.encryption_key) {
                    if !key.is_empty() {
                        return Some(key);
                    }
                }
            }
        }
    }

    // Fall back to config Deepgram API key
    state.config.deepgram_api_key.clone().filter(|k| !k.is_empty())
}

/// Get AssemblyAI API key for streaming transcription
async fn get_assemblyai_api_key_for_streaming(
    state: &AppState,
    host_id: Uuid,
) -> Option<String> {
    // Try to get user's AssemblyAI settings
    let user_settings = sqlx::query_as::<_, (String, Option<String>)>(
        "SELECT stt_provider, stt_api_key_encrypted FROM user_ai_settings WHERE user_id = $1"
    )
    .bind(host_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten();

    if let Some((provider, key_encrypted)) = user_settings {
        if provider == "assemblyai" {
            // Try to decrypt user's API key
            if let Some(encrypted) = key_encrypted {
                if let Ok(key) = decrypt_string(&encrypted, &state.config.encryption_key) {
                    if !key.is_empty() {
                        return Some(key);
                    }
                }
            }
        }
    }

    // Fall back to config AssemblyAI API key
    state.config.assemblyai_api_key.clone().filter(|k| !k.is_empty())
}

/// Handle audio connection using REST-based transcription (existing implementation)
async fn handle_audio_connection_rest(
    socket: WebSocket,
    segment_id: Uuid,
    event_id: Uuid,
    host_id: Uuid,
    state: AppState,
    transcription_provider: Box<dyn crate::services::transcription::TranscriptionProvider>,
) {
    let (mut sender, mut receiver) = socket.split();
    let mut transcript_buffer = String::new();
    let mut chunk_index = 0i32;
    let mut last_question_gen_time = std::time::Instant::now();
    
    // Get question generation interval from event settings, default to 30 seconds
    let question_gen_interval_secs: u64 = {
        match sqlx::query_scalar::<_, Option<i32>>(
            "SELECT question_gen_interval_seconds FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_one(&state.db)
        .await {
            Ok(Some(interval)) => {
                // Validate range (10-300 seconds)
                if interval >= 10 && interval <= 300 {
                    interval as u64
                } else {
                    tracing::warn!("Invalid question_gen_interval_seconds {} for event {}, using default 30", interval, event_id);
                    30
                }
            }
            Ok(None) => 30, // Use default if NULL
            Err(e) => {
                tracing::warn!("Failed to fetch question_gen_interval_seconds for event {}: {}, using default 30", event_id, e);
                30
            }
        }
    };

    // Get broadcast receiver for this event to send transcript updates
    let mut event_rx = state.hub.get_or_create_event_session(event_id).await;

    // Channel for direct messages to this client
    let (tx, mut direct_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Spawn task to forward transcript updates and direct messages
    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = event_rx.recv() => {
                    match msg {
                        Ok(val) => {
                            // Only forward audio-related messages
                            if let Some(msg_type) = val.get("type").and_then(|v| v.as_str()) {
                                if msg_type == "transcript_update" || msg_type == "question_generated" {
                                    if sender.send(Message::Text(val.to_string())).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                msg = direct_rx.recv() => {
                    match msg {
                        Some(text) => {
                            if sender.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
    });

    // Send connection confirmation
    let connected = json!({
        "type": "audio_connected",
        "message": "Ready to receive audio"
    });

    if tx.send(connected.to_string()).is_err() {
        tracing::error!("Failed to send audio connection message");
        send_task.abort();
        return;
    }

    // Handle incoming audio chunks
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Binary(data) => {
                tracing::debug!("Received {} bytes of audio", data.len());
                
                // Send to transcription service
                match transcription_provider.stream_transcribe(data.to_vec()).await {
                    Ok(result) => {
                        if !result.text.is_empty() {
                            // Store transcript chunk in database
                            let timestamp = chrono::Utc::now().timestamp() as f64;
                            if let Err(e) = sqlx::query(
                                r#"
                                INSERT INTO transcripts (segment_id, chunk_text, chunk_index, timestamp_start, timestamp_end)
                                VALUES ($1, $2, $3, $4, $5)
                                "#
                            )
                            .bind(segment_id)
                            .bind(&result.text)
                            .bind(chunk_index)
                            .bind(Some(timestamp))
                            .bind(Some(timestamp))
                            .execute(&state.db)
                            .await
                            {
                                tracing::error!("Failed to store transcript: {}", e);
                            }

                            chunk_index += 1;

                            // Accumulate transcript
                            if result.is_final {
                                transcript_buffer.push_str(&result.text);
                                transcript_buffer.push(' ');

                                // Broadcast transcript update
                                let transcript_msg = crate::ws::messages::AudioServerMessage::TranscriptUpdate {
                                    text: result.text.clone(),
                                    is_final: true,
                                };
                                broadcast_ws_message(&state.hub, event_id, transcript_msg).await;

                                // Check if we should generate a question
                                if last_question_gen_time.elapsed().as_secs() >= question_gen_interval_secs {
                                    last_question_gen_time = std::time::Instant::now();

                                    // Get previous transcript context
                                    let context_result = sqlx::query_scalar::<_, String>(
                                        "SELECT string_agg(chunk_text, ' ' ORDER BY chunk_index)
                                         FROM transcripts
                                         WHERE segment_id = $1 AND chunk_index < $2"
                                    )
                                    .bind(segment_id)
                                    .bind(chunk_index - 1)
                                    .fetch_optional(&state.db)
                                    .await
                                    .ok()
                                    .flatten()
                                    .unwrap_or_default();

                                    // Get num_fake_answers from event
                                    let num_fake_answers = sqlx::query_scalar::<_, i32>(
                                        "SELECT num_fake_answers FROM events WHERE id = $1"
                                    )
                                    .bind(event_id)
                                    .fetch_one(&state.db)
                                    .await
                                    .unwrap_or(3) as usize;

                                    // Generate question using question generation service
                                    // Try to get user's Ollama model preference
                                    let ollama_model = {
                                        let user_settings = sqlx::query_scalar::<_, Option<String>>(
                                            "SELECT ollama_model FROM user_ai_settings WHERE user_id = $1"
                                        )
                                        .bind(host_id)
                                        .fetch_optional(&state.db)
                                        .await
                                        .ok()
                                        .flatten()
                                        .flatten();
                                        
                                        user_settings.unwrap_or_else(|| state.config.ollama_model.clone())
                                    };
                                    
                                    // Create AI provider with proper error handling
                                    let ai_provider = match create_default_ai_provider(&state.config) {
                                        Ok(provider) => provider,
                                        Err(e) => {
                                            tracing::error!("Failed to create default AI provider: {}", e);
                                            // Only fall back to Ollama if base URL is configured and non-empty
                                            if state.config.ollama_base_url.is_empty() {
                                                tracing::error!("Cannot fall back to Ollama: base URL is not configured");
                                                // Send error to client and skip question generation
                                                let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                                    error: format!("AI provider configuration error: {}. Please configure an AI provider in settings.", e),
                                                };
                                                broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                                continue; // Skip this question generation attempt
                                            }
                                            tracing::error!("Falling back to Ollama provider at {} with model {}", state.config.ollama_base_url, ollama_model);
                                            Box::new(OllamaProvider::new(
                                                state.config.ollama_base_url.clone(),
                                                ollama_model,
                                            )) as Box<dyn AIProvider>
                                        }
                                    };
                                    
                                    // Send processing status: generating
                                    let status_msg = ServerMessage::ProcessingStatus {
                                        step: "generating".to_string(),
                                        progress: Some(75),
                                        message: "Generating questions from transcript...".to_string(),
                                    };
                                    broadcast_ws_message(&state.hub, event_id, status_msg).await;

                                    let question_service = crate::services::question_gen::QuestionGenerationService::new(
                                        state.db.clone(),
                                        ai_provider,
                                        state.config.enable_ai_quality_scoring,
                                        num_fake_answers,
                                    );

                                    match question_service.analyze_transcript(
                                        segment_id,
                                        &context_result,
                                        &result.text,
                                    ).await {
                                        Ok(Some(generated)) => {
                                            // Store question if quality is good
                                            if generated.quality_score > 0.6 {
                                                if let Ok(qid) = question_service.store_question(
                                                    segment_id,
                                                    &generated.question,
                                                    &generated.correct_answer,
                                                    &generated.source_transcript,
                                                    generated.quality_score,
                                                    &generated.fake_answers,
                                                ).await {
                                                    // Broadcast question generated
                                                    let question_msg = crate::ws::messages::AudioServerMessage::QuestionGenerated {
                                                        question: generated.question,
                                                        correct_answer: generated.correct_answer,
                                                        source_transcript: generated.source_transcript,
                                                    };
                                                    broadcast_ws_message(&state.hub, event_id, question_msg).await;
                                                } else {
                                                    tracing::error!("Failed to store generated question for segment {}", segment_id);
                                                }
                                            } else {
                                                tracing::debug!("Generated question quality score {} below threshold 0.6", generated.quality_score);
                                            }
                                        }
                                        Ok(None) => {
                                            tracing::debug!("Question generation returned None for segment {}", segment_id);
                                        }
                                        Err(e) => {
                                            tracing::error!("Question generation failed for segment {}: {}", segment_id, e);
                                            // Send error message to client via WebSocket
                                            let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                                error: format!("Failed to generate question: {}", e),
                                            };
                                            broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                        }
                                    }
                                }
                            } else {
                                // Interim result - just broadcast
                                let transcript_msg = crate::ws::messages::AudioServerMessage::TranscriptUpdate {
                                    text: result.text,
                                    is_final: false,
                                };
                                broadcast_ws_message(&state.hub, event_id, transcript_msg).await;
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Transcription error: {}", e);
                        let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                            error: format!("Transcription failed: {}", e),
                        };
                        send_ws_message(&tx, error_msg).await;
                    }
                }
            }
            Message::Text(text) => {
                // Handle control messages
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed.get("type").and_then(|v| v.as_str()) == Some("audio_stop") {
                        tracing::info!("Audio stream ended");
                        // Send processing status: transcribing
                        let status_msg = ServerMessage::ProcessingStatus {
                            step: "transcribing".to_string(),
                            progress: Some(50),
                            message: "Processing final transcription...".to_string(),
                        };
                        broadcast_ws_message(&state.hub, event_id, status_msg).await;
                        
                        // Wait a bit for final transcripts to process, then send ready
                        tokio::time::sleep(tokio::time::Duration::from_secs(2)).await;
                        let ready_msg = ServerMessage::ProcessingStatus {
                            step: "ready".to_string(),
                            progress: Some(100),
                            message: "Ready to start quiz".to_string(),
                        };
                        broadcast_ws_message(&state.hub, event_id, ready_msg).await;
                        break;
                    }
                }
            }
            Message::Close(_) => {
                tracing::info!("Audio connection closed");
                break;
            }
            _ => {}
        }
    }

    send_task.abort();
}

/// Handle audio connection using Deepgram streaming transcription
async fn handle_audio_connection_streaming(
    socket: WebSocket,
    segment_id: Uuid,
    event_id: Uuid,
    host_id: Uuid,
    state: AppState,
    deepgram_api_key: String,
) {
    // Split WebSocket connection
    let (mut sender, mut receiver) = socket.split();

    // Create Deepgram streaming client
    let mut streaming_client = crate::services::transcription::DeepgramStreamingClient::new(deepgram_api_key);

    // Connect to Deepgram WebSocket
    if let Err(e) = streaming_client.connect().await {
        tracing::error!("Failed to connect to Deepgram streaming: {}", e);
        let error_msg = json!({
            "type": "transcription_error",
            "error": format!("Failed to establish streaming connection: {}", e)
        });
        let _ = sender.send(Message::Text(error_msg.to_string())).await;
        return;
    }

    tracing::info!("Deepgram streaming connection established for segment {}", segment_id);

    // State variables
    let mut chunk_index = 0i32;
    let mut last_question_gen_time = std::time::Instant::now();

    // Get question generation interval
    let question_gen_interval_secs: u64 = {
        match sqlx::query_scalar::<_, Option<i32>>(
            "SELECT question_gen_interval_seconds FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_one(&state.db)
        .await {
            Ok(Some(interval)) => {
                if interval >= 10 && interval <= 300 {
                    interval as u64
                } else {
                    tracing::warn!("Invalid question_gen_interval_seconds {} for event {}, using default 30", interval, event_id);
                    30
                }
            }
            Ok(None) => 30,
            Err(e) => {
                tracing::warn!("Failed to fetch question_gen_interval_seconds for event {}: {}, using default 30", event_id, e);
                30
            }
        }
    };

    // Get broadcast receiver for this event
    let mut event_rx = state.hub.get_or_create_event_session(event_id).await;

    // Channel for direct messages to this client
    let (tx, mut direct_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Channels for bidirectional communication with Deepgram task
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, mut transcript_rx) = tokio::sync::mpsc::channel::<crate::services::transcription::TranscriptionResult>(100);

    // Spawn task to forward broadcast messages and direct messages
    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = event_rx.recv() => {
                    match msg {
                        Ok(val) => {
                            if let Some(msg_type) = val.get("type").and_then(|v| v.as_str()) {
                                if msg_type == "transcript_update" || msg_type == "question_generated" {
                                    if sender.send(Message::Text(val.to_string())).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                msg = direct_rx.recv() => {
                    match msg {
                        Some(text) => {
                            if sender.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
    });

    // Spawn task to manage Deepgram streaming (send audio + receive transcripts)
    let deepgram_task = {
        let mut client = streaming_client;
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Send audio chunks to Deepgram
                    audio_chunk = audio_rx.recv() => {
                        match audio_chunk {
                            Some(chunk) => {
                                if let Err(e) = client.send_audio(chunk).await {
                                    tracing::error!("Failed to send audio to Deepgram: {}", e);
                                    break;
                                }
                            }
                            None => {
                                tracing::debug!("Audio channel closed, stopping Deepgram task");
                                break;
                            }
                        }
                    }

                    // Receive transcripts from Deepgram
                    transcript_result = client.receive_transcript() => {
                        match transcript_result {
                            Ok(Some(result)) => {
                                if transcript_tx.send(result).await.is_err() {
                                    tracing::debug!("Transcript channel closed, stopping Deepgram task");
                                    break;
                                }
                            }
                            Ok(None) => {
                                tracing::info!("Deepgram streaming connection closed");
                                break;
                            }
                            Err(e) => {
                                tracing::error!("Error receiving transcript from Deepgram: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
            // Close connection when done
            tracing::info!("Closing Deepgram streaming connection");
            let _ = client.close().await;
        })
    };

    // Send connection confirmation
    let connected = json!({
        "type": "audio_connected",
        "message": "Ready to receive audio (streaming mode)"
    });

    if tx.send(connected.to_string()).is_err() {
        tracing::error!("Failed to send audio connection message");
        send_task.abort();
        deepgram_task.abort();
        return;
    }

    // Main loop: handle audio chunks and transcript results
    loop {
        tokio::select! {
            // Handle incoming audio chunks from client
            audio_msg = receiver.next() => {
                match audio_msg {
                    Some(Ok(Message::Binary(data))) => {
                        tracing::debug!("Received {} bytes of audio for streaming", data.len());

                        // Send audio to Deepgram task via channel
                        if let Err(e) = audio_tx.send(data.to_vec()).await {
                            tracing::error!("Failed to send audio to Deepgram task: {}", e);
                            let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                error: format!("Streaming transcription failed: {}", e),
                            };
                            send_ws_message(&tx, error_msg).await;
                            break;
                        }
                    }
                    Some(Ok(Message::Text(text))) => {
                        // Handle control messages
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            if parsed.get("type").and_then(|v| v.as_str()) == Some("audio_stop") {
                                tracing::info!("Audio stream ended");
                                // Send processing status: transcribing
                                let status_msg = ServerMessage::ProcessingStatus {
                                    step: "transcribing".to_string(),
                                    progress: Some(50),
                                    message: "Processing final transcription...".to_string(),
                                };
                                broadcast_ws_message(&state.hub, event_id, status_msg).await;
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("Audio connection closed");
                        break;
                    }
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    None => {
                        tracing::info!("Audio stream ended");
                        break;
                    }
                    _ => {}
                }
            }

            // Handle transcript results from Deepgram
            result = transcript_rx.recv() => {
                match result {
                    Some(transcript_result) => {
                        if !transcript_result.text.is_empty() {
                            // Store transcript chunk in database
                            let timestamp = chrono::Utc::now().timestamp() as f64;
                            if let Err(e) = sqlx::query(
                                r#"
                                INSERT INTO transcripts (segment_id, chunk_text, chunk_index, timestamp_start, timestamp_end)
                                VALUES ($1, $2, $3, $4, $5)
                                "#
                            )
                            .bind(segment_id)
                            .bind(&transcript_result.text)
                            .bind(chunk_index)
                            .bind(Some(timestamp))
                            .bind(Some(timestamp))
                            .execute(&state.db)
                            .await
                            {
                                tracing::error!("Failed to store transcript: {}", e);
                            }

                            chunk_index += 1;

                            // Broadcast transcript update
                            let transcript_msg = crate::ws::messages::AudioServerMessage::TranscriptUpdate {
                                text: transcript_result.text.clone(),
                                is_final: transcript_result.is_final,
                            };
                            broadcast_ws_message(&state.hub, event_id, transcript_msg).await;

                            // Check if we should generate a question (only for final results)
                            if transcript_result.is_final && last_question_gen_time.elapsed().as_secs() >= question_gen_interval_secs {
                                last_question_gen_time = std::time::Instant::now();

                                // Get previous transcript context
                                let context_result = sqlx::query_scalar::<_, String>(
                                    "SELECT string_agg(chunk_text, ' ' ORDER BY chunk_index)
                                     FROM transcripts
                                     WHERE segment_id = $1 AND chunk_index < $2"
                                )
                                .bind(segment_id)
                                .bind(chunk_index - 1)
                                .fetch_optional(&state.db)
                                .await
                                .ok()
                                .flatten()
                                .unwrap_or_default();

                                // Get num_fake_answers from event
                                let num_fake_answers = sqlx::query_scalar::<_, i32>(
                                    "SELECT num_fake_answers FROM events WHERE id = $1"
                                )
                                .bind(event_id)
                                .fetch_one(&state.db)
                                .await
                                .unwrap_or(3) as usize;

                                // Generate question
                                let ollama_model = {
                                    let user_settings = sqlx::query_scalar::<_, Option<String>>(
                                        "SELECT ollama_model FROM user_ai_settings WHERE user_id = $1"
                                    )
                                    .bind(host_id)
                                    .fetch_optional(&state.db)
                                    .await
                                    .ok()
                                    .flatten()
                                    .flatten();

                                    user_settings.unwrap_or_else(|| state.config.ollama_model.clone())
                                };

                                let ai_provider = match create_default_ai_provider(&state.config) {
                                    Ok(provider) => provider,
                                    Err(e) => {
                                        tracing::error!("Failed to create default AI provider: {}", e);
                                        if state.config.ollama_base_url.is_empty() {
                                            tracing::error!("Cannot fall back to Ollama: base URL is not configured");
                                            let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                                error: format!("AI provider configuration error: {}. Please configure an AI provider in settings.", e),
                                            };
                                            broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                            continue;
                                        }
                                        tracing::error!("Falling back to Ollama provider at {} with model {}", state.config.ollama_base_url, ollama_model);
                                        Box::new(OllamaProvider::new(
                                            state.config.ollama_base_url.clone(),
                                            ollama_model,
                                        )) as Box<dyn AIProvider>
                                    }
                                };

                                // Send processing status: generating
                                let status_msg = ServerMessage::ProcessingStatus {
                                    step: "generating".to_string(),
                                    progress: Some(75),
                                    message: "Generating questions from transcript...".to_string(),
                                };
                                broadcast_ws_message(&state.hub, event_id, status_msg).await;

                                let question_service = crate::services::question_gen::QuestionGenerationService::new(
                                    state.db.clone(),
                                    ai_provider,
                                    state.config.enable_ai_quality_scoring,
                                    num_fake_answers,
                                );

                                match question_service.analyze_transcript(
                                    segment_id,
                                    &context_result,
                                    &transcript_result.text,
                                ).await {
                                    Ok(Some(generated)) => {
                                        if generated.quality_score > 0.6 {
                                            if let Ok(_qid) = question_service.store_question(
                                                segment_id,
                                                &generated.question,
                                                &generated.correct_answer,
                                                &generated.source_transcript,
                                                generated.quality_score,
                                                &generated.fake_answers,
                                            ).await {
                                                let question_msg = crate::ws::messages::AudioServerMessage::QuestionGenerated {
                                                    question: generated.question,
                                                    correct_answer: generated.correct_answer,
                                                    source_transcript: generated.source_transcript,
                                                };
                                                broadcast_ws_message(&state.hub, event_id, question_msg).await;
                                            } else {
                                                tracing::error!("Failed to store generated question for segment {}", segment_id);
                                            }
                                        } else {
                                            tracing::debug!("Generated question quality score {} below threshold 0.6", generated.quality_score);
                                        }
                                    }
                                    Ok(None) => {
                                        tracing::debug!("Question generation returned None for segment {}", segment_id);
                                    }
                                    Err(e) => {
                                        tracing::error!("Question generation failed for segment {}: {}", segment_id, e);
                                        let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                            error: format!("Failed to generate question: {}", e),
                                        };
                                        broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                    }
                                }
                            }
                        }
                    }
                    None => {
                        tracing::info!("Transcript receiver channel closed");
                        break;
                    }
                }
            }
        }
    }

    // Cleanup
    tracing::info!("Cleaning up streaming connection for segment {}", segment_id);
    send_task.abort();
    deepgram_task.abort();
}

/// Handle audio connection using AssemblyAI streaming transcription
///
/// This function mirrors handle_audio_connection_streaming but uses AssemblyAIStreamingClient.
/// The implementation follows the same pattern:
/// - Split WebSocket connection
/// - Create AssemblyAI streaming client and connect
/// - Set up bidirectional channels for audio/transcripts
/// - Spawn tasks to manage streaming and transcript processing
/// - Handle question generation based on transcripts
async fn handle_audio_connection_streaming_assemblyai(
    socket: WebSocket,
    segment_id: Uuid,
    event_id: Uuid,
    host_id: Uuid,
    state: AppState,
    assemblyai_api_key: String,
) {
    // Split WebSocket connection
    let (mut sender, mut receiver) = socket.split();

    // Create AssemblyAI streaming client
    let mut streaming_client = crate::services::transcription::AssemblyAIStreamingClient::new(assemblyai_api_key);

    // Connect to AssemblyAI WebSocket
    if let Err(e) = streaming_client.connect().await {
        tracing::error!("Failed to connect to AssemblyAI streaming: {}", e);
        let error_msg = json!({
            "type": "transcription_error",
            "error": format!("Failed to establish streaming connection: {}", e)
        });
        let _ = sender.send(Message::Text(error_msg.to_string())).await;
        return;
    }

    tracing::info!("AssemblyAI streaming connection established for segment {}", segment_id);

    // State variables
    let mut chunk_index = 0i32;
    let mut last_question_gen_time = std::time::Instant::now();

    // Get question generation interval
    let question_gen_interval_secs: u64 = {
        match sqlx::query_scalar::<_, Option<i32>>(
            "SELECT question_gen_interval_seconds FROM events WHERE id = $1"
        )
        .bind(event_id)
        .fetch_one(&state.db)
        .await {
            Ok(Some(interval)) => {
                if interval >= 10 && interval <= 300 {
                    interval as u64
                } else {
                    tracing::warn!("Invalid question_gen_interval_seconds {} for event {}, using default 30", interval, event_id);
                    30
                }
            }
            Ok(None) => 30,
            Err(e) => {
                tracing::warn!("Failed to fetch question_gen_interval_seconds for event {}: {}, using default 30", event_id, e);
                30
            }
        }
    };

    // Get broadcast receiver for this event
    let mut event_rx = state.hub.get_or_create_event_session(event_id).await;

    // Channel for direct messages to this client
    let (tx, mut direct_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

    // Channels for bidirectional communication with AssemblyAI task
    let (audio_tx, mut audio_rx) = tokio::sync::mpsc::channel::<Vec<u8>>(100);
    let (transcript_tx, mut transcript_rx) = tokio::sync::mpsc::channel::<crate::services::transcription::TranscriptionResult>(100);

    // Spawn task to forward broadcast messages and direct messages
    let mut send_task = tokio::spawn(async move {
        loop {
            tokio::select! {
                msg = event_rx.recv() => {
                    match msg {
                        Ok(val) => {
                            if let Some(msg_type) = val.get("type").and_then(|v| v.as_str()) {
                                if msg_type == "transcript_update" || msg_type == "question_generated" {
                                    if sender.send(Message::Text(val.to_string())).await.is_err() {
                                        break;
                                    }
                                }
                            }
                        }
                        Err(_) => break,
                    }
                }
                msg = direct_rx.recv() => {
                    match msg {
                        Some(text) => {
                            if sender.send(Message::Text(text)).await.is_err() {
                                break;
                            }
                        }
                        None => break,
                    }
                }
            }
        }
    });

    // Spawn task to manage AssemblyAI streaming (send audio + receive transcripts)
    let assemblyai_task = {
        let mut client = streaming_client;
        tokio::spawn(async move {
            loop {
                tokio::select! {
                    // Send audio chunks to AssemblyAI
                    audio_chunk = audio_rx.recv() => {
                        match audio_chunk {
                            Some(chunk) => {
                                if let Err(e) = client.send_audio(chunk).await {
                                    tracing::error!("Failed to send audio to AssemblyAI: {}", e);
                                    break;
                                }
                            }
                            None => {
                                tracing::debug!("Audio channel closed, stopping AssemblyAI task");
                                break;
                            }
                        }
                    }

                    // Receive transcripts from AssemblyAI
                    transcript_result = client.receive_transcript() => {
                        match transcript_result {
                            Ok(Some(result)) => {
                                if transcript_tx.send(result).await.is_err() {
                                    tracing::debug!("Transcript channel closed, stopping AssemblyAI task");
                                    break;
                                }
                            }
                            Ok(None) => {
                                tracing::info!("AssemblyAI streaming connection closed");
                                break;
                            }
                            Err(e) => {
                                tracing::error!("Error receiving transcript from AssemblyAI: {}", e);
                                break;
                            }
                        }
                    }
                }
            }
            // Close connection when done
            tracing::info!("Closing AssemblyAI streaming connection");
            let _ = client.close().await;
        })
    };

    // Send connection confirmation
    let connected = json!({
        "type": "audio_connected",
        "message": "Ready to receive audio (AssemblyAI streaming mode)"
    });

    if tx.send(connected.to_string()).is_err() {
        tracing::error!("Failed to send audio connection message");
        send_task.abort();
        assemblyai_task.abort();
        return;
    }

    // Main loop: handle audio chunks and transcript results
    loop {
        tokio::select! {
            // Handle incoming audio chunks from client
            audio_msg = receiver.next() => {
                match audio_msg {
                    Some(Ok(Message::Binary(data))) => {
                        tracing::debug!("Received {} bytes of audio for AssemblyAI streaming", data.len());

                        // Send audio to AssemblyAI task via channel
                        if let Err(e) = audio_tx.send(data.to_vec()).await {
                            tracing::error!("Failed to send audio to AssemblyAI task: {}", e);
                            let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                error: format!("Streaming transcription failed: {}", e),
                            };
                            send_ws_message(&tx, error_msg).await;
                            break;
                        }
                    }
                    Some(Ok(Message::Text(text))) => {
                        // Handle control messages
                        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                            if parsed.get("type").and_then(|v| v.as_str()) == Some("audio_stop") {
                                tracing::info!("Audio stream ended");
                                // Send processing status: transcribing
                                let status_msg = ServerMessage::ProcessingStatus {
                                    step: "transcribing".to_string(),
                                    progress: Some(50),
                                    message: "Processing final transcription...".to_string(),
                                };
                                broadcast_ws_message(&state.hub, event_id, status_msg).await;
                                break;
                            }
                        }
                    }
                    Some(Ok(Message::Close(_))) => {
                        tracing::info!("Audio connection closed");
                        break;
                    }
                    Some(Err(e)) => {
                        tracing::error!("WebSocket error: {}", e);
                        break;
                    }
                    None => {
                        tracing::info!("Audio stream ended");
                        break;
                    }
                    _ => {}
                }
            }

            // Handle transcript results from AssemblyAI
            result = transcript_rx.recv() => {
                match result {
                    Some(transcript_result) => {
                        if !transcript_result.text.is_empty() {
                            // Store transcript chunk in database
                            let timestamp = chrono::Utc::now().timestamp() as f64;
                            if let Err(e) = sqlx::query(
                                r#"
                                INSERT INTO transcripts (segment_id, chunk_text, chunk_index, timestamp_start, timestamp_end)
                                VALUES ($1, $2, $3, $4, $5)
                                "#
                            )
                            .bind(segment_id)
                            .bind(&transcript_result.text)
                            .bind(chunk_index)
                            .bind(Some(timestamp))
                            .bind(Some(timestamp))
                            .execute(&state.db)
                            .await
                            {
                                tracing::error!("Failed to store transcript: {}", e);
                            }

                            chunk_index += 1;

                            // Broadcast transcript update
                            let transcript_msg = crate::ws::messages::AudioServerMessage::TranscriptUpdate {
                                text: transcript_result.text.clone(),
                                is_final: transcript_result.is_final,
                            };
                            broadcast_ws_message(&state.hub, event_id, transcript_msg).await;

                            // Check if we should generate a question (only for final results)
                            if transcript_result.is_final && last_question_gen_time.elapsed().as_secs() >= question_gen_interval_secs {
                                last_question_gen_time = std::time::Instant::now();

                                // Get previous transcript context
                                let context_result = sqlx::query_scalar::<_, String>(
                                    "SELECT string_agg(chunk_text, ' ' ORDER BY chunk_index)
                                     FROM transcripts
                                     WHERE segment_id = $1 AND chunk_index < $2"
                                )
                                .bind(segment_id)
                                .bind(chunk_index - 1)
                                .fetch_optional(&state.db)
                                .await
                                .ok()
                                .flatten()
                                .unwrap_or_default();

                                // Get num_fake_answers from event
                                let num_fake_answers = sqlx::query_scalar::<_, i32>(
                                    "SELECT num_fake_answers FROM events WHERE id = $1"
                                )
                                .bind(event_id)
                                .fetch_one(&state.db)
                                .await
                                .unwrap_or(3) as usize;

                                // Generate question
                                let ollama_model = {
                                    let user_settings = sqlx::query_scalar::<_, Option<String>>(
                                        "SELECT ollama_model FROM user_ai_settings WHERE user_id = $1"
                                    )
                                    .bind(host_id)
                                    .fetch_optional(&state.db)
                                    .await
                                    .ok()
                                    .flatten()
                                    .flatten();

                                    user_settings.unwrap_or_else(|| state.config.ollama_model.clone())
                                };

                                let ai_provider = match create_default_ai_provider(&state.config) {
                                    Ok(provider) => provider,
                                    Err(e) => {
                                        tracing::error!("Failed to create default AI provider: {}", e);
                                        if state.config.ollama_base_url.is_empty() {
                                            tracing::error!("Cannot fall back to Ollama: base URL is not configured");
                                            let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                                error: format!("AI provider configuration error: {}. Please configure an AI provider in settings.", e),
                                            };
                                            broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                            continue;
                                        }
                                        tracing::error!("Falling back to Ollama provider at {} with model {}", state.config.ollama_base_url, ollama_model);
                                        Box::new(OllamaProvider::new(
                                            state.config.ollama_base_url.clone(),
                                            ollama_model,
                                        )) as Box<dyn AIProvider>
                                    }
                                };

                                // Send processing status: generating
                                let status_msg = ServerMessage::ProcessingStatus {
                                    step: "generating".to_string(),
                                    progress: Some(75),
                                    message: "Generating questions from transcript...".to_string(),
                                };
                                broadcast_ws_message(&state.hub, event_id, status_msg).await;

                                let question_service = crate::services::question_gen::QuestionGenerationService::new(
                                    state.db.clone(),
                                    ai_provider,
                                    state.config.enable_ai_quality_scoring,
                                    num_fake_answers,
                                );

                                match question_service.analyze_transcript(
                                    segment_id,
                                    &context_result,
                                    &transcript_result.text,
                                ).await {
                                    Ok(Some(generated)) => {
                                        if generated.quality_score > 0.6 {
                                            if let Ok(_qid) = question_service.store_question(
                                                segment_id,
                                                &generated.question,
                                                &generated.correct_answer,
                                                &generated.source_transcript,
                                                generated.quality_score,
                                                &generated.fake_answers,
                                            ).await {
                                                let question_msg = crate::ws::messages::AudioServerMessage::QuestionGenerated {
                                                    question: generated.question,
                                                    correct_answer: generated.correct_answer,
                                                    source_transcript: generated.source_transcript,
                                                };
                                                broadcast_ws_message(&state.hub, event_id, question_msg).await;
                                            } else {
                                                tracing::error!("Failed to store generated question for segment {}", segment_id);
                                            }
                                        } else {
                                            tracing::debug!("Generated question quality score {} below threshold 0.6", generated.quality_score);
                                        }
                                    }
                                    Ok(None) => {
                                        tracing::debug!("Question generation returned None for segment {}", segment_id);
                                    }
                                    Err(e) => {
                                        tracing::error!("Question generation failed for segment {}: {}", segment_id, e);
                                        let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                                            error: format!("Failed to generate question: {}", e),
                                        };
                                        broadcast_ws_message(&state.hub, event_id, error_msg).await;
                                    }
                                }
                            }
                        }
                    }
                    None => {
                        tracing::info!("Transcript receiver channel closed");
                        break;
                    }
                }
            }
        }
    }

    // Cleanup
    tracing::info!("Cleaning up AssemblyAI streaming connection for segment {}", segment_id);
    send_task.abort();
    assemblyai_task.abort();
}

/// Create default transcription provider from config
fn create_default_transcription_provider(config: &crate::config::Config) -> Result<Box<dyn crate::services::transcription::TranscriptionProvider>> {
    match config.default_stt_provider.as_str() {
        "deepgram" => {
            if let Some(api_key) = &config.deepgram_api_key {
                if api_key.is_empty() {
                    tracing::warn!("Deepgram API key is empty, cannot create provider");
                    Err(crate::error::AppError::Internal("No transcription provider configured: Deepgram API key is missing".to_string()))
                } else {
                    Ok(Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone())))
                }
            } else {
                tracing::warn!("Deepgram API key not configured, cannot create provider");
                Err(crate::error::AppError::Internal("No transcription provider configured: Deepgram API key is missing".to_string()))
            }
        }
        "whisper" => {
            if let Some(api_key) = &config.openai_api_key {
                if api_key.is_empty() {
                    tracing::warn!("OpenAI API key is empty, cannot create Whisper provider");
                    Err(crate::error::AppError::Internal("No transcription provider configured: OpenAI API key is missing".to_string()))
                } else {
                    Ok(Box::new(crate::services::transcription::WhisperProvider::new(api_key.clone())))
                }
            } else {
                tracing::warn!("OpenAI API key not configured, cannot create Whisper provider");
                Err(crate::error::AppError::Internal("No transcription provider configured: OpenAI API key is missing".to_string()))
            }
        }
        "assemblyai" => {
            if let Some(api_key) = &config.assemblyai_api_key {
                if api_key.is_empty() {
                    tracing::warn!("AssemblyAI API key is empty, cannot create provider");
                    Err(crate::error::AppError::Internal("No transcription provider configured: AssemblyAI API key is missing".to_string()))
                } else {
                    Ok(Box::new(crate::services::transcription::AssemblyAIProvider::new(api_key.clone())))
                }
            } else {
                tracing::warn!("AssemblyAI API key not configured, cannot create provider");
                Err(crate::error::AppError::Internal("No transcription provider configured: AssemblyAI API key is missing".to_string()))
            }
        }
        _ => {
            // Default to Deepgram
            if let Some(api_key) = &config.deepgram_api_key {
                if api_key.is_empty() {
                    tracing::warn!("Default Deepgram API key is empty, cannot create provider");
                    Err(crate::error::AppError::Internal("No transcription provider configured: Deepgram API key is missing".to_string()))
                } else {
                    Ok(Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone())))
                }
            } else {
                tracing::warn!("No default transcription provider configured");
                Err(crate::error::AppError::Internal("No transcription provider configured: No API keys available".to_string()))
            }
        }
    }
}
