# TICKET-016: Join State Awareness - Database Column

**Priority:** 🟡 MEDIUM
**Effort:** 1-1.5 hours
**Status:** Pending
**Depends On:** TICKET-001

---

## Description

Add database column to track participant's current join state throughout the event lifecycle. This enables proper state management for participants as they progress through different phases of multi-segment events.

## Files to Create

### 1. `backend/migrations/<timestamp>_join_state_tracking.up.sql`

```sql
-- Track participant join state throughout event lifecycle
ALTER TABLE event_participants
ADD COLUMN join_status VARCHAR(50) DEFAULT 'joined';

-- Add index for faster state-based queries
CREATE INDEX idx_event_participants_join_status ON event_participants(join_status);

-- Add comment for clarity
COMMENT ON COLUMN event_participants.join_status IS 'Current join state of participant: joined, waiting_for_segment, active_in_quiz, segment_complete';
```

### 2. `backend/migrations/<timestamp>_join_state_tracking.down.sql`

```sql
-- Drop index
DROP INDEX IF EXISTS idx_event_participants_join_status;

-- Remove column
ALTER TABLE event_participants
DROP COLUMN join_status;
```

## Implementation Steps

1. Create migration:
   ```bash
   cd backend
   sqlx migrate add -r join_state_tracking
   ```

2. Copy SQL into generated files

3. Run migration:
   ```bash
   cargo sqlx migrate run
   ```

4. Verify:
   ```bash
   SELECT column_name, data_type, column_default
   FROM information_schema.columns
   WHERE table_name = 'event_participants'
   AND column_name = 'join_status';
   ```

5. Update `EventParticipant` struct in `backend/src/models/event.rs`:
   ```rust
   pub struct EventParticipant {
       pub id: Uuid,
       pub event_id: Uuid,
       pub user_id: Uuid,
       pub total_score: i32,
       pub joined_at: DateTime<Utc>,
       pub join_status: String, // NEW: 'joined', 'waiting_for_segment', 'active_in_quiz', 'segment_complete'
   }
   ```

## Acceptance Criteria

- [ ] Migration files created with up and down scripts
- [ ] Migration runs successfully
- [ ] `join_status` column added to `event_participants` table
- [ ] Column has default value of 'joined'
- [ ] Index created for performance on join_status lookups
- [ ] Down migration successfully reverts changes
- [ ] `EventParticipant` struct updated in `backend/src/models/event.rs`
- [ ] No compiler errors or warnings

## Testing

Manual verification steps:
```sql
-- Insert test participant
INSERT INTO event_participants (event_id, user_id)
VALUES ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002');

-- Verify default join_status
SELECT id, join_status FROM event_participants WHERE user_id = '00000000-0000-0000-0000-000000000002';
-- Expected: join_status = 'joined'

-- Update state
UPDATE event_participants SET join_status = 'active_in_quiz' WHERE user_id = '00000000-0000-0000-0000-000000000002';

-- Query by state (tests index)
SELECT COUNT(*) FROM event_participants WHERE join_status = 'active_in_quiz';
```

## Dependencies

- TICKET-001: Device/Session Identity - Database Migrations (recommended, provides session context)

## Related Tickets

- TICKET-017: Join State Awareness - Backend Handlers (depends on this)
- TICKET-018: Join State Awareness - Frontend State Management (depends on this)

## Notes

### Join Status Values

The `join_status` column supports the following states:

1. **`joined`** (default): Initial state when participant first joins event
2. **`waiting_for_segment`**: Between segments, waiting for next segment to start
3. **`active_in_quiz`**: Currently participating in an active quiz
4. **`segment_complete`**: Completed current segment, can view results

### State Transition Flow

```
joined → active_in_quiz → segment_complete → waiting_for_segment → active_in_quiz → ...
```

### Update Triggers

- **`joined`**: Set when participant first joins via QR code
- **`waiting_for_segment`**: Set when segment ends or when joining mid-event between segments
- **`active_in_quiz`**: Set when quiz phase starts for a segment
- **`segment_complete`**: Set when participant completes all questions in a segment or segment ends

### Performance Considerations

- Index on `join_status` enables efficient queries like:
  - "Show all active participants in quiz"
  - "Count participants waiting for next segment"
  - "Find all participants who completed current segment"

### Future Extensions

This column can be extended to support additional states:
- `disconnected`: Participant lost connection but can rejoin
- `removed`: Participant was removed by host
- `left`: Participant voluntarily left event
