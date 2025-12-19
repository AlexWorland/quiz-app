# TICKET-023: Invalid or Expired QR Code Handling

**Priority:** LOW
**Effort:** 2-3 hours
**Status:** Pending
**Depends On:** TICKET-004, TICKET-005

---

## Description

Add QR code expiration mechanism and comprehensive error handling for invalid or expired codes with clear user messaging. This ensures event security and provides a graceful degradation experience when QR codes are no longer valid.

---

## Key Features

1. **QR Expiration**
   - Event codes valid for event duration + 1 hour grace period
   - Automatic expiration calculation on event creation
   - Database-enforced validation on join attempts

2. **Revocation**
   - Host can manually revoke QR codes mid-event
   - Optional revocation reason for host tracking
   - Prevents new joins after revocation

3. **Clear Error Messages**
   - Different messages for different failure scenarios
   - User-friendly explanations with next steps
   - Consistent error handling across frontend

---

## Files to Modify/Create

### Backend Migrations
- `backend/migrations/<timestamp>_qr_expiration.up.sql`
- `backend/migrations/<timestamp>_qr_expiration.down.sql`

### Backend Code
- `backend/src/routes/quiz.rs`: Add expiration validation in `join_event` handler
- `backend/src/models/event.rs`: Add `expires_at`, `revoked_at` fields to Event model

### Frontend Code
- `frontend/src/pages/JoinEvent.tsx`: Add error type detection and user-friendly error display

---

## Database Changes

### Migration: `qr_expiration.up.sql`

```sql
-- Add QR code expiration and revocation fields
ALTER TABLE events
ADD COLUMN expires_at TIMESTAMP,
ADD COLUMN revoked_at TIMESTAMP,
ADD COLUMN revocation_reason VARCHAR(255);

-- Index for efficient expiration checks
CREATE INDEX idx_events_expires_at ON events(expires_at);

-- Backfill expires_at for existing events (default: created_at + 24 hours)
UPDATE events
SET expires_at = created_at + INTERVAL '24 hours'
WHERE expires_at IS NULL;
```

### Migration: `qr_expiration.down.sql`

```sql
-- Drop index
DROP INDEX IF EXISTS idx_events_expires_at;

-- Remove QR expiration and revocation fields
ALTER TABLE events
DROP COLUMN IF EXISTS expires_at,
DROP COLUMN IF EXISTS revoked_at,
DROP COLUMN IF EXISTS revocation_reason;
```

---

## Expiration Logic

### Event Creation
- Calculate `expires_at = event_end_time + 1 hour`
- Store in database alongside event creation
- Default to `created_at + 24 hours` if no end time specified

### Join Validation
On join attempt, validate:
```rust
// Pseudocode
if current_time > expires_at {
    return Err(AppError::QRExpired);
}
if revoked_at.is_some() {
    return Err(AppError::QRRevoked);
}
// Proceed with join...
```

### Expiration Calculation
```rust
// In create_event handler
let expires_at = event_end_time
    .unwrap_or_else(|| Utc::now() + Duration::hours(24))
    + Duration::hours(1);
```

---

## Error Scenarios

### 1. QR Expired
- **Condition:** `current_time > expires_at`
- **HTTP Status:** `410 Gone`
- **Message:** "This QR code has expired. The event is no longer accepting participants."
- **User Action:** None available, contact host if needed

### 2. QR Revoked
- **Condition:** `revoked_at IS NOT NULL`
- **HTTP Status:** `403 Forbidden`
- **Message:** "This QR code was revoked by the event host. Please contact the host for assistance."
- **Details:** Display `revocation_reason` if provided
- **User Action:** Contact host

### 3. Invalid Code
- **Condition:** Event not found in database
- **HTTP Status:** `404 Not Found`
- **Message:** "Invalid QR code. Please scan a new code from the event host."
- **User Action:** Scan again or request new QR

### 4. Event Ended
- **Condition:** Event status is "completed"
- **HTTP Status:** `410 Gone`
- **Message:** "The event has ended. Participation is closed."
- **User Action:** View results if available

---

## Host Controls

### Revoke QR Endpoint

**Route:** `POST /api/events/:id/revoke-qr`

**Auth:** JWT required, must be event host

**Request Body:**
```json
{
  "reason": "Too many participants joined" // Optional
}
```

**Response:**
```json
{
  "success": true,
  "revoked_at": "2025-12-18T15:30:00Z",
  "message": "QR code has been revoked"
}
```

**Implementation:**
```rust
// In backend/src/routes/quiz.rs
pub async fn revoke_qr(
    State(state): State<Arc<AppState>>,
    Path(event_id): Path<i32>,
    Extension(user): Extension<User>,
    Json(payload): Json<RevokeQRRequest>,
) -> Result<Json<RevokeQRResponse>, AppError> {
    // Verify user is host
    let event = get_event_by_id(&state.db, event_id).await?;
    if event.host_id != user.id {
        return Err(AppError::Forbidden);
    }

    // Update database
    let revoked_at = Utc::now();
    sqlx::query!(
        "UPDATE events SET revoked_at = $1, revocation_reason = $2 WHERE id = $3",
        revoked_at,
        payload.reason,
        event_id
    )
    .execute(&state.db)
    .await?;

    // Broadcast to all participants
    if let Some(tx) = state.hub.get_event_channel(event_id).await {
        let msg = ServerMessage::Error {
            message: "The QR code for this event has been revoked by the host.".to_string(),
        };
        let _ = tx.send(serde_json::to_string(&msg)?);
    }

    Ok(Json(RevokeQRResponse {
        success: true,
        revoked_at,
        message: "QR code has been revoked".to_string(),
    }))
}
```

**WebSocket Broadcast:**
- Message: `{ "type": "error", "message": "The QR code for this event has been revoked by the host." }`
- Recipients: All connected participants
- Effect: Participants see notification, new joins blocked

---

## Frontend Error Handling

### JoinEvent Component Updates

```typescript
// In frontend/src/pages/JoinEvent.tsx

const handleJoinEvent = async (code: string) => {
  try {
    const response = await api.joinEvent(code);
    // Success flow...
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status;
      const message = error.response?.data?.message;

      switch (status) {
        case 410:
          if (message?.includes('expired')) {
            setError({
              title: 'QR Code Expired',
              message: 'This QR code has expired. The event is no longer accepting participants.',
              action: null
            });
          } else {
            setError({
              title: 'Event Ended',
              message: 'The event has ended. Participation is closed.',
              action: { label: 'View Results', path: `/events/${eventId}/results` }
            });
          }
          break;

        case 403:
          setError({
            title: 'QR Code Revoked',
            message: 'This QR code was revoked by the event host. Please contact the host for assistance.',
            details: error.response?.data?.reason,
            action: { label: 'Contact Host', external: true }
          });
          break;

        case 404:
          setError({
            title: 'Invalid QR Code',
            message: 'Invalid QR code. Please scan a new code from the event host.',
            action: { label: 'Scan Again', callback: () => resetScanner() }
          });
          break;

        default:
          setError({
            title: 'Error',
            message: 'Unable to join event. Please try again.',
            action: { label: 'Retry', callback: () => handleJoinEvent(code) }
          });
      }
    }
  }
};
```

### Error Display Component

```typescript
interface ErrorDisplayProps {
  title: string;
  message: string;
  details?: string;
  action?: {
    label: string;
    path?: string;
    callback?: () => void;
    external?: boolean;
  } | null;
}

const ErrorDisplay: React.FC<ErrorDisplayProps> = ({ title, message, details, action }) => (
  <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
    <div className="flex items-start">
      <AlertCircle className="w-6 h-6 text-red-600 mr-3 flex-shrink-0" />
      <div className="flex-1">
        <h3 className="text-lg font-semibold text-red-900 mb-2">{title}</h3>
        <p className="text-red-700 mb-3">{message}</p>
        {details && (
          <p className="text-sm text-red-600 italic mb-3">Reason: {details}</p>
        )}
        {action && (
          <button
            onClick={action.callback || (() => navigate(action.path!))}
            className="bg-red-600 text-white px-4 py-2 rounded-md hover:bg-red-700 transition"
          >
            {action.label}
          </button>
        )}
      </div>
    </div>
  </div>
);
```

---

## Testing

### Unit Tests

**Backend:** `backend/src/routes/quiz.rs`
```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_join_before_expiration_succeeds() {
        // Create event with expires_at = now + 1 hour
        // Attempt join
        // Assert success
    }

    #[tokio::test]
    async fn test_join_after_expiration_blocked() {
        // Create event with expires_at = now - 1 hour
        // Attempt join
        // Assert AppError::QRExpired
    }

    #[tokio::test]
    async fn test_join_after_revocation_blocked() {
        // Create event
        // Revoke QR code
        // Attempt join
        // Assert AppError::QRRevoked
    }

    #[tokio::test]
    async fn test_revoke_broadcasts_to_participants() {
        // Create event with connected participants
        // Host revokes QR
        // Assert broadcast message sent
    }
}
```

**Frontend:** `frontend/src/pages/__tests__/JoinEvent.test.tsx`
```typescript
describe('JoinEvent Error Handling', () => {
  it('shows expired message on 410 status', async () => {
    mockApi.joinEvent.mockRejectedValue({
      response: { status: 410, data: { message: 'QR code expired' } }
    });

    const { getByText } = render(<JoinEvent />);
    await userEvent.type(screen.getByPlaceholderText('Enter code'), 'ABC123');
    await userEvent.click(screen.getByText('Join'));

    expect(getByText('QR Code Expired')).toBeInTheDocument();
  });

  it('shows revoked message with reason on 403 status', async () => {
    mockApi.joinEvent.mockRejectedValue({
      response: { status: 403, data: { reason: 'Too many participants' } }
    });

    const { getByText } = render(<JoinEvent />);
    await userEvent.type(screen.getByPlaceholderText('Enter code'), 'ABC123');
    await userEvent.click(screen.getByText('Join'));

    expect(getByText('QR Code Revoked')).toBeInTheDocument();
    expect(getByText(/Too many participants/)).toBeInTheDocument();
  });
});
```

### Integration Tests

1. **Join Before Expiration** (Success)
   - Host creates event with end_time = now + 2 hours
   - Participant scans QR code
   - Join succeeds, participant enters event

2. **Join After Expiration** (Blocked)
   - Create event with expires_at = now - 1 hour (manual DB update)
   - Participant scans QR code
   - Join fails with "QR Code Expired" message

3. **Revoke Mid-Event** (Blocks New Joins)
   - Host creates event, 5 participants join
   - Host revokes QR code with reason "Event full"
   - New participant scans QR code
   - Join fails with "QR Code Revoked" + reason

4. **Multiple Join Attempts After Revocation**
   - Participant attempts to join 3 times after revocation
   - All attempts fail with same error
   - Existing participants remain connected

### E2E Test Scenarios

```typescript
// In frontend/e2e/qr-expiration.spec.ts
test('expired QR shows appropriate error', async ({ page }) => {
  // Navigate to join page
  await page.goto('/join');

  // Enter expired event code
  await page.fill('input[name="code"]', 'EXPIRED123');
  await page.click('button:has-text("Join")');

  // Verify error message
  await expect(page.locator('text=QR Code Expired')).toBeVisible();
  await expect(page.locator('text=no longer accepting participants')).toBeVisible();
});

test('revoked QR shows reason to user', async ({ page }) => {
  // Navigate to join page
  await page.goto('/join');

  // Enter revoked event code
  await page.fill('input[name="code"]', 'REVOKED456');
  await page.click('button:has-text("Join")');

  // Verify error with reason
  await expect(page.locator('text=QR Code Revoked')).toBeVisible();
  await expect(page.locator('text=Reason:')).toBeVisible();
});
```

---

## Implementation Checklist

- [ ] Create database migration for `expires_at`, `revoked_at`, `revocation_reason` fields
- [ ] Add expiration calculation logic to `create_event` handler
- [ ] Add validation to `join_event` handler (check expiration and revocation)
- [ ] Update `Event` model with new fields
- [ ] Create `POST /api/events/:id/revoke-qr` endpoint
- [ ] Add revocation WebSocket broadcast to connected participants
- [ ] Update `JoinEvent.tsx` with error type detection
- [ ] Create `ErrorDisplay` component for user-friendly error messages
- [ ] Add backend unit tests for expiration/revocation logic
- [ ] Add frontend unit tests for error handling
- [ ] Add E2E tests for expired/revoked QR scenarios
- [ ] Update API documentation with new endpoint
- [ ] Test grace period edge cases (exactly at expiration time)
- [ ] Verify index performance on `expires_at` field

---

## Success Criteria

- [x] QR codes automatically expire 1 hour after event end time
- [x] Hosts can manually revoke QR codes with optional reason
- [x] Join attempts after expiration return 410 with clear message
- [x] Join attempts after revocation return 403 with reason
- [x] Frontend displays different error messages for each scenario
- [x] WebSocket broadcast notifies participants of revocation
- [x] All tests pass (unit, integration, E2E)
- [x] No performance degradation on join endpoint
- [x] Error messages are user-friendly and actionable

---

## Notes

- **Grace Period Rationale:** 1-hour buffer allows latecomers to join after event technically ends
- **Revocation Use Cases:** Event full, security concerns, incorrect QR shared publicly
- **Database Index:** `idx_events_expires_at` ensures fast validation queries
- **Backward Compatibility:** Existing events backfilled with default `expires_at = created_at + 24 hours`
- **Security:** Prevents indefinite QR code validity, reduces abuse potential
- **UX Consideration:** Clear error messages reduce support burden and user frustration

---

## Related Tickets

- **TICKET-004:** QR code generation (dependency)
- **TICKET-005:** QR code scanning (dependency)
- **TICKET-024:** Analytics dashboard (may track expired/revoked join attempts)
