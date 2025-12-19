# TICKET-013: Network Loss Resilience - Disconnect Tracking

**Priority:** 🟡 HIGH
**Effort:** 1.5-2 hours
**Status:** Pending

---

## Description

Add infrastructure to track participant disconnections and mark them as temporarily offline rather than permanently removed.

## Files to Modify

### 1. `backend/src/ws/hub.rs`

Update participant tracking:

```rust
use std::time::{SystemTime, UNIX_EPOCH};

#[derive(Debug, Clone)]
pub enum ParticipantState {
    Connected,
    TemporarilyDisconnected { disconnected_at: SystemTime },
    PermanentlyLeft,
}

#[derive(Debug, Clone)]
pub struct ConnectedParticipant {
    pub user_id: String,
    pub device_id: String,
    pub session_token: String,
    pub event_id: String,
    pub state: ParticipantState,
    pub last_heartbeat: SystemTime,
}

pub struct Hub {
    // ... existing fields ...
    participants: Arc<DashMap<String, ConnectedParticipant>>, // key: "{event_id}:{device_id}"
    disconnection_grace_period_secs: u64,
}

impl Hub {
    pub fn new() -> Self {
        Self {
            // ... existing initialization ...
            participants: Arc::new(DashMap::new()),
            disconnection_grace_period_secs: 30, // 30 second grace period
        }
    }

    pub fn add_participant(
        &self,
        event_id: &str,
        device_id: &str,
        session_token: String,
        user_id: String,
    ) {
        let key = format!("{}:{}", event_id, device_id);
        self.participants.insert(
            key,
            ConnectedParticipant {
                user_id,
                device_id: device_id.to_string(),
                session_token,
                event_id: event_id.to_string(),
                state: ParticipantState::Connected,
                last_heartbeat: SystemTime::now(),
            },
        );
    }

    pub fn mark_disconnected(&self, event_id: &str, device_id: &str) {
        let key = format!("{}:{}", event_id, device_id);
        if let Some(mut participant) = self.participants.get_mut(&key) {
            participant.state = ParticipantState::TemporarilyDisconnected {
                disconnected_at: SystemTime::now(),
            };
        }
    }

    pub fn update_heartbeat(&self, event_id: &str, device_id: &str) {
        let key = format!("{}:{}", event_id, device_id);
        if let Some(mut participant) = self.participants.get_mut(&key) {
            participant.last_heartbeat = SystemTime::now();
            participant.state = ParticipantState::Connected;
        }
    }

    pub fn get_participant(
        &self,
        event_id: &str,
        device_id: &str,
    ) -> Option<ConnectedParticipant> {
        let key = format!("{}:{}", event_id, device_id);
        self.participants.get(&key).map(|r| r.clone())
    }

    pub fn is_grace_period_expired(
        &self,
        event_id: &str,
        device_id: &str,
    ) -> bool {
        let key = format!("{}:{}", event_id, device_id);
        if let Some(participant) = self.participants.get(&key) {
            match participant.state {
                ParticipantState::TemporarilyDisconnected { disconnected_at } => {
                    let elapsed = disconnected_at
                        .elapsed()
                        .unwrap_or(std::time::Duration::from_secs(u64::MAX));
                    elapsed.as_secs() > self.disconnection_grace_period_secs
                }
                _ => false,
            }
        } else {
            false
        }
    }

    pub fn remove_expired_participants(&self, event_id: &str) {
        let prefix = format!("{}:", event_id);
        let keys_to_remove: Vec<String> = self
            .participants
            .iter()
            .filter(|ref_multi| ref_multi.key().starts_with(&prefix))
            .filter(|ref_multi| self.is_grace_period_expired(event_id, &ref_multi.device_id))
            .map(|ref_multi| ref_multi.key().clone())
            .collect();

        for key in keys_to_remove {
            self.participants.remove(&key);
        }
    }
}
```

### 2. `backend/src/ws/handler.rs`

Update WebSocket connection handler:

```rust
// When WebSocket connects
async fn on_ws_connect(
    mut socket: WebSocket,
    State(state): State<AppState>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<impl IntoResponse, AppError> {
    let device_id = query.get("device_id").ok_or(AppError::BadRequest("Missing device_id"))?;
    let session_token = query.get("session_token").ok_or(AppError::BadRequest("Missing session_token"))?;
    let event_id = query.get("event_id").ok_or(AppError::BadRequest("Missing event_id"))?;

    // Check if this is a reconnect
    if let Some(participant) = state.hub.get_participant(event_id, device_id) {
        // Reconnecting participant - restore state
        state.hub.update_heartbeat(event_id, device_id);

        // Send reconnection message
        socket.send(
            serde_json::to_string(&ServerMessage::ParticipantReconnected {
                device_id: device_id.to_string(),
                user_id: participant.user_id.clone(),
            })?
            .into(),
        ).await?;

        // Broadcast to others that participant reconnected
        state.hub.broadcast(
            event_id,
            ServerMessage::ParticipantReconnected {
                device_id: device_id.to_string(),
                user_id: participant.user_id.clone(),
            },
        );
    } else {
        // New participant - add to tracking
        state.hub.add_participant(event_id, device_id, session_token.clone(), user_id.clone());
    }

    // ... rest of connection handling
}

// When WebSocket disconnects
async fn on_ws_disconnect(
    State(state): State<AppState>,
    event_id: String,
    device_id: String,
) {
    // Mark as temporarily disconnected (don't remove yet)
    state.hub.mark_disconnected(&event_id, &device_id);

    // Broadcast temporary disconnection
    state.hub.broadcast(
        &event_id,
        ServerMessage::ParticipantTemporarilyDisconnected {
            device_id: device_id.clone(),
        },
    );

    // Schedule grace period cleanup
    let hub = state.hub.clone();
    let event_id_clone = event_id.clone();
    tokio::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_secs(35)).await;
        hub.remove_expired_participants(&event_id_clone);

        // Broadcast permanent removal
        hub.broadcast(
            &event_id_clone,
            ServerMessage::ParticipantLeft {
                device_id: device_id.clone(),
            },
        );
    });
}
```

### 3. `backend/src/ws/messages.rs`

Add new message types:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing variants ...

    #[serde(rename = "participant_reconnected")]
    ParticipantReconnected {
        device_id: String,
        user_id: String,
    },

    #[serde(rename = "participant_temporarily_disconnected")]
    ParticipantTemporarilyDisconnected {
        device_id: String,
    },

    #[serde(rename = "heartbeat_ack")]
    HeartbeatAck,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameMessage {
    // ... existing variants ...

    #[serde(rename = "heartbeat")]
    Heartbeat,
}
```

## Acceptance Criteria

- [ ] ParticipantState enum created with Connected/TemporarilyDisconnected/PermanentlyLeft variants
- [ ] ConnectedParticipant struct tracks all required state
- [ ] Disconnection grace period implemented (30 seconds)
- [ ] Heartbeat messages tracked and updated
- [ ] Reconnecting participants restore existing state
- [ ] ParticipantReconnected message broadcast
- [ ] ParticipantTemporarilyDisconnected message sent
- [ ] Expired participants cleaned up after grace period
- [ ] No compiler errors or warnings
- [ ] Unit tests for grace period logic

## Testing

```bash
cd backend
cargo test disconnect_tracking
cargo test grace_period_expiration
```

## Dependencies

- TICKET-001: Device session identity (provides device_id tracking)

## Related Tickets

- TICKET-014: Grace period logic
- TICKET-015: Reconnect restoration

## Notes

- 30-second grace period is hardcoded but can be made configurable
- Heartbeat should be sent every 10 seconds from client
- Cleanup happens asynchronously without blocking main thread
- Disconnection tracking is per device_id + event_id combination
