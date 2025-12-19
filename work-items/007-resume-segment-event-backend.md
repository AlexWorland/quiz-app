# TICKET-007: Resume Segment/Event - Backend Handlers

**Priority:** 🔴 CRITICAL
**Effort:** 2-2.5 hours
**Status:** Pending
**Depends On:** TICKET-006

---

## Description

Implement WebSocket message handlers for ResumeSegment and ResumeEvent. Includes state validation, permission checks, and broadcasting.

## Files to Modify

### 1. `backend/src/ws/messages.rs`

Add new message variants:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameMessage {
    // ... existing variants ...

    #[serde(rename = "resume_segment")]
    ResumeSegment,

    #[serde(rename = "resume_event")]
    ResumeEvent,

    #[serde(rename = "clear_resume_state")]
    ClearResumeState,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing variants ...

    #[serde(rename = "segment_resumed")]
    SegmentResumed {
        segment_id: String,
        status: String,
    },

    #[serde(rename = "event_resumed")]
    EventResumed {
        event_id: String,
        status: String,
    },

    #[serde(rename = "resume_state_cleared")]
    ResumeStateCleared {
        id: String,
        resumed_type: String, // "segment" or "event"
    },

    #[serde(rename = "resume_not_available")]
    ResumeNotAvailable {
        reason: String,
    },
}
```

### 2. `backend/src/ws/handler.rs`

Add handlers in the main match statement:

```rust
GameMessage::ResumeSegment => {
    handle_resume_segment(&state, &hub, &auth_user, &event_id, db).await?
}

GameMessage::ResumeEvent => {
    handle_resume_event(&state, &hub, &auth_user, &event_id, db).await?
}

GameMessage::ClearResumeState => {
    handle_clear_resume_state(&state, &hub, &auth_user, &event_id, db).await?
}
```

Add handler functions at end of file:

```rust
async fn handle_resume_segment(
    state: &AppState,
    hub: &Hub,
    auth_user: &User,
    event_id: &str,
    db: &PgPool,
) -> Result<(), AppError> {
    // Get current event
    let event = get_event_by_id(db, event_id).await?;

    // Check if user is host or current presenter
    if auth_user.id != event.host_id {
        let segment = sqlx::query_as::<_, Segment>(
            "SELECT * FROM segments WHERE event_id = $1 AND presenter_user_id = $2"
        )
        .bind(event_id)
        .bind(&auth_user.id)
        .fetch_optional(db)
        .await?;

        if segment.is_none() {
            return Err(AppError::Forbidden);
        }
    }

    // Get current segment (should be in ended state)
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE event_id = $1 ORDER BY created_at DESC LIMIT 1"
    )
    .bind(event_id)
    .fetch_one(db)
    .await?;

    // Check if segment can be resumed
    if segment.previous_status.is_none() {
        return Ok(hub.broadcast(
            event_id,
            ServerMessage::ResumeNotAvailable {
                reason: "Segment cannot be resumed".to_string(),
            },
        ));
    }

    let previous_status = segment.previous_status.unwrap();

    // Check if resume state expired (30 minutes)
    if let Some(was_ended_at) = segment.was_ended_at {
        let elapsed = chrono::Utc::now().signed_duration_since(was_ended_at);
        if elapsed.num_minutes() > 30 {
            return Ok(hub.broadcast(
                event_id,
                ServerMessage::ResumeNotAvailable {
                    reason: "Resume state expired. Please start a new segment.".to_string(),
                },
            ));
        }
    }

    // Restore segment status
    sqlx::query(
        "UPDATE segments SET status = $1, previous_status = NULL, was_ended_at = NULL
         WHERE id = $2"
    )
    .bind(&previous_status)
    .bind(&segment.id)
    .execute(db)
    .await?;

    // Clear resume state in hub (reset quiz state)
    hub.reset_segment_state(event_id);

    // Broadcast segment resumed
    hub.broadcast(
        event_id,
        ServerMessage::SegmentResumed {
            segment_id: segment.id,
            status: previous_status.clone(),
        },
    );

    Ok(())
}

async fn handle_resume_event(
    state: &AppState,
    hub: &Hub,
    auth_user: &User,
    event_id: &str,
    db: &PgPool,
) -> Result<(), AppError> {
    // Get event
    let event = get_event_by_id(db, event_id).await?;

    // Check if user is host only
    if auth_user.id != event.host_id {
        return Err(AppError::Forbidden);
    }

    // Check if event can be resumed
    if event.previous_status.is_none() {
        return Ok(hub.broadcast(
            event_id,
            ServerMessage::ResumeNotAvailable {
                reason: "Event cannot be resumed".to_string(),
            },
        ));
    }

    let previous_status = event.previous_status.unwrap();

    // Check if resume state expired (30 minutes)
    if let Some(was_ended_at) = event.was_ended_at {
        let elapsed = chrono::Utc::now().signed_duration_since(was_ended_at);
        if elapsed.num_minutes() > 30 {
            return Ok(hub.broadcast(
                event_id,
                ServerMessage::ResumeNotAvailable {
                    reason: "Resume state expired. Please start a new event.".to_string(),
                },
            ));
        }
    }

    // Restore event status
    sqlx::query(
        "UPDATE events SET status = $1, previous_status = NULL, was_ended_at = NULL
         WHERE id = $2"
    )
    .bind(&previous_status)
    .bind(event_id)
    .execute(db)
    .await?;

    // Clear resume state in hub
    hub.reset_event_state(event_id);

    // Broadcast event resumed
    hub.broadcast(
        event_id,
        ServerMessage::EventResumed {
            event_id: event_id.to_string(),
            status: previous_status.clone(),
        },
    );

    Ok(())
}

async fn handle_clear_resume_state(
    state: &AppState,
    hub: &Hub,
    auth_user: &User,
    event_id: &str,
    db: &PgPool,
) -> Result<(), AppError> {
    // Get event
    let event = get_event_by_id(db, event_id).await?;

    // Check if user is host
    if auth_user.id != event.host_id {
        return Err(AppError::Forbidden);
    }

    // Clear segment resume state (if exists)
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE event_id = $1
         AND previous_status IS NOT NULL
         ORDER BY created_at DESC LIMIT 1"
    )
    .bind(event_id)
    .fetch_optional(db)
    .await?;

    if let Some(seg) = segment {
        sqlx::query(
            "UPDATE segments SET previous_status = NULL, was_ended_at = NULL
             WHERE id = $1"
        )
        .bind(&seg.id)
        .execute(db)
        .await?;

        hub.broadcast(
            event_id,
            ServerMessage::ResumeStateCleared {
                id: seg.id,
                resumed_type: "segment".to_string(),
            },
        );
    } else {
        // Clear event resume state
        sqlx::query(
            "UPDATE events SET previous_status = NULL, was_ended_at = NULL
             WHERE id = $1"
        )
        .bind(event_id)
        .execute(db)
        .await?;

        hub.broadcast(
            event_id,
            ServerMessage::ResumeStateCleared {
                id: event_id.to_string(),
                resumed_type: "event".to_string(),
            },
        );
    }

    Ok(())
}
```

### 3. `backend/src/ws/hub.rs`

Add helper methods to Hub:

```rust
impl Hub {
    // ... existing methods ...

    pub fn reset_segment_state(&self, event_id: &str) {
        if let Some(mut state) = self.game_states.get_mut(event_id) {
            // Reset current question index
            state.current_question = 0;
            // Reset answer submissions
            state.answers.clear();
            // Reset phase
            state.phase = QuizPhase::NotStarted;
        }
    }

    pub fn reset_event_state(&self, event_id: &str) {
        if let Some(mut state) = self.game_states.get_mut(event_id) {
            // Reset entire event state
            state.current_question = 0;
            state.answers.clear();
            state.phase = QuizPhase::NotStarted;
            state.current_segment_id = None;
        }
    }
}
```

### 4. Update `backend/src/ws/handler.rs` - Modify end handlers

When ending a segment or event, save the current state:

```rust
// In handle_end_game or segment end handler
let current_status = segment.status.clone();

sqlx::query(
    "UPDATE segments SET previous_status = $1, was_ended_at = NOW(), status = 'completed'
     WHERE id = $2"
)
.bind(&current_status)
.bind(&segment.id)
.execute(db)
.await?;
```

## Acceptance Criteria

- [ ] `ResumeSegment`, `ResumeEvent`, `ClearResumeState` message types added
- [ ] `SegmentResumed`, `EventResumed`, `ResumeStateCleared`, `ResumeNotAvailable` response types added
- [ ] Handler validates host/presenter permissions
- [ ] Handler checks resume state exists
- [ ] Handler checks 30-minute expiration
- [ ] Previous status restored correctly
- [ ] State cleared after resume
- [ ] Messages broadcast to all clients
- [ ] Hub state reset methods work
- [ ] No compiler errors or warnings
- [ ] Unit tests for permission checks
- [ ] Unit tests for expiration logic

## Testing

```bash
cd backend
cargo test resume_segment
cargo test resume_event
cargo test resume_expiration
```

## Dependencies

- TICKET-006: Database schema

## Related Tickets

- TICKET-006: Database tracking
- TICKET-008: Frontend modals (depends on these handlers)

## Notes

- 30-minute expiration can be made configurable
- Can add audit logging for resume events (who/when)
- Consider sending current quiz state to all clients after resume
