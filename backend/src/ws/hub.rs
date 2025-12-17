use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Participant connection info
#[derive(Debug, Clone)]
pub struct Participant {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
}

/// Game state for an event
#[derive(Debug, Clone)]
pub struct GameState {
    pub event_id: Uuid,
    pub current_segment_id: Option<Uuid>,
    pub current_question_id: Option<Uuid>,
    pub current_question_index: i32,
    pub question_started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub time_limit_seconds: i32,
    pub participants: HashMap<Uuid, Participant>,
    pub answers_received: HashMap<Uuid, String>, // user_id -> selected_answer
}

/// WebSocket connection hub for managing all active sessions
pub struct Hub {
    // Event-based sessions (for game state)
    event_sessions: tokio::sync::RwLock<HashMap<Uuid, (broadcast::Sender<Value>, GameState)>>,
    // Legacy session_code-based sessions (for backward compatibility)
    sessions: tokio::sync::RwLock<HashMap<String, broadcast::Sender<Value>>>,
}

impl Hub {
    /// Create a new hub
    pub fn new() -> Self {
        Self {
            event_sessions: tokio::sync::RwLock::new(HashMap::new()),
            sessions: tokio::sync::RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a broadcast channel for an event
    pub async fn get_or_create_event_session(&self, event_id: Uuid) -> broadcast::Receiver<Value> {
        let mut sessions = self.event_sessions.write().await;

        if let Some((tx, _)) = sessions.get(&event_id) {
            tx.subscribe()
        } else {
            let (tx, rx) = broadcast::channel(100);
            let game_state = GameState {
                event_id,
                current_segment_id: None,
                current_question_id: None,
                current_question_index: 0,
                question_started_at: None,
                time_limit_seconds: 30,
                participants: HashMap::new(),
                answers_received: HashMap::new(),
            };
            sessions.insert(event_id, (tx, game_state));
            rx
        }
    }

    /// Add participant to an event session
    pub async fn add_participant(&self, event_id: Uuid, participant: Participant) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.participants.insert(participant.user_id, participant);
        }
    }

    /// Remove participant from an event session
    pub async fn remove_participant(&self, event_id: Uuid, user_id: Uuid) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.participants.remove(&user_id);
            game_state.answers_received.remove(&user_id);
        }
    }

    /// Get game state for an event
    pub async fn get_game_state(&self, event_id: Uuid) -> Option<GameState> {
        let sessions = self.event_sessions.read().await;
        sessions.get(&event_id).map(|(_, state)| state.clone())
    }

    /// Update game state
    pub async fn update_game_state<F>(&self, event_id: Uuid, update_fn: F)
    where
        F: FnOnce(&mut GameState),
    {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            update_fn(game_state);
        }
    }

    /// Record an answer for a question
    pub async fn record_answer(&self, event_id: Uuid, user_id: Uuid, answer: String) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.answers_received.insert(user_id, answer);
        }
    }

    /// Clear answers for next question
    pub async fn clear_answers(&self, event_id: Uuid) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.answers_received.clear();
        }
    }

    /// Broadcast a message to all clients in an event
    pub async fn broadcast_to_event(&self, event_id: Uuid, message: &Value) {
        let sessions = self.event_sessions.read().await;
        if let Some((tx, _)) = sessions.get(&event_id) {
            let _ = tx.send(message.clone());
        }
    }

    /// Get or create a broadcast channel for a session (legacy)
    pub async fn get_or_create_session(&self, session_code: &str) -> broadcast::Receiver<Value> {
        let mut sessions = self.sessions.write().await;

        if let Some(tx) = sessions.get(session_code) {
            tx.subscribe()
        } else {
            let (tx, rx) = broadcast::channel(100);
            sessions.insert(session_code.to_string(), tx);
            rx
        }
    }

    /// Broadcast a message to all clients in a session (legacy)
    pub async fn broadcast_to_session(&self, session_code: &str, message: &Value) {
        let sessions = self.sessions.read().await;
        if let Some(tx) = sessions.get(session_code) {
            let _ = tx.send(message.clone());
        }
    }

    /// Remove a session when it ends
    pub async fn remove_session(&self, session_code: &str) {
        self.sessions.write().await.remove(session_code);
    }

    /// Remove an event session when it ends
    pub async fn remove_event_session(&self, event_id: Uuid) {
        self.event_sessions.write().await.remove(&event_id);
    }
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}
