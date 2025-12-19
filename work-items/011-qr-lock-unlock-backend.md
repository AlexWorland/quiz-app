# TICKET-011: QR Lock/Unlock Controls - Backend Handlers

**Priority:** 🟡 HIGH
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-010

---

## Description

Implement WebSocket handlers for locking/unlocking QR code joining and validation in join endpoint.

## Files to Modify

### 1. `backend/src/ws/messages.rs`

Add new message types:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameMessage {
    // ... existing variants ...

    #[serde(rename = "lock_qr")]
    LockQR,

    #[serde(rename = "unlock_qr")]
    UnlockQR,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing variants ...

    #[serde(rename = "qr_locked")]
    QRLocked {
        locked: bool,
        locked_at: DateTime<Utc>,
        locked_by: String, // username
    },
}
```

### 2. `backend/src/ws/handler.rs`

Add handlers:

```rust
GameMessage::LockQR => {
    handle_lock_qr(&state, &hub, &auth_user, &event_id, db).await?
}

GameMessage::UnlockQR => {
    handle_unlock_qr(&state, &hub, &auth_user, &event_id, db).await?
}

// Add at end of file
async fn handle_lock_qr(
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

    // Check if already locked
    if event.qr_locked {
        return Ok(()); // Already locked, do nothing
    }

    // Lock QR code
    sqlx::query(
        "UPDATE events SET qr_locked = true, qr_locked_at = NOW(), qr_locked_by = $1
         WHERE id = $2"
    )
    .bind(&auth_user.id)
    .bind(event_id)
    .execute(db)
    .await?;

    // Broadcast to all clients
    hub.broadcast(
        event_id,
        ServerMessage::QRLocked {
            locked: true,
            locked_at: Utc::now(),
            locked_by: auth_user.username.clone(),
        },
    );

    Ok(())
}

async fn handle_unlock_qr(
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

    // Check if already unlocked
    if !event.qr_locked {
        return Ok(()); // Already unlocked, do nothing
    }

    // Unlock QR code
    sqlx::query(
        "UPDATE events SET qr_locked = false, qr_locked_at = NOW(), qr_locked_by = $1
         WHERE id = $2"
    )
    .bind(&auth_user.id)
    .bind(event_id)
    .execute(db)
    .await?;

    // Broadcast to all clients
    hub.broadcast(
        event_id,
        ServerMessage::QRLocked {
            locked: false,
            locked_at: Utc::now(),
            locked_by: auth_user.username.clone(),
        },
    );

    Ok(())
}
```

### 3. `backend/src/routes/quiz.rs`

Update `join_event` endpoint:

```rust
pub async fn join_event(
    State(state): State<AppState>,
    Json(payload): Json<JoinEventRequest>,
    headers: HeaderMap,
) -> Result<Json<JoinEventResponse>, AppError> {
    // Get event by code
    let event = get_event_by_code(&state.db, &payload.code).await?;

    // CHECK: Verify QR is not locked
    if event.qr_locked {
        return Err(AppError::Conflict(
            "QR joining is temporarily locked. Please try again later.".to_string()
        ));
    }

    // ... rest of join logic (from TICKET-002)
}
```

## Acceptance Criteria

- [ ] `LockQR` and `UnlockQR` message types added
- [ ] `QRLocked` response message type added
- [ ] Handler validates host permission only
- [ ] Handler checks QR locked status before join
- [ ] Returns 409 Conflict when trying to join locked QR
- [ ] Lock/unlock broadcasts to all clients
- [ ] Idempotent (locking when already locked is safe)
- [ ] Database updates correctly
- [ ] No compiler errors or warnings
- [ ] Unit tests for permission checks

## Testing

```bash
cd backend
cargo test lock_qr
cargo test join_locked_qr
```

## Dependencies

- TICKET-010: Database schema

## Related Tickets

- TICKET-010: Database schema
- TICKET-012: Frontend UI

## Notes

- Host-only permission ensures only event organizer can lock/unlock
- Broadcasting ensures all participants see status change immediately
- Returning same message for lock/unlock simplifies frontend handling
