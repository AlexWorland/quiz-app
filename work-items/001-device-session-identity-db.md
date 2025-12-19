# TICKET-001: Device/Session Identity - Database Migrations

**Priority:** 🔴 CRITICAL
**Effort:** 2-3 hours
**Status:** Pending
**Related Stories:** Join session via QR, Prevent duplicate players, Device identity binding, Rejoin via QR

---

## Description

Create database schema to track device and session identity for participants. This is the foundation for preventing duplicate joins and enabling state restoration on reconnect.

## Technical Details

### Files to Create
- `backend/migrations/<timestamp>_device_session_identity.up.sql`
- `backend/migrations/<timestamp>_device_session_identity.down.sql`

### Migration Content

**Up Migration:**
```sql
-- Add device tracking columns to event_participants
ALTER TABLE event_participants
ADD COLUMN device_id UUID NOT NULL DEFAULT gen_random_uuid(),
ADD COLUMN session_token VARCHAR(255) UNIQUE,
ADD COLUMN join_timestamp TIMESTAMP DEFAULT NOW(),
ADD COLUMN last_heartbeat TIMESTAMP DEFAULT NOW();

-- Create unique constraint to prevent same device from joining same event twice
ALTER TABLE event_participants
ADD CONSTRAINT unique_device_per_event UNIQUE(event_id, device_id);

-- Add index for faster device lookups
CREATE INDEX idx_event_participants_device_id ON event_participants(device_id);
CREATE INDEX idx_event_participants_session_token ON event_participants(session_token);
```

**Down Migration:**
```sql
-- Drop constraints and columns
DROP INDEX IF EXISTS idx_event_participants_session_token;
DROP INDEX IF EXISTS idx_event_participants_device_id;

ALTER TABLE event_participants
DROP CONSTRAINT unique_device_per_event,
DROP COLUMN last_heartbeat,
DROP COLUMN join_timestamp,
DROP COLUMN session_token,
DROP COLUMN device_id;
```

## Implementation Steps

1. Run migration command:
   ```bash
   cd backend
   sqlx migrate add -r device_session_identity
   ```

2. Copy the Up/Down SQL above into generated files

3. Run migration:
   ```bash
   cargo sqlx migrate run
   ```

4. Verify with:
   ```bash
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'event_participants';
   ```

## Acceptance Criteria

- [ ] Migration file created with both up and down scripts
- [ ] Migration runs successfully with `cargo sqlx migrate run`
- [ ] `device_id`, `session_token`, `join_timestamp`, `last_heartbeat` columns added to `event_participants`
- [ ] Unique constraint on `(event_id, device_id)` enforced
- [ ] Indexes created for performance
- [ ] Down migration successfully reverts changes
- [ ] No compiler errors or warnings

## Dependencies

- None (foundational ticket)

## Related Tickets

- TICKET-002: Device/Session Identity - Backend Handlers
- TICKET-003: Device/Session Identity - Frontend Join Flow

## Notes

- `device_id` uses `gen_random_uuid()` as default but will be overridden by frontend-calculated fingerprint
- `session_token` is unique to each session (regenerated on each login)
- `last_heartbeat` will be used for network resilience feature (TICKET-13)
