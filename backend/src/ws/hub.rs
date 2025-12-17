use serde_json::Value;
use std::collections::HashMap;
use tokio::sync::broadcast;

/// WebSocket connection hub for managing all active sessions
pub struct Hub {
    sessions: tokio::sync::RwLock<HashMap<String, broadcast::Sender<Value>>>,
}

impl Hub {
    /// Create a new hub
    pub fn new() -> Self {
        Self {
            sessions: tokio::sync::RwLock::new(HashMap::new()),
        }
    }

    /// Get or create a broadcast channel for a session
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

    /// Broadcast a message to all clients in a session
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
}

impl Default for Hub {
    fn default() -> Self {
        Self::new()
    }
}
