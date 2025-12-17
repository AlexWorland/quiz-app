use axum::extract::ws::{WebSocket, Message};
use futures::{SinkExt, StreamExt};
use serde_json::json;
use uuid::Uuid;
use chrono::Utc;
use rand::seq::SliceRandom;
use rand::thread_rng;

use crate::AppState;
use crate::ws::messages::{GameMessage, ServerMessage, ParticipantMessage};
use crate::ws::hub::Participant;
use crate::services::scoring::calculate_speed_based_score;
use crate::services::ai::{AIProvider, ClaudeProvider, OpenAIProvider, OllamaProvider};
use crate::error::Result;

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
    .await?;

    let (num_fake, host_id) = event_info.ok_or_else(|| crate::error::AppError::Internal("Event not found".to_string()))?;

    // Get AI provider for host (or use default)
    let ai_provider: Box<dyn AIProvider> = {
        // Try to get user's AI settings
        let user_settings = sqlx::query_as::<_, (String, Option<String>)>(
            "SELECT llm_provider, llm_api_key_encrypted FROM user_ai_settings WHERE user_id = $1"
        )
        .bind(host_id)
        .fetch_optional(&state.db)
        .await?;

        if let Some((provider, _key_encrypted)) = user_settings {
            // TODO: Decrypt API key
            match provider.as_str() {
                "claude" => {
                    if let Some(api_key) = &state.config.anthropic_api_key {
                        Box::new(ClaudeProvider::new(api_key.clone()))
                    } else {
                        // Fallback to default
                        create_default_ai_provider(&state.config)?
                    }
                }
                "openai" => {
                    if let Some(api_key) = &state.config.openai_api_key {
                        Box::new(OpenAIProvider::new(api_key.clone()))
                    } else {
                        create_default_ai_provider(&state.config)?
                    }
                }
                "ollama" => {
                    Box::new(OllamaProvider::new(
                        state.config.ollama_base_url.clone(),
                        "llama2".to_string(),
                    ))
                }
                _ => create_default_ai_provider(&state.config)?,
            }
        } else {
            // Use default provider
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
                "llama2".to_string(),
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
                                let stroke_json = serde_json::to_value(&stroke).unwrap();
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
                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&stroke_msg).unwrap()).await;
                            }
                        }
                        crate::ws::messages::CanvasMessage::ClearCanvas => {
                            // Only host can clear canvas
                            if let Some(uid) = user_id {
                                let is_host = sqlx::query_scalar::<_, bool>(
                                    "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                                )
                                .bind(event_id)
                                .bind(uid)
                                .fetch_one(&state.db)
                                .await
                                .unwrap_or(false);

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
                                    state.hub.broadcast_to_event(event_id, &serde_json::to_value(&clear_msg).unwrap()).await;
                                } else {
                                    let error_msg = ServerMessage::Error {
                                        message: "Only host can clear canvas".to_string(),
                                    };
                                    let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
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
                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
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

                                // Get current participants
                                let game_state = state.hub.get_game_state(event_id).await;
                                let participants: Vec<ParticipantMessage> = if let Some(state) = game_state {
                                    state.participants.values().map(|p| ParticipantMessage {
                                        id: p.user_id,
                                        username: p.username.clone(),
                                        avatar_url: p.avatar_url.clone(),
                                    }).collect()
                                } else {
                                    vec![]
                                };

                                // Send connected message
                                let connected = ServerMessage::Connected { participants };
                                let _ = tx.send(serde_json::to_string(&connected).unwrap());

                                // Send canvas sync on join
                                let strokes_result = sqlx::query_scalar::<_, sqlx::types::Json<serde_json::Value>>(
                                    "SELECT stroke_data FROM canvas_strokes WHERE event_id = $1 ORDER BY created_at ASC"
                                )
                                .bind(event_id)
                                .fetch_all(&state.db)
                                .await;

                                if let Ok(strokes_json) = strokes_result {
                                    let strokes: Vec<crate::ws::messages::StrokeData> = strokes_json
                                        .into_iter()
                                        .filter_map(|json| {
                                            serde_json::from_value(json.0).ok()
                                        })
                                        .collect();

                                    if !strokes.is_empty() {
                                        let sync_msg = crate::ws::messages::CanvasServerMessage::CanvasSync { strokes };
                                        let _ = tx.send(serde_json::to_string(&sync_msg).unwrap());
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
                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&joined).unwrap()).await;
                            }
                            Ok(None) => {
                                let error_msg = ServerMessage::Error {
                                    message: "User not found".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            }
                            Err(e) => {
                                tracing::error!("Database error: {}", e);
                                let error_msg = ServerMessage::Error {
                                    message: "Database error".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            }
                        }
                    }
                    GameMessage::Answer { question_id, selected_answer, response_time_ms } => {
                        if user_id.is_none() {
                            let error_msg = ServerMessage::Error {
                                message: "Not joined to event".to_string(),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            continue;
                        }

                        let uid = user_id.unwrap();
                        
                        // Get current game state
                        let game_state = state.hub.get_game_state(event_id).await;
                        let Some(state_ref) = game_state else {
                            let error_msg = ServerMessage::Error {
                                message: "Game not active".to_string(),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            continue;
                        };

                        let Some(current_question_id) = state_ref.current_question_id else {
                            let error_msg = ServerMessage::Error {
                                message: "No active question".to_string(),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            continue;
                        };

                        if current_question_id != question_id {
                            let error_msg = ServerMessage::Error {
                                message: "Question mismatch".to_string(),
                            };
                            let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            continue;
                        }

                        // Get question to check correct answer
                        let question_result = sqlx::query_as::<_, (String, Uuid)>(
                            "SELECT correct_answer, segment_id FROM questions WHERE id = $1"
                        )
                        .bind(question_id)
                        .fetch_optional(&state.db)
                        .await;

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

                                // Broadcast answer received (host only sees this)
                                let answer_received = ServerMessage::AnswerReceived { user_id: uid };
                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&answer_received).unwrap()).await;
                            }
                            Ok(None) => {
                                let error_msg = ServerMessage::Error {
                                    message: "Question not found".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            }
                            Err(e) => {
                                tracing::error!("Database error: {}", e);
                                let error_msg = ServerMessage::Error {
                                    message: "Database error".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            }
                        }
                    }
                    GameMessage::StartGame => {
                        // Only host can start game - check if user is event host
                        if let Some(uid) = user_id {
                            let is_host = sqlx::query_scalar::<_, bool>(
                                "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                            )
                            .bind(event_id)
                            .bind(uid)
                            .fetch_one(&state.db)
                            .await
                            .unwrap_or(false);

                            if !is_host {
                                let error_msg = ServerMessage::Error {
                                    message: "Only host can start game".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                continue;
                            }

                            // Get first segment for this event
                            let segment_result = sqlx::query_as::<_, (Uuid,)>(
                                "SELECT id FROM segments WHERE event_id = $1 ORDER BY order_index LIMIT 1"
                            )
                            .bind(event_id)
                            .fetch_optional(&state.db)
                            .await;

                            if let Ok(Some((segment_id,))) = segment_result {
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
                                        // Get time limit from event
                                        let time_limit = sqlx::query_scalar::<_, i32>(
                                            "SELECT time_per_question FROM events WHERE id = $1"
                                        )
                                        .bind(event_id)
                                        .fetch_one(&state.db)
                                        .await
                                        .unwrap_or(30);

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

                                        // Broadcast game started and first question
                                        let started = ServerMessage::GameStarted;
                                        state.hub.broadcast_to_event(event_id, &serde_json::to_value(&started).unwrap()).await;

                                        let question_msg = ServerMessage::Question {
                                            question_id: qid,
                                            text: qtext,
                                            answers: all_answers,
                                            time_limit,
                                        };
                                        state.hub.broadcast_to_event(event_id, &serde_json::to_value(&question_msg).unwrap()).await;
                                    }
                                    Ok(None) => {
                                        let error_msg = ServerMessage::Error {
                                            message: "No questions found for this event".to_string(),
                                        };
                                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                    }
                                    Err(e) => {
                                        tracing::error!("Database error: {}", e);
                                        let error_msg = ServerMessage::Error {
                                            message: "Database error".to_string(),
                                        };
                                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                    }
                                }
                            } else {
                                let error_msg = ServerMessage::Error {
                                    message: "No segments found for this event".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                            }
                        }
                    }
                    GameMessage::NextQuestion => {
                        // Only host can advance questions
                        if let Some(uid) = user_id {
                            let is_host = sqlx::query_scalar::<_, bool>(
                                "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                            )
                            .bind(event_id)
                            .bind(uid)
                            .fetch_one(&state.db)
                            .await
                            .unwrap_or(false);

                            if !is_host {
                                let error_msg = ServerMessage::Error {
                                    message: "Only host can advance questions".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                continue;
                            }

                            // Get next question for current segment
                            let game_state = state.hub.get_game_state(event_id).await;
                            if let Some(state_ref) = game_state {
                                if let Some(segment_id) = state_ref.current_segment_id {
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
                                            let time_limit = sqlx::query_scalar::<_, i32>(
                                                "SELECT time_per_question FROM events WHERE id = $1"
                                            )
                                            .bind(event_id)
                                            .fetch_one(&state.db)
                                            .await
                                            .unwrap_or(30);

                                            // Update game state
                                            state.hub.update_game_state(event_id, |state| {
                                                state.current_question_id = Some(qid);
                                                state.current_question_index = next_index;
                                                state.question_started_at = Some(Utc::now());
                                                state.time_limit_seconds = time_limit;
                                            }).await;
                                            state.hub.clear_answers(event_id).await;

                                            // Broadcast question
                                            let question_msg = ServerMessage::Question {
                                                question_id: qid,
                                                text: qtext,
                                                answers: all_answers,
                                                time_limit,
                                            };
                                            state.hub.broadcast_to_event(event_id, &serde_json::to_value(&question_msg).unwrap()).await;
                                        }
                                        Ok(None) => {
                                            // No more questions - end game
                                            let ended = ServerMessage::GameEnded;
                                            state.hub.broadcast_to_event(event_id, &serde_json::to_value(&ended).unwrap()).await;
                                        }
                                        Err(e) => {
                                            tracing::error!("Database error: {}", e);
                                        }
                                    }
                                }
                            }
                        }
                    }
                    GameMessage::RevealAnswer => {
                        // Only host can reveal answers
                        if let Some(uid) = user_id {
                            let is_host = sqlx::query_scalar::<_, bool>(
                                "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                            )
                            .bind(event_id)
                            .bind(uid)
                            .fetch_one(&state.db)
                            .await
                            .unwrap_or(false);

                            if !is_host {
                                let error_msg = ServerMessage::Error {
                                    message: "Only host can reveal answers".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                continue;
                            }

                            // Get current question and calculate distribution
                            let game_state = state.hub.get_game_state(event_id).await;
                            if let Some(state_ref) = game_state {
                                if let Some(question_id) = state_ref.current_question_id {
                                    // Get correct answer
                                    let correct_result = sqlx::query_scalar::<_, String>(
                                        "SELECT correct_answer FROM questions WHERE id = $1"
                                    )
                                    .bind(question_id)
                                    .fetch_one(&state.db)
                                    .await;

                                    if let Ok(correct_answer) = correct_result {
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

                                        // Broadcast reveal
                                        let reveal = ServerMessage::Reveal {
                                            correct_answer,
                                            distribution,
                                        };
                                        state.hub.broadcast_to_event(event_id, &serde_json::to_value(&reveal).unwrap()).await;
                                    }
                                }
                            }
                        }
                    }
                    GameMessage::ShowLeaderboard => {
                        // Get leaderboard for current segment or event
                        let game_state = state.hub.get_game_state(event_id).await;
                        if let Some(state_ref) = game_state {
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
                                    state.hub.broadcast_to_event(event_id, &serde_json::to_value(&leaderboard).unwrap()).await;
                                }
                            }
                        }
                    }
                    GameMessage::EndGame => {
                        // Only host can end game
                        if let Some(uid) = user_id {
                            let is_host = sqlx::query_scalar::<_, bool>(
                                "SELECT EXISTS(SELECT 1 FROM events WHERE id = $1 AND host_id = $2)"
                            )
                            .bind(event_id)
                            .bind(uid)
                            .fetch_one(&state.db)
                            .await
                            .unwrap_or(false);

                            if !is_host {
                                let error_msg = ServerMessage::Error {
                                    message: "Only host can end game".to_string(),
                                };
                                let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                                continue;
                            }

                            let ended = ServerMessage::GameEnded;
                            state.hub.broadcast_to_event(event_id, &serde_json::to_value(&ended).unwrap()).await;
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
                    state.hub.remove_participant(event_id, uid).await;
                    
                    // Broadcast participant left
                    let left = ServerMessage::ParticipantLeft { user_id: uid };
                    state.hub.broadcast_to_event(event_id, &serde_json::to_value(&left).unwrap()).await;
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
    .await;

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
        .ok()
        .flatten();

        if let Some((provider, _key_encrypted)) = user_settings {
            // TODO: Decrypt API key
            match provider.as_str() {
                "deepgram" => {
                    if let Some(api_key) = &state.config.deepgram_api_key {
                        Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone()))
                    } else {
                        // Fallback to default
                        create_default_transcription_provider(&state.config)
                    }
                }
                "whisper" => {
                    if let Some(api_key) = &state.config.openai_api_key {
                        Box::new(crate::services::transcription::WhisperProvider::new(api_key.clone()))
                    } else {
                        create_default_transcription_provider(&state.config)
                    }
                }
                "assemblyai" => {
                    if let Some(api_key) = &state.config.assemblyai_api_key {
                        Box::new(crate::services::transcription::AssemblyAIProvider::new(api_key.clone()))
                    } else {
                        create_default_transcription_provider(&state.config)
                    }
                }
                _ => create_default_transcription_provider(&state.config),
            }
        } else {
            create_default_transcription_provider(&state.config)
        }
    };

    let (mut sender, mut receiver) = socket.split();
    let mut transcript_buffer = String::new();
    let mut chunk_index = 0i32;
    let mut last_question_gen_time = std::time::Instant::now();
    const QUESTION_GEN_INTERVAL_SECS: u64 = 30; // Generate questions every 30 seconds

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
                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&transcript_msg).unwrap()).await;

                                // Check if we should generate a question
                                if last_question_gen_time.elapsed().as_secs() >= QUESTION_GEN_INTERVAL_SECS {
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

                                    // Generate question using question generation service
                                    let question_service = crate::services::question_gen::QuestionGenerationService::new(
                                        state.db.clone(),
                                        create_default_ai_provider(&state.config).unwrap_or_else(|_| {
                                            Box::new(OllamaProvider::new(
                                                state.config.ollama_base_url.clone(),
                                                "llama2".to_string(),
                                            ))
                                        }),
                                    );

                                    if let Ok(Some(generated)) = question_service.analyze_transcript(
                                        segment_id,
                                        &context_result,
                                        &result.text,
                                    ).await {
                                        // Store question if quality is good
                                        if generated.quality_score > 0.6 {
                                            if let Ok(qid) = question_service.store_question(
                                                segment_id,
                                                &generated.question,
                                                &generated.correct_answer,
                                                &generated.source_transcript,
                                                generated.quality_score,
                                            ).await {
                                                // Broadcast question generated
                                                let question_msg = crate::ws::messages::AudioServerMessage::QuestionGenerated {
                                                    question: generated.question,
                                                    correct_answer: generated.correct_answer,
                                                    source_transcript: generated.source_transcript,
                                                };
                                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&question_msg).unwrap()).await;
                                            }
                                        }
                                    }
                                }
                            } else {
                                // Interim result - just broadcast
                                let transcript_msg = crate::ws::messages::AudioServerMessage::TranscriptUpdate {
                                    text: result.text,
                                    is_final: false,
                                };
                                state.hub.broadcast_to_event(event_id, &serde_json::to_value(&transcript_msg).unwrap()).await;
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!("Transcription error: {}", e);
                        let error_msg = crate::ws::messages::AudioServerMessage::TranscriptionError {
                            error: format!("Transcription failed: {}", e),
                        };
                        let _ = tx.send(serde_json::to_string(&error_msg).unwrap());
                    }
                }
            }
            Message::Text(text) => {
                // Handle control messages
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed.get("type").and_then(|v| v.as_str()) == Some("audio_stop") {
                        tracing::info!("Audio stream ended");
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

/// Create default transcription provider from config
fn create_default_transcription_provider(config: &crate::config::Config) -> Box<dyn crate::services::transcription::TranscriptionProvider> {
    match config.default_stt_provider.as_str() {
        "deepgram" => {
            if let Some(api_key) = &config.deepgram_api_key {
                Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone()))
            } else {
                // Fallback
                Box::new(crate::services::transcription::DeepgramProvider::new("".to_string()))
            }
        }
        "whisper" => {
            if let Some(api_key) = &config.openai_api_key {
                Box::new(crate::services::transcription::WhisperProvider::new(api_key.clone()))
            } else {
                Box::new(crate::services::transcription::WhisperProvider::new("".to_string()))
            }
        }
        "assemblyai" => {
            if let Some(api_key) = &config.assemblyai_api_key {
                Box::new(crate::services::transcription::AssemblyAIProvider::new(api_key.clone()))
            } else {
                Box::new(crate::services::transcription::AssemblyAIProvider::new("".to_string()))
            }
        }
        _ => {
            // Default to Deepgram
            if let Some(api_key) = &config.deepgram_api_key {
                Box::new(crate::services::transcription::DeepgramProvider::new(api_key.clone()))
            } else {
                Box::new(crate::services::transcription::DeepgramProvider::new("".to_string()))
            }
        }
    }
}
