# TICKET-002: Device/Session Identity - Backend Handlers

**Priority:** 🔴 CRITICAL
**Effort:** 2-3 hours
**Status:** Pending
**Depends On:** TICKET-001

---

## Description

Implement backend logic to generate device IDs, manage session tokens, and enforce duplicate device prevention during event joining.

## Files to Modify

### 1. `backend/src/models/event.rs`

Update `EventParticipant` model:
```rust
pub struct EventParticipant {
    pub event_id: String,
    pub user_id: String,
    pub total_score: i32,
    pub joined_at: DateTime<Utc>,
    pub device_id: String,           // NEW
    pub session_token: String,       // NEW
    pub join_timestamp: DateTime<Utc>, // NEW
    pub last_heartbeat: DateTime<Utc>, // NEW
}
```

### 2. `backend/src/services/device.rs` (NEW FILE)

Create device fingerprinting service:
```rust
use sha2::{Sha256, Digest};
use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct DeviceInfo {
    pub user_agent: String,
    pub accept_language: String,
}

pub fn generate_device_fingerprint(device_info: &DeviceInfo) -> String {
    let input = format!(
        "{}|{}",
        device_info.user_agent,
        device_info.accept_language
    );
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

pub fn generate_session_token() -> String {
    use uuid::Uuid;
    Uuid::new_v4().to_string()
}
```

### 3. `backend/src/routes/quiz.rs`

Update `join_event` handler (around line 17):

```rust
use crate::services::device::{generate_device_fingerprint, generate_session_token};

#[derive(Deserialize)]
pub struct JoinEventRequest {
    pub code: String,
    pub device_fingerprint: String,
}

pub async fn join_event(
    State(state): State<AppState>,
    Json(payload): Json<JoinEventRequest>,
    headers: HeaderMap,
) -> Result<Json<JoinEventResponse>, AppError> {
    // Get event by code
    let event = get_event_by_code(&state.db, &payload.code).await?;

    // Get current user from auth middleware
    let auth_user = extract_user_from_request(&headers)?;

    // Check if this device already joined this event
    let existing = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS(SELECT 1 FROM event_participants
         WHERE event_id = $1 AND device_id = $2)"
    )
    .bind(&event.id)
    .bind(&payload.device_fingerprint)
    .fetch_one(&state.db)
    .await?;

    if existing.0 {
        return Err(AppError::Conflict(
            "This device has already joined this event".to_string()
        ));
    }

    // Generate session token
    let session_token = generate_session_token();

    // Add participant
    sqlx::query(
        "INSERT INTO event_participants
         (event_id, user_id, device_id, session_token, total_score, joined_at)
         VALUES ($1, $2, $3, $4, 0, NOW())"
    )
    .bind(&event.id)
    .bind(&auth_user.id)
    .bind(&payload.device_fingerprint)
    .bind(&session_token)
    .execute(&state.db)
    .await?;

    Ok(Json(JoinEventResponse {
        event_id: event.id,
        device_id: payload.device_fingerprint,
        session_token,
        status: "joined".to_string(),
    }))
}

#[derive(Serialize)]
pub struct JoinEventResponse {
    pub event_id: String,
    pub device_id: String,
    pub session_token: String,
    pub status: String,
}
```

### 4. `backend/src/ws/handler.rs`

Update WebSocket connection handler:

```rust
// In the connect handler, validate device_id and session_token
async fn handle_ws_connect(
    hub: &Hub,
    auth_user: &User,
    event_id: &str,
    device_id: &str,
    session_token: &str,
    db: &PgPool,
) -> Result<(), AppError> {
    // Verify device_id belongs to this user in this event
    let valid = sqlx::query_as::<_, (bool,)>(
        "SELECT EXISTS(SELECT 1 FROM event_participants
         WHERE event_id = $1 AND user_id = $2 AND device_id = $3 AND session_token = $4)"
    )
    .bind(event_id)
    .bind(&auth_user.id)
    .bind(device_id)
    .bind(session_token)
    .fetch_one(db)
    .await?;

    if !valid.0 {
        return Err(AppError::Unauthorized("Invalid device credentials".to_string()));
    }

    Ok(())
}
```

### 5. `backend/src/main.rs`

Add device service module:
```rust
mod services {
    pub mod device;
    // ... other services
}
```

## Acceptance Criteria

- [ ] `EventParticipant` model updated with new fields
- [ ] Device service created with fingerprint and token generation
- [ ] `join_event` handler prevents duplicate device joins
- [ ] `join_event` returns device_id and session_token in response
- [ ] WebSocket connection validates device credentials
- [ ] Returns 409 Conflict for duplicate device joins
- [ ] Returns 401 Unauthorized for invalid device credentials
- [ ] Code compiles without warnings
- [ ] Unit tests for device fingerprint generation

## Testing

```bash
cd backend

# Run tests
cargo test test_device_fingerprint
cargo test test_join_event_duplicate_device
```

## Dependencies

- TICKET-001: Database migrations must be run first
- TICKET-003: Frontend needs to send device_fingerprint

## Related Tickets

- TICKET-001: Device/Session Identity - Database Migrations
- TICKET-003: Device/Session Identity - Frontend Join Flow
- TICKET-013: Network Loss Resilience - will use device_id for reconnection

## Notes

- Device fingerprint is hash of User-Agent + Accept-Language header
- Session token is a UUID that persists for the duration of the session
- Multiple users on same device (e.g., shared device) will have same device_fingerprint but different user_id (counted as separate participants)
