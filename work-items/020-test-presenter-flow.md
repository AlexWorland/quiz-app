# TICKET-020: Test and Validate PassPresenter Flow

**Priority:** 🟡 MEDIUM
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** None

---

## Description

Write comprehensive unit tests and validation scenarios to ensure the PassPresenter message correctly transfers the presenter role between participants and that UI state updates accordingly. This ticket validates that the multi-presenter flow works correctly across backend authorization, database updates, WebSocket broadcasting, and frontend state management.

## Technical Details

### What This Tests

The PassPresenter flow enables multi-presenter events by allowing the current presenter to transfer control to another participant. This involves:

1. **Backend Authorization**: Only the current presenter or event host can transfer control
2. **Database Updates**: Update `segments.presenter_user_id` to reflect the new presenter
3. **WebSocket Broadcasting**: Broadcast `PresenterChanged` message to all participants
4. **Frontend State**: Update UI to show new presenter and enable/disable controls appropriately
5. **Control Transfer**: Verify new presenter can control quiz flow (start, advance, reveal)

## Files to Modify/Create

### 1. Backend Tests: `backend/src/ws/handler_tests.rs` (NEW)

Create a new test module for WebSocket handler tests:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::User;
    use uuid::Uuid;
    use sqlx::PgPool;

    // Helper to create test database pool
    async fn setup_test_db() -> PgPool {
        // Implementation for test database setup
        todo!()
    }

    #[tokio::test]
    async fn test_pass_presenter_validates_authorization() {
        // Test that only current presenter or host can pass presenter role
        // Expected: Non-presenter user gets error message
        // Expected: Current presenter succeeds
        // Expected: Event host succeeds
    }

    #[tokio::test]
    async fn test_pass_presenter_updates_segment() {
        // Test that segments.presenter_user_id is updated in database
        // Expected: Database field reflects new presenter
        // Expected: Old presenter no longer has control
    }

    #[tokio::test]
    async fn test_pass_presenter_broadcasts_message() {
        // Test that PresenterChanged message is broadcast to all participants
        // Expected: All connected clients receive PresenterChanged
        // Expected: Message contains correct presenter IDs and names
    }

    #[tokio::test]
    async fn test_pass_presenter_new_control() {
        // Test that new presenter can control quiz flow
        // Expected: New presenter can send start_game, next_question, etc.
        // Expected: Old presenter cannot control quiz
    }

    #[tokio::test]
    async fn test_pass_presenter_invalid_participant() {
        // Test passing to user not in event
        // Expected: Error message returned
        // Expected: Presenter unchanged
    }

    #[tokio::test]
    async fn test_pass_presenter_no_active_segment() {
        // Test passing when no segment is active
        // Expected: Error message "No active segment"
        // Expected: No database changes
    }
}
```

### 2. Frontend Integration Test: `frontend/src/pages/__tests__/EventHost.integration.test.tsx` (NEW)

Create integration test for EventHost page presenter flow:

```typescript
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, act, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { EventHostPage } from '../EventHost';
import { MockWebSocket, setupWebSocketMock, cleanupWebSocketMock } from '@/test/mocks/websocket';

describe('EventHost - PassPresenter Integration', () => {
  beforeEach(() => {
    setupWebSocketMock();
    // Mock API calls
  });

  afterEach(() => {
    cleanupWebSocketMock();
    vi.clearAllMocks();
  });

  it('updates currentPresenterName when PresenterChanged received', () => {
    // Test: Verify presenter name updates in UI
  });

  it('disables controls when no longer presenter', () => {
    // Test: Verify controls become disabled if user loses presenter role
  });

  it('sends pass_presenter message when PassPresenterButton clicked', () => {
    // Test: Verify correct WebSocket message sent
  });

  it('handles presenter change during active quiz', () => {
    // Test: Mid-quiz presenter change preserves game state
  });
});
```

### 3. WebSocket Hook Test: `frontend/src/hooks/__tests__/useEventWebSocket.test.ts` (MODIFY)

Add tests for presenter_changed message handling:

```typescript
it('handles presenter_changed message', () => {
  const onMessage = vi.fn();
  renderHook(() =>
    useEventWebSocket({ eventId: 'test-event', onMessage })
  );

  const ws = MockWebSocket.getLatest()!;
  act(() => {
    ws.simulateOpen();
    ws.simulateMessage({
      type: 'presenter_changed',
      previous_presenter_id: 'user1',
      new_presenter_id: 'user2',
      new_presenter_name: 'NewPresenter',
      segment_id: 'seg123',
    });
  });

  expect(onMessage).toHaveBeenCalledWith(
    expect.objectContaining({
      type: 'presenter_changed',
      new_presenter_name: 'NewPresenter',
    })
  );
});
```

## Manual Testing Scenarios

### Scenario 1: Host Passes to Participant 1, Then Participant 1 Passes to Participant 2

```bash
# Terminal 1: Start backend
cd backend
cargo run

# Terminal 2: Start frontend
cd frontend
npm run dev

# Browser 1 (Host):
1. Login as host user
2. Create event with multiple segments
3. Navigate to host view
4. Join as participant in Browser 2 and 3
5. Click "Pass Presenter Role"
6. Select Participant 1
7. Verify controls become disabled
8. Verify "Current Presenter: Participant1" appears

# Browser 2 (Participant 1):
1. Verify controls become enabled
2. Verify "Current Presenter: Participant1" appears
3. Click "Pass Presenter Role"
4. Select Participant 2
5. Verify controls become disabled

# Browser 3 (Participant 2):
1. Verify controls become enabled
2. Verify "Current Presenter: Participant2" appears
3. Start quiz and verify full control
```

### Scenario 2: Only Current Presenter Can Pass Role

```bash
# Verify non-presenter cannot pass role:
# Browser 2 (Non-presenter participant):
1. Open DevTools console
2. Try to send pass_presenter message directly:
   ws.send(JSON.stringify({ type: 'pass_presenter', next_presenter_user_id: 'some-id' }))
3. Expected: Error message received
4. Expected: Presenter unchanged
```

### Scenario 3: Participant Can Become Presenter

```bash
# Verify participant can control quiz after becoming presenter:
# Browser 2 (After receiving presenter role):
1. Verify "Start Quiz" button appears
2. Click "Start Quiz"
3. Verify quiz starts for all participants
4. Advance through questions
5. Verify all controls work (reveal, leaderboard, next question, end)
```

### Scenario 4: Presenter Role Doesn't Affect Participant Viewing/Answering

```bash
# Verify non-presenter participants can still answer:
# Browser 3 (Non-presenter participant):
1. While Browser 2 is presenter and quiz is active
2. Verify questions appear
3. Submit answers
4. Verify answers are recorded
5. Verify leaderboard updates correctly
```

## Testing Commands

### Backend Unit Tests

```bash
cd backend

# Run all WebSocket handler tests
cargo test handler_tests

# Run specific PassPresenter tests
cargo test pass_presenter

# Run with output
cargo test pass_presenter -- --nocapture

# Check code coverage
cargo tarpaulin --out Html --output-dir coverage
```

### Frontend Unit Tests

```bash
cd frontend

# Run PassPresenterButton tests
npm test -- PassPresenterButton

# Run EventHost integration tests
npm test -- EventHost.integration

# Run WebSocket hook tests
npm test -- useEventWebSocket

# Run with coverage
npm run test:coverage
```

### End-to-End Tests

```bash
cd frontend

# Run E2E tests for presenter flow
npm run test:e2e -- --grep "presenter"

# Run in headed mode for debugging
npm run test:e2e:headed -- --grep "presenter"
```

## Acceptance Criteria

### Backend Tests
- [ ] Test: PassPresenter validates host/current presenter permission
- [ ] Test: PassPresenter rejects non-authorized users with error
- [ ] Test: PassPresenter updates `segments.presenter_user_id` in database
- [ ] Test: PassPresenter broadcasts `PresenterChanged` message to all participants
- [ ] Test: New presenter can control quiz flow (start_game, next_question, reveal_answer)
- [ ] Test: Old presenter loses control and receives error on control attempts
- [ ] Test: PassPresenter rejects invalid participant (not in event)
- [ ] Test: PassPresenter handles no active segment gracefully

### Frontend Tests
- [ ] Test: `currentPresenterName` state updates when `PresenterChanged` received
- [ ] Test: Quiz controls become disabled if user is not current presenter
- [ ] Test: Quiz controls become enabled if user becomes current presenter
- [ ] Test: PassPresenterButton sends correct WebSocket message
- [ ] Test: PassPresenterButton filters out current user from eligible list
- [ ] Test: WebSocket hook correctly parses `presenter_changed` message
- [ ] Test: PresenterChanged during active quiz preserves game state

### Manual Testing
- [ ] Scenario 1: Host → Participant 1 → Participant 2 (sequential transfer)
- [ ] Scenario 2: Non-presenter cannot pass role (authorization check)
- [ ] Scenario 3: New presenter can fully control quiz flow
- [ ] Scenario 4: Presenter role doesn't affect participant answering/viewing
- [ ] Scenario 5: Multiple participants can see presenter name updates in real-time
- [ ] Scenario 6: Presenter change during segment-complete shows correct UI state

### Documentation
- [ ] Add test module to `handler.rs` with documentation
- [ ] Document manual testing steps in this ticket
- [ ] Update CLAUDE.md if testing patterns change
- [ ] Create test scenario checklist for QA

## Dependencies

None (tests existing PassPresenter implementation)

## Related Tickets

- TICKET-015-019: Multi-presenter implementation (tests these features)
- TICKET-013-014: Network resilience (presenter state persistence on reconnect)

## Notes

### Testing Strategy

- **Unit Tests**: Focus on individual handler functions and authorization logic
- **Integration Tests**: Focus on full flow from WebSocket message → state update → UI change
- **Manual Tests**: Focus on user experience and edge cases across multiple browsers

### Test Data Requirements

- Mock users: Host, Participant1, Participant2, Participant3
- Mock event with 2-3 segments
- Mock segment with questions ready for quiz
- Mock WebSocket connections for multi-browser simulation

### Known Edge Cases

1. **Passing to self**: Should be prevented by UI (not in eligible list)
2. **Passing during question**: Should preserve quiz state and allow new presenter to continue
3. **Passing at segment complete**: Should allow next segment to start with new presenter
4. **Passing with no participants**: PassPresenterButton shows "No other participants available"
5. **Network disconnect during pass**: Should restore presenter state on reconnect (TICKET-013/014)

### Performance Considerations

- PassPresenter should complete in <100ms
- Broadcast to all participants should be atomic
- No race conditions between presenter checks and database updates
- WebSocket message order should be preserved

### Security Validation

- [ ] Only authenticated users can pass presenter
- [ ] Only current presenter or host can initiate pass
- [ ] Cannot pass to non-participant users
- [ ] SQL injection protection in presenter queries
- [ ] Authorization checks cannot be bypassed

### Future Enhancements

- Add "Request Presenter Role" feature for participants to request control
- Add presenter role history/audit log
- Add presenter role timeout (auto-revert after inactivity)
- Add presenter role queue for scheduled transitions
