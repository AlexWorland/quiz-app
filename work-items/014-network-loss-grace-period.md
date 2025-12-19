# TICKET-014: Network Loss Resilience - Grace Period Logic

**Priority:** 🟡 HIGH
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-013

---

## Description

Implement automatic cleanup of expired disconnected participants and participant status transitions based on connection state.

## Files to Modify

### 1. `backend/src/ws/hub.rs`

Add background cleanup task and status management:

```rust
use tokio::task::JoinHandle;
use std::sync::Arc;

pub struct Hub {
    // ... existing fields ...
    cleanup_task: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl Hub {
    pub fn new() -> Self {
        let hub = Self {
            // ... existing fields ...
            cleanup_task: Arc::new(Mutex::new(None)),
        };

        // Start cleanup background task
        hub.start_cleanup_task();
        hub
    }

    fn start_cleanup_task(&self) {
        let participants = Arc::clone(&self.participants);
        let game_states = Arc::clone(&self.game_states);

        let task = tokio::spawn(async move {
            let mut interval = tokio::time::interval(
                std::time::Duration::from_secs(5) // Check every 5 seconds
            );

            loop {
                interval.tick().await;

                // Get all event IDs
                let event_ids: Vec<String> = participants
                    .iter()
                    .map(|entry| {
                        let key = entry.key();
                        key.split(':').next().unwrap_or("").to_string()
                    })
                    .collect::<std::collections::HashSet<_>>()
                    .into_iter()
                    .collect();

                // Check each event for expired participants
                for event_id in event_ids {
                    let prefix = format!("{}:", event_id);
                    let expired_keys: Vec<String> = participants
                        .iter()
                        .filter(|entry| entry.key().starts_with(&prefix))
                        .filter_map(|entry| {
                            match entry.value().state {
                                ParticipantState::TemporarilyDisconnected { disconnected_at } => {
                                    let elapsed = disconnected_at
                                        .elapsed()
                                        .unwrap_or(std::time::Duration::from_secs(u64::MAX));
                                    if elapsed.as_secs() > 30 {
                                        Some(entry.key().clone())
                                    } else {
                                        None
                                    }
                                }
                                _ => None,
                            }
                        })
                        .collect();

                    // Remove expired participants
                    for key in expired_keys {
                        participants.remove(&key);
                    }
                }
            }
        });

        // Store task handle (would need to update structure to hold it)
    }

    pub fn get_participant_status(
        &self,
        event_id: &str,
        device_id: &str,
    ) -> Option<ParticipantState> {
        let key = format!("{}:{}", event_id, device_id);
        self.participants.get(&key).map(|p| p.state.clone())
    }

    pub fn get_event_participants(
        &self,
        event_id: &str,
    ) -> Vec<(String, ConnectedParticipant)> {
        let prefix = format!("{}:", event_id);
        self.participants
            .iter()
            .filter(|entry| entry.key().starts_with(&prefix))
            .map(|entry| (entry.key().clone(), entry.value().clone()))
            .collect()
    }
}
```

### 2. `backend/src/ws/handler.rs`

Add periodic heartbeat validation:

```rust
// New handler for heartbeat messages from clients
GameMessage::Heartbeat => {
    handle_heartbeat(&state, &hub, &auth_user, &event_id, &device_id).await?
}

async fn handle_heartbeat(
    state: &AppState,
    hub: &Hub,
    auth_user: &User,
    event_id: &str,
    device_id: &str,
) -> Result<(), AppError> {
    // Update participant's last heartbeat
    hub.update_heartbeat(event_id, device_id);

    // Send acknowledgment
    // (WebSocket connection sends back: { "type": "heartbeat_ack" })

    Ok(())
}
```

### 3. `frontend/src/hooks/useEventWebSocket.ts`

Add heartbeat sending:

```typescript
export function useEventWebSocket(eventId: string) {
  // ... existing code ...

  useEffect(() => {
    if (!isConnected) return;

    // Send heartbeat every 10 seconds
    const heartbeatInterval = setInterval(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'heartbeat' }));
      }
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [isConnected]);

  // ... rest of hook
}
```

### 4. `frontend/src/pages/EventParticipant.tsx`

Display participant status:

```typescript
const [participantStatus, setParticipantStatus] = useState<
  'connected' | 'disconnected' | 'reconnecting'
>('connected');

useEffect(() => {
  const handleMessage = (message: any) => {
    if (message.type === 'participant_temporarily_disconnected') {
      setParticipantStatus('disconnected');
    } else if (message.type === 'participant_reconnected') {
      setParticipantStatus('connected');
    } else if (message.type === 'heartbeat_ack') {
      setParticipantStatus('connected');
    }
  };

  onMessage(handleMessage);
}, [onMessage]);

// JSX to show status
return (
  <div>
    {participantStatus === 'disconnected' && (
      <div className="bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-lg mb-4">
        <p className="text-yellow-300 text-sm">
          ⚠️ You are temporarily disconnected. Attempting to reconnect...
        </p>
      </div>
    )}
    {/* rest of component */}
  </div>
);
```

## Acceptance Criteria

- [ ] Background cleanup task runs every 5 seconds
- [ ] Expired participants (>30s disconnected) removed from hub
- [ ] Heartbeat message type defined
- [ ] Heartbeat acknowledgment sent
- [ ] Disconnection status tracked correctly
- [ ] Reconnection restores participant state
- [ ] Frontend sends heartbeat every 10 seconds
- [ ] Frontend displays disconnection warning
- [ ] Frontend auto-reconnects on disconnect
- [ ] No race conditions in cleanup logic
- [ ] No compiler errors or warnings

## Testing

```bash
cd backend
cargo test grace_period_cleanup
cargo test heartbeat_handling
```

## Dependencies

- TICKET-013: Disconnect tracking infrastructure

## Related Tickets

- TICKET-013: Disconnect tracking
- TICKET-015: Reconnect restoration

## Notes

- 30-second grace period is longer than typical network hiccup
- 10-second heartbeat interval balances accuracy vs. overhead
- 5-second cleanup check interval is reasonable
- Could add metrics to track disconnection frequency
