# TICKET-018: Join State Awareness - Frontend Display

**Priority:** 🟡 MEDIUM
**Effort:** 1-1.5 hours
**Status:** Pending
**Depends On:** TICKET-017

---

## Description

Display participant's current join status in the UI with visual indicators and status messages. Participants need to see whether they are "Joined and Waiting", "Quiz in Progress", or "Segment Complete" with appropriate color-coded badges and helpful messaging.

## Files to Modify

### 1. `frontend/src/hooks/useEventWebSocket.ts`

Add `JoinStatusChanged` message type to `ServerMessage` union:

```typescript
export type ServerMessage =
  | { type: 'connected'; participants: Participant[] }
  | { type: 'participant_joined'; user: Participant }
  | { type: 'participant_left'; user_id: string }
  | { type: 'join_status_changed'; user_id: string; status: 'joined_waiting' | 'active' | 'completed' }
  | { type: 'game_started' }
  | { type: 'question'; question_id: string; question_number: number; total_questions: number; text: string; answers: string[]; time_limit: number }
  // ... rest of existing message types
```

Add `JoinStatus` type export:

```typescript
export type JoinStatus = 'joined_waiting' | 'active' | 'completed';
```

### 2. `frontend/src/pages/EventParticipant.tsx`

Add join status state and WebSocket message listener:

```typescript
import { Clock, Play, CheckCircle } from 'lucide-react';

export function EventParticipantPage() {
  // ... existing state ...

  const [joinStatus, setJoinStatus] = useState<'joined_waiting' | 'active' | 'completed'>('joined_waiting');

  const { isConnected, sendMessage } = useEventWebSocket({
    eventId: eventId ?? '',
    onMessage: (msg: ServerMessage) => {
      if (msg.type === 'connected') {
        setParticipants(msg.participants);
      } else if (msg.type === 'join_status_changed') {
        // Update status only if it's for current user
        if (user && msg.user_id === user.id) {
          setJoinStatus(msg.status);

          // Show toast notification (optional)
          if (msg.status === 'active') {
            console.log('Quiz is now active!');
          } else if (msg.status === 'completed') {
            console.log('Segment complete!');
          }
        }
      } else if (msg.type === 'participant_joined') {
        setParticipants((prev) => [...prev, msg.user]);
      }
      // ... rest of message handlers
    },
  });

  // ... rest of component logic
}
```

Add status badge component in header section:

```typescript
// Helper function for status display
const getStatusDisplay = (status: typeof joinStatus) => {
  switch (status) {
    case 'joined_waiting':
      return {
        label: 'Joined and Waiting',
        color: 'gray',
        icon: Clock,
        bgClass: 'bg-gray-500/10',
        borderClass: 'border-gray-500/30',
        textClass: 'text-gray-400',
        message: 'Waiting for quiz to start...',
      };
    case 'active':
      return {
        label: 'Quiz in Progress',
        color: 'cyan',
        icon: Play,
        bgClass: 'bg-cyan-500/10',
        borderClass: 'border-cyan-500/30',
        textClass: 'text-cyan-400',
        message: 'Quiz is active! Answer questions as they appear.',
      };
    case 'completed':
      return {
        label: 'Segment Complete',
        color: 'green',
        icon: CheckCircle,
        bgClass: 'bg-green-500/10',
        borderClass: 'border-green-500/30',
        textClass: 'text-green-400',
        message: 'This segment has ended. View your results!',
      };
  }
};

// In the JSX return statement, update the connection banner:
return (
  <div className="min-h-screen bg-gradient-to-br from-dark-950 to-dark-900">
    <div className="max-w-6xl mx-auto p-6 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* ... existing header content ... */}
      </div>

      {/* Connection banner with status */}
      <div className="space-y-3">
        {/* Connection status */}
        <div className="rounded-lg p-3 text-sm flex items-center justify-between border"
          style={{ borderColor: isConnected ? '#22c55e55' : '#f9731655', background: '#020617' }}
        >
          <div className="flex items-center gap-2">
            <span
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-gray-200">
              {isConnected ? 'Connected to live game' : 'Reconnecting...'}
            </span>
            {currentPresenterName && (
              <div className="text-xs text-cyan-400 ml-2">
                Presenter: {currentPresenterName}
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400">
            Players connected: {participants.length}
          </div>
        </div>

        {/* Join status badge */}
        {(() => {
          const statusInfo = getStatusDisplay(joinStatus);
          const StatusIcon = statusInfo.icon;

          return (
            <div
              className={`rounded-lg p-3 text-sm flex items-center gap-3 border ${statusInfo.bgClass} ${statusInfo.borderClass}`}
            >
              <StatusIcon className={`w-5 h-5 ${statusInfo.textClass}`} />
              <div className="flex-1">
                <div className={`font-semibold ${statusInfo.textClass}`}>
                  {statusInfo.label}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {statusInfo.message}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ... rest of component ... */}
    </div>
  </div>
);
```

### 3. Update status on game events

Add automatic status transitions based on game events:

```typescript
const { isConnected, sendMessage } = useEventWebSocket({
  eventId: eventId ?? '',
  onMessage: (msg: ServerMessage) => {
    // ... existing handlers ...

    if (msg.type === 'game_started') {
      setGameStarted(true);
      setJoinStatus('active'); // Transition to active when game starts
      setShowResults(false);
      setHasAnswered(false);
      setUserAnswer(undefined);
      setPointsEarned(undefined);
    } else if (msg.type === 'segment_complete') {
      setJoinStatus('completed'); // Transition to completed when segment ends
      setSegmentResults({
        segment_id: msg.segment_id,
        segment_title: msg.segment_title,
        presenter_name: msg.presenter_name,
        segment_leaderboard: msg.segment_leaderboard,
        event_leaderboard: msg.event_leaderboard,
        segment_winner: msg.segment_winner,
        event_leader: msg.event_leader,
      });
      setShowResults(false);
      setCurrentQuestionId(null);
    }
    // ... rest of handlers
  },
});
```

## Acceptance Criteria

- [ ] `JoinStatusChanged` message type added to `ServerMessage` union
- [ ] `joinStatus` state added to EventParticipant component
- [ ] WebSocket listener updates `joinStatus` on `join_status_changed` message
- [ ] Status badge displays in header with correct icon and color
- [ ] "Joined and Waiting" shows gray with clock icon
- [ ] "Quiz in Progress" shows cyan with play icon
- [ ] "Segment Complete" shows green with checkmark icon
- [ ] Helpful status messages displayed below badge
- [ ] Status automatically transitions on `game_started` event
- [ ] Status automatically transitions on `segment_complete` event
- [ ] Status only updates for current user (user_id check)
- [ ] No TypeScript errors or warnings
- [ ] UI responsive on mobile and desktop

## Testing

### Manual Testing

1. **Join Event**:
   - Navigate to event participant page
   - Verify status shows "Joined and Waiting" (gray, clock icon)
   - Check message says "Waiting for quiz to start..."

2. **Game Start**:
   - Have presenter start the quiz
   - Verify status transitions to "Quiz in Progress" (cyan, play icon)
   - Check message says "Quiz is active! Answer questions as they appear."

3. **Segment Complete**:
   - Complete all questions in segment
   - Verify status transitions to "Segment Complete" (green, checkmark)
   - Check message says "This segment has ended. View your results!"

4. **WebSocket Messages**:
   - Open DevTools console
   - Watch for `join_status_changed` WebSocket messages
   - Verify user_id matches current user before updating status

5. **Responsive Design**:
   - Test on mobile viewport (375px width)
   - Test on tablet viewport (768px width)
   - Test on desktop viewport (1440px width)
   - Verify status badge layout adapts properly

### Frontend Tests

```bash
cd frontend
npm test -- EventParticipant.test.tsx
npm run type-check
```

## Dependencies

- TICKET-017: Join State Awareness - WebSocket Messages (provides `JoinStatusChanged` message type)

## Related Tickets

- TICKET-001: Device/Session Identity - Database Schema
- TICKET-002: Device/Session Identity - Backend Join Handler
- TICKET-003: Device/Session Identity - Frontend Join Flow
- TICKET-016: Join State Awareness - Backend State Machine (tracking logic)
- TICKET-017: Join State Awareness - WebSocket Messages (message definitions)

## Notes

- Status updates are user-specific (only update if `user_id` matches current user)
- Automatic transitions on `game_started` and `segment_complete` provide fallback if WebSocket message is missed
- Toast notifications are optional and can be added later with a proper toast library
- Icon imports from `lucide-react` are already used in the codebase
- Color scheme matches existing design system (gray/cyan/green)
- Status message provides context for what the participant should expect next
- Status badge is separate from connection banner to distinguish network state from quiz state
