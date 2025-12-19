# TICKET-006: Resume Segment/Event - Database Tracking

**Priority:** 🔴 CRITICAL
**Effort:** 1-1.5 hours
**Status:** Pending
**Depends On:** None

---

## Description

Add database columns to track previous state before accidental segment/event ending, enabling resume functionality.

## Files to Create

### 1. `backend/migrations/<timestamp>_resume_state_tracking.up.sql`

```sql
-- Track previous state for segments to enable resume
ALTER TABLE segments
ADD COLUMN previous_status VARCHAR(50),
ADD COLUMN was_ended_at TIMESTAMP,
ADD COLUMN end_reason VARCHAR(100);

-- Track previous state for events to enable resume
ALTER TABLE events
ADD COLUMN previous_status VARCHAR(50),
ADD COLUMN was_ended_at TIMESTAMP,
ADD COLUMN end_reason VARCHAR(100);

-- Add indexes for faster lookups
CREATE INDEX idx_segments_was_ended_at ON segments(was_ended_at);
CREATE INDEX idx_events_was_ended_at ON events(was_ended_at);

-- Add comment for clarity
COMMENT ON COLUMN segments.previous_status IS 'Status before segment was ended, used for resume functionality';
COMMENT ON COLUMN events.previous_status IS 'Status before event was ended, used for resume functionality';
```

### 2. `backend/migrations/<timestamp>_resume_state_tracking.down.sql`

```sql
-- Drop indexes
DROP INDEX IF EXISTS idx_events_was_ended_at;
DROP INDEX IF EXISTS idx_segments_was_ended_at;

-- Remove columns
ALTER TABLE events
DROP COLUMN end_reason,
DROP COLUMN was_ended_at,
DROP COLUMN previous_status;

ALTER TABLE segments
DROP COLUMN end_reason,
DROP COLUMN was_ended_at,
DROP COLUMN previous_status;
```

## Implementation Steps

1. Create migration:
   ```bash
   cd backend
   sqlx migrate add -r resume_state_tracking
   ```

2. Copy SQL into generated files

3. Run migration:
   ```bash
   cargo sqlx migrate run
   ```

4. Verify:
   ```bash
   SELECT column_name FROM information_schema.columns
   WHERE table_name IN ('segments', 'events')
   ORDER BY table_name;
   ```

## Acceptance Criteria

- [ ] Migration files created with up and down scripts
- [ ] Migration runs successfully
- [ ] Columns added: `previous_status`, `was_ended_at`, `end_reason`
- [ ] Columns added to both `segments` and `events` tables
- [ ] Indexes created for performance
- [ ] Down migration successfully reverts changes
- [ ] No compiler errors or warnings

## Dependencies

- None (foundational)

## Related Tickets

- TICKET-007: Resume Segment/Event - Backend Handlers (depends on this)
- TICKET-008: Resume Segment/Event - Frontend Modals (depends on this)

## Notes

- `previous_status` stores the status before ending (e.g., "quizzing", "recording")
- `was_ended_at` tracks when the end happened (used for expiration logic)
- `end_reason` can be "user_ended" or "unknown" (for analytics)
- Resume state expires after 30 minutes (configurable)
