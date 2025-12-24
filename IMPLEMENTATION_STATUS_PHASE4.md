# Phase 4 Network Resilience - Implementation Status

## Completed Tasks (9/15)

### Phase 1: UI Integration & Camera (100%)
- ✅ Change Display Name UI Integration
- ✅ Real-time Name Update WebSocket Messages  
- ✅ Comprehensive Browser-Specific Camera Permission Guide
- ✅ Permission Retry and Recovery Flow

### Phase 2: Edge Cases & Timing (100%)
- ✅ Join Attempt Timestamping for Mid-Scan Lock
- ✅ Real-time QR Lock Status Broadcast
- ✅ Late Join During Leaderboard Phase

### Phase 3: Race Condition Protection (100%)
- ✅ Join Queue Management for Simultaneous Scans
- ✅ Database Locking for Concurrent Join Operations

## Remaining Tasks (6/15) - Phase 4 Network Resilience

### High Priority - Core Infrastructure
1. **Heartbeat System** (Status: In Progress)
   - Files: `backend-python/app/ws/hub.py`, `backend-python/app/ws/heartbeat.py`
   - Add WebSocket ping/pong heartbeat mechanism
   - Track last heartbeat time per connection
   - Implement grace period before marking offline (30 seconds)
   - Database migration: Add `last_heartbeat`, `connection_state` to `event_participants`

2. **Disconnect State Management** (Status: Pending)
   - Files: `backend-python/app/ws/game_handler.py`, `backend-python/app/ws/messages.py`
   - Distinguish "temporarily_disconnected" vs "permanently_left"
   - Preserve scores and quiz state during disconnect
   - Broadcast participant status changes

3. **Reconnection System** (Status: Pending)
   - Files: `frontend/src/hooks/useEventWebSocket.ts`
   - Implement exponential backoff (1s, 2s, 4s, 8s, max 30s)
   - Auto-reconnect on network loss
   - Show reconnection UI with countdown

4. **State Restoration** (Status: Pending)
   - Files: `backend-python/app/ws/messages.py`, `backend-python/app/ws/game_handler.py`
   - Add `StateRestoredMessage` with current question, score, phase
   - Send full state on reconnection
   - Client-side state rehydration

5. **Tab Recovery Flow** (Status: Pending)
   - Files: `frontend/src/pages/EventParticipant.tsx`
   - Detect existing session on page load
   - Silent recovery with device fingerprint
   - Show "Restoring session..." progress

### Testing Tasks
6. **Network Resilience Testing** (Status: Pending)
   - Create E2E tests for disconnect/reconnect scenarios
   - Test race conditions under load
   - Validate score preservation

## Key Implementation Details

### Heartbeat System Design
```python
# backend-python/app/ws/heartbeat.py
class HeartbeatManager:
    HEARTBEAT_INTERVAL = 15  # seconds
    GRACE_PERIOD = 30  # seconds before marking offline
    
    async def start_heartbeat(self, websocket, participant_id):
        while True:
            await asyncio.sleep(self.HEARTBEAT_INTERVAL)
            await websocket.send_json({"type": "ping"})
            
    async def handle_pong(self, participant_id):
        # Update last_heartbeat in database
        pass
```

### Reconnection Backoff
```typescript
// frontend/src/hooks/useReconnection.ts
const BACKOFF_MULTIPLIER = 2
const MAX_BACKOFF = 30000  // 30 seconds
let attempt = 0

function getBackoffDelay(): number {
  return Math.min(1000 * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_BACKOFF)
}
```

### Database Schema Additions
```sql
-- Already added in join_attempts migration:
ALTER TABLE event_participants
ADD COLUMN connection_state VARCHAR(50) DEFAULT 'connected';

-- Values: 'connected', 'temporarily_disconnected', 'disconnected'
```

## Next Steps (Priority Order)

1. Implement WebSocket ping/pong heartbeat in `hub.py`
2. Add participant connection state tracking in database
3. Implement disconnect grace period logic
4. Build frontend reconnection hook with exponential backoff
5. Add state restoration message handling
6. Implement tab recovery flow
7. Write comprehensive E2E tests

## Estimated Remaining Effort
- Heartbeat System: 4-6 hours
- Disconnect Management: 3-4 hours
- Reconnection System: 4-5 hours
- State Restoration: 3-4 hours
- Tab Recovery: 2-3 hours
- Testing: 4-6 hours

**Total**: 20-28 hours

## Risk Assessment
- **High Complexity**: WebSocket connection lifecycle management
- **Critical Path**: Heartbeat must be solid before building on top
- **Testing Challenge**: Network conditions hard to simulate

## Success Criteria
- Participants survive temporary network loss (< 30s)
- Scores preserved across disconnects
- Smooth reconnection experience
- Tab close/reopen works without data loss
- No race conditions under simultaneous operations

