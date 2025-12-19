# TICKET-010: QR Lock/Unlock Controls - Database Column

**Priority:** 🟡 HIGH
**Effort:** 0.5 hours
**Status:** Pending

---

## Description

Add database column to track QR code locking state, allowing hosts to prevent new participants from joining.

## Files to Create

### 1. `backend/migrations/<timestamp>_qr_lock_state.up.sql`

```sql
-- Track QR code lock state on events
ALTER TABLE events
ADD COLUMN qr_locked BOOLEAN DEFAULT FALSE,
ADD COLUMN qr_locked_at TIMESTAMP,
ADD COLUMN qr_locked_by UUID;

-- Add index for faster lookups
CREATE INDEX idx_events_qr_locked ON events(qr_locked);

-- Add comment
COMMENT ON COLUMN events.qr_locked IS 'Whether new participants can join via QR code';
COMMENT ON COLUMN events.qr_locked_at IS 'Timestamp when QR was last locked/unlocked';
```

### 2. `backend/migrations/<timestamp>_qr_lock_state.down.sql`

```sql
-- Drop index
DROP INDEX IF EXISTS idx_events_qr_locked;

-- Remove columns
ALTER TABLE events
DROP COLUMN qr_locked_by,
DROP COLUMN qr_locked_at,
DROP COLUMN qr_locked;
```

## Implementation Steps

1. Create migration:
   ```bash
   cd backend
   sqlx migrate add -r qr_lock_state
   ```

2. Copy SQL into generated files

3. Run migration:
   ```bash
   cargo sqlx migrate run
   ```

4. Verify:
   ```bash
   SELECT column_name FROM information_schema.columns
   WHERE table_name = 'events'
   AND column_name IN ('qr_locked', 'qr_locked_at', 'qr_locked_by');
   ```

## Acceptance Criteria

- [ ] Migration files created
- [ ] Migration runs successfully
- [ ] `qr_locked`, `qr_locked_at`, `qr_locked_by` columns added to events table
- [ ] Index created for qr_locked column
- [ ] Down migration reverts changes
- [ ] No compiler errors

## Dependencies

- None (foundational)

## Related Tickets

- TICKET-011: QR Lock/Unlock - Backend Handlers
- TICKET-012: QR Lock/Unlock - Frontend UI

## Notes

- `qr_locked_by` tracks which user locked it (for audit trail)
- `qr_locked_at` updates on each lock/unlock
- Default FALSE allows joining until explicitly locked
