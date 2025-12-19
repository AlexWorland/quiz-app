# TICKET-022: Late Join During Quiz - Prevent Mid-Question Answers

**Priority:** 🟡 MEDIUM
**Effort:** 2-3 hours
**Status:** Pending
**Depends On:** TICKET-001, TICKET-016, TICKET-017

---

## Description

Prevent participants who join after a question is displayed from answering that specific question. Late joiners should only be able to answer questions that are displayed after they join. This ensures fairness by preventing participants from joining mid-question, seeing the question and timer countdown, and quickly submitting an answer without the full time constraint.

This is different from TICKET-019 (late joiner indicators), which only marks participants who joined after the quiz started. This ticket enforces per-question eligibility based on when the participant joined versus when each individual question was displayed.

## Technical Details

### Files to Modify

#### 1. `backend/migrations/<timestamp>_add_question_displayed_at.up.sql`

```sql
-- Add displayed_at timestamp to track when each question was shown to participants
ALTER TABLE questions
ADD COLUMN displayed_at TIMESTAMPTZ;

-- Create index for efficient eligibility checks
CREATE INDEX idx_questions_displayed_at ON questions(displayed_at);
```

#### 2. `backend/migrations/<timestamp>_add_question_displayed_at.down.sql`

```sql
-- Revert changes
DROP INDEX IF EXISTS idx_questions_displayed_at;

ALTER TABLE questions
DROP COLUMN displayed_at;
```

#### 3. `backend/src/models/question.rs`

Add `displayed_at` field to Question model:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Question {
    pub id: Uuid,
    pub segment_id: Uuid,
    pub question_text: String,
    pub correct_answer: String,
    pub fake_answers: Vec<String>,
    pub order_num: i32,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub displayed_at: Option<DateTime<Utc>>,
}
```

#### 4. `backend/src/ws/handler.rs`

Update question display logic to capture timestamp and add answer eligibility validation:

```rust
// In handle_next_question function (around line 350-400)
GameMessage::NextQuestion => {
    // ... existing validation code ...

    let next_question = questions.get(current_index)?;

    // Set displayed_at timestamp in database
    let now = chrono::Utc::now();
    let _ = sqlx::query(
        "UPDATE questions SET displayed_at = $1 WHERE id = $2"
    )
    .bind(now)
    .bind(next_question.id)
    .execute(&state.db)
    .await;

    // Broadcast question with displayed_at timestamp
    let message = ServerMessage::Question {
        id: next_question.id,
        text: next_question.question_text.clone(),
        answers: shuffled_answers,
        time_limit: 30,
        displayed_at: now.to_rfc3339(),
    };

    let _ = hub.broadcast(event_id, serde_json::to_string(&message).unwrap()).await;

    // ... rest of existing logic ...
}

// In handle_answer function (around line 780-850)
GameMessage::Answer { question_id, answer_index, time_taken } => {
    // ... existing validation code ...

    // Fetch question with displayed_at timestamp
    let question = sqlx::query_as::<_, Question>(
        "SELECT * FROM questions WHERE id = $1"
    )
    .bind(question_id)
    .fetch_optional(&state.db)
    .await?;

    let question = question.ok_or_else(|| {
        AppError::NotFound("Question not found".to_string())
    })?;

    // Get participant join time
    let participant = sqlx::query!(
        r#"
        SELECT ep.joined_at, ep.user_id
        FROM event_participants ep
        WHERE ep.event_id = $1 AND ep.user_id = $2
        "#,
        event_id,
        uid
    )
    .fetch_optional(&state.db)
    .await?;

    let participant = participant.ok_or_else(|| {
        AppError::NotFound("Participant not found".to_string())
    })?;

    // Check eligibility: participant must have joined before question was displayed
    if let Some(displayed_at) = question.displayed_at {
        let joined_at = participant.joined_at;

        // Allow small buffer (500ms) for edge cases like simultaneous join/display
        let buffer = chrono::Duration::milliseconds(500);
        let eligibility_threshold = displayed_at - buffer;

        if joined_at > eligibility_threshold {
            // Participant joined after question was displayed - not eligible
            let error_msg = ServerMessage::Error {
                message: "You are not eligible to answer this question. You joined after it was displayed. Please wait for the next question.".to_string(),
            };

            // Send error only to this participant
            if let Some(conn) = hub.get_connection(event_id, uid).await {
                let _ = conn.send(serde_json::to_string(&error_msg).unwrap()).await;
            }

            return Ok(());
        }
    }

    // ... rest of existing answer processing logic ...
}
```

#### 5. `backend/src/ws/messages.rs`

Update ServerMessage::Question to include displayed_at:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing variants ...

    Question {
        id: Uuid,
        text: String,
        answers: Vec<String>,
        time_limit: u32,
        displayed_at: String, // ISO 8601 timestamp
    },

    // ... rest of variants ...
}
```

#### 6. `frontend/src/hooks/useEventWebSocket.ts`

Update message handler to track question displayed_at:

```typescript
interface QuestionMessage {
  type: 'question'
  id: string
  text: string
  answers: string[]
  time_limit: number
  displayed_at: string // ISO 8601 timestamp
}

// In WebSocket message handler
useEffect(() => {
  if (!ws) return

  const handleMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data)

    switch (message.type) {
      case 'question':
        setCurrentQuestion({
          id: message.id,
          text: message.text,
          answers: message.answers,
          timeLimit: message.time_limit,
          displayedAt: message.displayed_at, // Store displayed_at
        })
        setTimeRemaining(message.time_limit)
        setSelectedAnswer(null)
        setPhase('showing_question')
        break

      case 'error':
        // Display error to user (e.g., ineligible to answer)
        setError(message.message)
        break

      // ... rest of cases ...
    }
  }

  ws.addEventListener('message', handleMessage)
  return () => ws.removeEventListener('message', handleMessage)
}, [ws])
```

#### 7. `frontend/src/components/quiz/AnswerSelection.tsx`

Add client-side eligibility check and UI feedback:

```typescript
import { useEffect, useState } from 'react'
import { Clock, AlertCircle } from 'lucide-react'
import type { LeaderboardEntry } from '@/api/endpoints'

interface AnswerSelectionProps {
  answers: string[]
  selectedAnswer: number | null
  onAnswerSelect: (index: number) => void
  timeRemaining: number
  hasAnswered: boolean
  currentUser?: LeaderboardEntry
  questionDisplayedAt?: string // ISO 8601 timestamp
  participantJoinedAt?: string // ISO 8601 timestamp
}

export function AnswerSelection({
  answers,
  selectedAnswer,
  onAnswerSelect,
  timeRemaining,
  hasAnswered,
  currentUser,
  questionDisplayedAt,
  participantJoinedAt,
}: AnswerSelectionProps) {
  const [isEligible, setIsEligible] = useState(true)

  // Check eligibility on mount and when timestamps change
  useEffect(() => {
    if (!questionDisplayedAt || !participantJoinedAt) {
      setIsEligible(true)
      return
    }

    const displayedTime = new Date(questionDisplayedAt).getTime()
    const joinedTime = new Date(participantJoinedAt).getTime()

    // 500ms buffer for edge cases
    const buffer = 500
    const eligible = joinedTime <= (displayedTime + buffer)

    setIsEligible(eligible)
  }, [questionDisplayedAt, participantJoinedAt])

  // Disable answers if not eligible or already answered
  const disabled = !isEligible || hasAnswered

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-accent-cyan" />
          <span className="text-white font-semibold">
            Time Remaining: {timeRemaining}s
          </span>
        </div>
      </div>

      {/* Ineligibility Warning */}
      {!isEligible && (
        <div className="flex items-start gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg mb-4">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-yellow-300 font-semibold mb-1">
              Not Eligible for This Question
            </p>
            <p className="text-gray-300 text-sm">
              You joined after this question was displayed. You can answer the next question.
            </p>
          </div>
        </div>
      )}

      {/* Answer Buttons */}
      <div className="grid grid-cols-1 gap-3">
        {answers.map((answer, index) => (
          <button
            key={index}
            onClick={() => !disabled && onAnswerSelect(index)}
            disabled={disabled}
            className={`
              p-4 rounded-lg text-left font-medium transition-all
              ${disabled
                ? 'bg-dark-700 text-gray-500 cursor-not-allowed'
                : selectedAnswer === index
                ? 'bg-accent-cyan text-dark-900 ring-2 ring-accent-cyan'
                : 'bg-dark-800 text-white hover:bg-dark-700 hover:ring-2 hover:ring-accent-cyan/50'
              }
            `}
          >
            <span className="mr-3 text-gray-400">{String.fromCharCode(65 + index)}.</span>
            {answer}
          </button>
        ))}
      </div>

      {/* Submit Feedback */}
      {hasAnswered && isEligible && (
        <p className="text-center text-accent-cyan text-sm mt-4">
          Answer submitted! Waiting for other participants...
        </p>
      )}
    </div>
  )
}
```

#### 8. `frontend/src/pages/EventParticipant.tsx`

Pass eligibility data to AnswerSelection component:

```typescript
import { useAuthStore } from '@/store/authStore'
import { AnswerSelection } from '@/components/quiz/AnswerSelection'
import { useEventWebSocket } from '@/hooks/useEventWebSocket'

export function EventParticipant() {
  const { user } = useAuthStore()
  const {
    currentQuestion,
    timeRemaining,
    selectedAnswer,
    submitAnswer,
    participants,
    phase,
  } = useEventWebSocket(eventId)

  // Find current participant data
  const currentParticipant = participants.find(p => p.user_id === user?.id)

  return (
    <div className="container mx-auto px-4 py-8">
      {phase === 'showing_question' && currentQuestion && (
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-6">
            {currentQuestion.text}
          </h2>

          <AnswerSelection
            answers={currentQuestion.answers}
            selectedAnswer={selectedAnswer}
            onAnswerSelect={submitAnswer}
            timeRemaining={timeRemaining}
            hasAnswered={selectedAnswer !== null}
            currentUser={currentParticipant}
            questionDisplayedAt={currentQuestion.displayedAt}
            participantJoinedAt={currentParticipant?.joined_at}
          />
        </div>
      )}
    </div>
  )
}
```

## Implementation Steps

1. **Create database migration**:
   ```bash
   cd backend
   sqlx migrate add -r add_question_displayed_at
   ```

2. **Write migration SQL** (up and down files as shown above)

3. **Run migration**:
   ```bash
   cargo sqlx migrate run
   ```

4. **Update backend Question model** in `models/question.rs`:
   - Add `displayed_at: Option<DateTime<Utc>>` field

5. **Update WebSocket message types** in `ws/messages.rs`:
   - Add `displayed_at` to `ServerMessage::Question`

6. **Update backend WebSocket handler** in `ws/handler.rs`:
   - Set `displayed_at` in database when question is displayed
   - Add eligibility validation in answer handler
   - Return error message for ineligible participants

7. **Update frontend WebSocket hook** in `useEventWebSocket.ts`:
   - Store `displayed_at` in question state
   - Handle error messages

8. **Update AnswerSelection component**:
   - Add eligibility check logic
   - Disable answer buttons for ineligible participants
   - Display warning message with explanation

9. **Update EventParticipant page**:
   - Pass `questionDisplayedAt` and `participantJoinedAt` to AnswerSelection

10. **Test the implementation**:
    - Start a segment quiz
    - Display first question
    - Join with new participant while question is showing
    - Verify late joiner cannot answer current question
    - Verify late joiner can answer next question
    - Verify error message appears in UI

## Acceptance Criteria

- [ ] Migration adds `displayed_at` column to questions table
- [ ] Index created on `displayed_at` for performance
- [ ] Backend sets `displayed_at` when question is broadcast
- [ ] Backend validates participant joined_at vs question displayed_at
- [ ] Backend returns error for ineligible answer attempts
- [ ] ServerMessage::Question includes `displayed_at` timestamp
- [ ] Frontend receives and stores `displayed_at` in question state
- [ ] Frontend calculates eligibility client-side
- [ ] AnswerSelection disables buttons for ineligible participants
- [ ] Warning message displays for ineligible participants
- [ ] Error message handled gracefully in UI
- [ ] 500ms buffer applied for edge cases
- [ ] Late joiners can answer subsequent questions
- [ ] No TypeScript compilation errors
- [ ] No Rust compilation errors or warnings

## Testing

### Manual Testing

1. **Setup**: Create event with segment containing 5 questions

2. **Test Case 1: Mid-question join**
   - Participant A joins and connects
   - Host starts quiz
   - Question 1 displays
   - Wait 5 seconds
   - Participant B joins (mid-question)
   - Participant B should see disabled answer buttons
   - Participant B should see warning message
   - Host advances to Question 2
   - Participant B should now be able to answer

3. **Test Case 2: Edge case join (simultaneous)**
   - Reset quiz
   - Host displays question
   - Participant C joins within 500ms of display
   - Participant C should be eligible (buffer allows)

4. **Test Case 3: Normal join**
   - Participant D joins before quiz starts
   - Host starts quiz
   - Question 1 displays
   - Participant D can answer normally

5. **Test Case 4: Server-side enforcement**
   - Use browser dev tools to bypass client-side check
   - Attempt to submit answer as ineligible participant
   - Verify server rejects with error message
   - Verify no score is awarded

### Database Verification

```sql
-- Check displayed_at is set when questions are shown
SELECT id, question_text, displayed_at FROM questions WHERE displayed_at IS NOT NULL;

-- Check participant join times
SELECT u.username, ep.joined_at FROM event_participants ep
INNER JOIN users u ON ep.user_id = u.id;

-- Verify eligibility calculation
SELECT
    u.username,
    ep.joined_at,
    q.displayed_at,
    ep.joined_at <= q.displayed_at as is_eligible
FROM event_participants ep
INNER JOIN users u ON ep.user_id = u.id
CROSS JOIN questions q
WHERE q.displayed_at IS NOT NULL;
```

### Unit Tests

```bash
# Backend tests
cd backend
cargo test question_eligibility
cargo test late_join_answer_validation

# Frontend tests
cd frontend
npm test -- AnswerSelection
npm test -- useEventWebSocket
```

### Test Edge Cases

- Join exactly when question displays (within 500ms buffer)
- Network latency causing delayed join timestamp
- Multiple questions in sequence with late join on Q2
- Participant rejoins after disconnect during question
- Question displayed_at is null (defensive coding)

## Dependencies

- **TICKET-001**: Device/Session Identity - Database
  - Requires participant tracking with joined_at timestamp
- **TICKET-016**: Join State Awareness - Database
  - Requires segment participation tracking
- **TICKET-017**: Join State Awareness - State Transitions
  - Requires participant join time tracking

## Related Tickets

- TICKET-019: Late Joiner Indicators - Leaderboard Marking
  - Complementary feature: this prevents answers, TICKET-019 marks participants
- TICKET-013: Network Loss - Disconnect Tracking
  - Related: rejoins after disconnect should use original join time
- TICKET-015: Network Loss - Reconnect Flow
  - Related: reconnection should preserve original eligibility

## Notes

### Design Decisions

- **500ms buffer**: Allows for network latency and near-simultaneous join/display
  - Alternative: No buffer, strict enforcement
  - Chosen approach is more user-friendly
- **Per-question eligibility**: More granular than segment-level
  - Prevents gaming the system by joining mid-question
  - Fairer than allowing late joiners to answer current question
- **Client + server validation**: Defense in depth
  - Client-side for UX (immediate feedback)
  - Server-side for security (cannot be bypassed)
- **Error message strategy**: Send only to ineligible participant
  - Doesn't broadcast to all participants
  - Doesn't clutter other users' experience

### Edge Cases

- **Question with no displayed_at**: Allow answer (defensive coding)
- **Participant with no joined_at**: Reject answer (defensive coding)
- **Buffer window**: 500ms is generous but prevents false positives
- **Reconnection**: Preserve original joined_at, not reconnect time (TICKET-015)
- **Multiple segments**: Each segment's questions have independent displayed_at

### Future Enhancements

- Show countdown to next question for ineligible participants
- Display "You'll be eligible for the next question in X seconds"
- Analytics: track how many participants join mid-question
- Configurable buffer duration (per-event setting)

### Performance Considerations

- Index on `questions.displayed_at` enables fast eligibility checks
- Single additional DB query per answer submission (minimal overhead)
- Client-side eligibility check reduces unnecessary server requests
- Error sent only to single participant (no broadcast overhead)

### Security Considerations

- Server-side validation prevents bypassing client-side checks
- Session token validation ensures participant identity
- Timestamp comparison uses server time (cannot be spoofed by client)
- No race conditions: participant join time locked on first insert

### UX Considerations

- Clear warning message explains why buttons are disabled
- Visual differentiation (disabled buttons, alert icon)
- Positive message: "You can answer the next question"
- No punitive language (informational tone)
- Timer still visible to help participant understand countdown
