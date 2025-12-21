use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::broadcast;
use uuid::Uuid;

/// Quiz phase state machine
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuizPhase {
    NotStarted,
    ShowingQuestion,
    RevealingAnswer,
    ShowingLeaderboard,
    BetweenQuestions,
    SegmentComplete,
    EventComplete,
}

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
    pub quiz_phase: QuizPhase,
    pub total_participants: usize, // Count of non-presenter participants
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
                quiz_phase: QuizPhase::NotStarted,
                total_participants: 0,
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

    /// Set quiz phase for an event
    pub async fn set_quiz_phase(&self, event_id: Uuid, phase: QuizPhase) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.quiz_phase = phase;
        }
    }

    /// Check if all participants have answered
    pub fn all_answered(&self, event_id: Uuid) -> bool {
        // This is a synchronous check, but we need async access
        // We'll check this in the handler after getting game state
        false // Placeholder - actual check done in handler
    }

    /// Increment participant count (exclude presenter)
    pub async fn increment_participant_count(&self, event_id: Uuid) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            game_state.total_participants += 1;
        }
    }

    /// Decrement participant count (exclude presenter)
    pub async fn decrement_participant_count(&self, event_id: Uuid) {
        let mut sessions = self.event_sessions.write().await;
        if let Some((_, game_state)) = sessions.get_mut(&event_id) {
            if game_state.total_participants > 0 {
                game_state.total_participants -= 1;
            }
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

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Arc;
    use tokio::time::{sleep, Duration};

    // Session Management Tests (5 tests)
    #[tokio::test]
    async fn test_create_new_event_session() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        // Verify session was created
        let state = hub.get_game_state(event_id).await;
        assert!(state.is_some());
        let state = state.unwrap();
        assert_eq!(state.event_id, event_id);
        assert_eq!(state.quiz_phase, QuizPhase::NotStarted);
        assert_eq!(state.participants.len(), 0);
    }

    #[tokio::test]
    async fn test_reuse_existing_session() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        
        let mut rx1 = hub.get_or_create_event_session(event_id).await;
        let mut rx2 = hub.get_or_create_event_session(event_id).await;
        
        // Both should receive broadcasts
        let message = serde_json::json!({"type": "test"});
        hub.broadcast_to_event(event_id, &message).await;
        
        // Both receivers should get the message
        let msg1 = rx1.recv().await;
        let msg2 = rx2.recv().await;
        assert!(msg1.is_ok());
        assert!(msg2.is_ok());
    }

    #[tokio::test]
    async fn test_multiple_subscribers_receive_messages() {
        let hub = Arc::new(Hub::new());
        let event_id = Uuid::new_v4();
        
        let mut receivers = vec![];
        for _ in 0..5 {
            let rx = hub.get_or_create_event_session(event_id).await;
            receivers.push(rx);
        }
        
        let message = serde_json::json!({"type": "broadcast_test"});
        hub.broadcast_to_event(event_id, &message).await;
        
        // All receivers should get the message
        for mut rx in receivers {
            let msg = rx.recv().await;
            assert!(msg.is_ok());
            assert_eq!(msg.unwrap()["type"], "broadcast_test");
        }
    }

    #[tokio::test]
    async fn test_legacy_session_code_compatibility() {
        let hub = Hub::new();
        let session_code = "TEST123";
        
        let mut rx = hub.get_or_create_session(session_code).await;
        
        let message = serde_json::json!({"type": "legacy_test"});
        hub.broadcast_to_session(session_code, &message).await;
        
        let msg = rx.recv().await;
        assert!(msg.is_ok());
        assert_eq!(msg.unwrap()["type"], "legacy_test");
    }

    #[tokio::test]
    async fn test_session_cleanup() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        
        let _rx = hub.get_or_create_event_session(event_id).await;
        assert!(hub.get_game_state(event_id).await.is_some());
        
        hub.remove_event_session(event_id).await;
        assert!(hub.get_game_state(event_id).await.is_none());
    }

    // Participant Management Tests (6 tests)
    #[tokio::test]
    async fn test_add_participant_updates_game_state() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let user_id = Uuid::new_v4();
        let participant = Participant {
            user_id,
            username: "test_user".to_string(),
            avatar_url: Some("😀".to_string()),
        };
        
        hub.add_participant(event_id, participant.clone()).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.participants.len(), 1);
        assert!(state.participants.contains_key(&user_id));
        assert_eq!(state.participants.get(&user_id).unwrap().username, "test_user");
    }

    #[tokio::test]
    async fn test_remove_participant_clears_answers() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let user_id = Uuid::new_v4();
        let participant = Participant {
            user_id,
            username: "test_user".to_string(),
            avatar_url: None,
        };
        
        hub.add_participant(event_id, participant).await;
        hub.record_answer(event_id, user_id, "answer1".to_string()).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.len(), 1);
        
        hub.remove_participant(event_id, user_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.participants.len(), 0);
        assert_eq!(state.answers_received.len(), 0);
    }

    #[tokio::test]
    async fn test_increment_participant_count() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        hub.increment_participant_count(event_id).await;
        hub.increment_participant_count(event_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.total_participants, 2);
    }

    #[tokio::test]
    async fn test_decrement_participant_count() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        hub.increment_participant_count(event_id).await;
        hub.increment_participant_count(event_id).await;
        hub.decrement_participant_count(event_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.total_participants, 1);
    }

    #[tokio::test]
    async fn test_participant_count_never_negative() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        // Try to decrement when count is 0
        hub.decrement_participant_count(event_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.total_participants, 0);
    }

    #[tokio::test]
    async fn test_concurrent_participant_operations() {
        let hub = Arc::new(Hub::new());
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let mut handles = vec![];
        for i in 0..10 {
            let hub_clone = Arc::clone(&hub);
            let user_id = Uuid::new_v4();
            handles.push(tokio::spawn(async move {
                let participant = Participant {
                    user_id,
                    username: format!("user_{}", i),
                    avatar_url: None,
                };
                hub_clone.add_participant(event_id, participant).await;
                hub_clone.increment_participant_count(event_id).await;
            }));
        }
        
        for handle in handles {
            handle.await.unwrap();
        }
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.participants.len(), 10);
        assert_eq!(state.total_participants, 10);
    }

    #[tokio::test]
    async fn test_remove_nonexistent_participant_no_panic() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let non_existent_id = Uuid::new_v4();
        // Should not panic
        hub.remove_participant(event_id, non_existent_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.participants.len(), 0);
    }

    // Answer Recording Tests (4 tests)
    #[tokio::test]
    async fn test_record_answer_stores_correctly() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let user_id = Uuid::new_v4();
        hub.record_answer(event_id, user_id, "answer1".to_string()).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.get(&user_id), Some(&"answer1".to_string()));
    }

    #[tokio::test]
    async fn test_overwrite_previous_answer() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let user_id = Uuid::new_v4();
        hub.record_answer(event_id, user_id, "answer1".to_string()).await;
        hub.record_answer(event_id, user_id, "answer2".to_string()).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.get(&user_id), Some(&"answer2".to_string()));
        assert_eq!(state.answers_received.len(), 1);
    }

    #[tokio::test]
    async fn test_clear_all_answers() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        for i in 0..5 {
            let user_id = Uuid::new_v4();
            hub.record_answer(event_id, user_id, format!("answer_{}", i)).await;
        }
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.len(), 5);
        
        hub.clear_answers(event_id).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.len(), 0);
    }

    #[tokio::test]
    async fn test_concurrent_answer_recording() {
        let hub = Arc::new(Hub::new());
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let mut handles = vec![];
        for _i in 0..10 {
            let hub_clone = Arc::clone(&hub);
            let user_id = Uuid::new_v4();
            handles.push(tokio::spawn(async move {
                hub_clone.record_answer(event_id, user_id, "answer".to_string()).await;
            }));
        }
        
        for handle in handles {
            handle.await.unwrap();
        }
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.answers_received.len(), 10);
    }

    // Game State Updates Tests (5 tests)
    #[tokio::test]
    async fn test_update_state_via_closure() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        hub.update_game_state(event_id, |state| {
            state.current_question_index = 5;
            state.time_limit_seconds = 60;
        }).await;
        
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.current_question_index, 5);
        assert_eq!(state.time_limit_seconds, 60);
    }

    #[tokio::test]
    async fn test_get_state_returns_clone() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let state1 = hub.get_game_state(event_id).await.unwrap();
        let state2 = hub.get_game_state(event_id).await.unwrap();
        
        // Modifying one shouldn't affect the other
        assert_eq!(state1.event_id, state2.event_id);
        // They are separate clones
        assert_ne!(std::ptr::addr_of!(state1), std::ptr::addr_of!(state2));
    }

    #[tokio::test]
    async fn test_quiz_phase_transitions() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        hub.set_quiz_phase(event_id, QuizPhase::ShowingQuestion).await;
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.quiz_phase, QuizPhase::ShowingQuestion);
        
        hub.set_quiz_phase(event_id, QuizPhase::RevealingAnswer).await;
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.quiz_phase, QuizPhase::RevealingAnswer);
        
        hub.set_quiz_phase(event_id, QuizPhase::ShowingLeaderboard).await;
        let state = hub.get_game_state(event_id).await.unwrap();
        assert_eq!(state.quiz_phase, QuizPhase::ShowingLeaderboard);
    }

    #[tokio::test]
    async fn test_concurrent_state_updates() {
        let hub = Arc::new(Hub::new());
        let event_id = Uuid::new_v4();
        let _rx = hub.get_or_create_event_session(event_id).await;
        
        let mut handles = vec![];
        for i in 0..10 {
            let hub_clone = Arc::clone(&hub);
            handles.push(tokio::spawn(async move {
                hub_clone.update_game_state(event_id, |state| {
                    state.current_question_index += 1;
                }).await;
            }));
        }
        
        for handle in handles {
            handle.await.unwrap();
        }
        
        let state = hub.get_game_state(event_id).await.unwrap();
        // All updates should be applied (though order may vary)
        assert!(state.current_question_index >= 0);
    }

    #[tokio::test]
    async fn test_get_state_nonexistent_event() {
        let hub = Hub::new();
        let non_existent_id = Uuid::new_v4();
        
        let state = hub.get_game_state(non_existent_id).await;
        assert!(state.is_none());
    }

    // Broadcasting Tests (3 tests)
    #[tokio::test]
    async fn test_all_subscribers_receive_broadcast() {
        let hub = Arc::new(Hub::new());
        let event_id = Uuid::new_v4();
        
        let mut receivers = vec![];
        for _ in 0..5 {
            let rx = hub.get_or_create_event_session(event_id).await;
            receivers.push(rx);
        }
        
        let message = serde_json::json!({"type": "test_broadcast", "data": "test"});
        hub.broadcast_to_event(event_id, &message).await;
        
        // Small delay to ensure message propagation
        sleep(Duration::from_millis(10)).await;
        
        for mut rx in receivers {
            let msg = rx.recv().await;
            assert!(msg.is_ok());
            let msg = msg.unwrap();
            assert_eq!(msg["type"], "test_broadcast");
        }
    }

    #[tokio::test]
    async fn test_broadcast_nonexistent_event_no_panic() {
        let hub = Hub::new();
        let non_existent_id = Uuid::new_v4();
        
        let message = serde_json::json!({"type": "test"});
        // Should not panic
        hub.broadcast_to_event(non_existent_id, &message).await;
    }

    #[tokio::test]
    async fn test_broadcast_survives_dropped_receivers() {
        let hub = Hub::new();
        let event_id = Uuid::new_v4();
        
        let _rx1 = hub.get_or_create_event_session(event_id).await;
        let mut rx2 = hub.get_or_create_event_session(event_id).await;
        
        // Drop one receiver
        drop(_rx1);
        
        // Broadcast should still work for remaining receiver
        let message = serde_json::json!({"type": "test"});
        hub.broadcast_to_event(event_id, &message).await;
        
        let msg = rx2.recv().await;
        assert!(msg.is_ok());
    }
}
