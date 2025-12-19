# TICKET-021: Late Join Presentation Enforcement

**Priority:** 🟡 MEDIUM
**Effort:** 2 hours
**Status:** Pending
**Depends On:** TICKET-001, TICKET-016, TICKET-017

---

## Description

Prevent participants who join during a presentation segment (before the quiz starts) from answering questions. Late joiners can only start answering from the next question that appears after they join, ensuring they don't answer questions they didn't see presented.

This ticket enforces quiz fairness by tracking when participants join relative to when each question is displayed. Unlike TICKET-019 which marks late joiners on the leaderboard, this ticket actively prevents them from submitting answers to questions they missed.

## Problem Statement

Currently, participants who join during an active quiz can answer the current question even if it was displayed before they connected. This is unfair because:
- They didn't see the presentation/context for the question
- They didn't experience the time pressure from the beginning
- They can join mid-question and immediately answer

The system should track question display times and prevent answers from participants who joined after the question was shown.

## Files to Modify

### 1. `backend/migrations/<timestamp>_add_question_display_tracking.up.sql`

```sql
-- Track when each question was displayed during the quiz
ALTER TABLE questions
ADD COLUMN displayed_at TIMESTAMPTZ;

-- Create index for efficient lookups during answer validation
CREATE INDEX idx_questions_displayed_at ON questions(displayed_at);
```

### 2. `backend/migrations/<timestamp>_add_question_display_tracking.down.sql`

```sql
-- Revert changes
DROP INDEX IF EXISTS idx_questions_displayed_at;

ALTER TABLE questions
DROP COLUMN displayed_at;
```

### 3. `backend/src/ws/handler.rs`

Add validation logic to prevent late joiners from answering missed questions:

```rust
// In handle_next_question function (around line 350-400)
// Set displayed_at timestamp when question is shown
GameMessage::NextQuestion => {
    // ... existing validation code ...

    if let Some(question) = game_state.questions.get(current_index) {
        // Record when this question was displayed
        let _ = sqlx::query(
            "UPDATE questions SET displayed_at = NOW() WHERE id = $1"
        )
        .bind(question.id)
        .execute(&state.db)
        .await;

        // ... rest of existing next_question logic ...
    }
}

// In handle_start_game function (around line 250-300)
// Set displayed_at for the first question
GameMessage::StartGame => {
    // ... existing validation code ...

    // Set displayed_at for first question
    if let Some(first_question) = game_state.questions.first() {
        let _ = sqlx::query(
            "UPDATE questions SET displayed_at = NOW() WHERE id = $1"
        )
        .bind(first_question.id)
        .execute(&state.db)
        .await;
    }

    // ... rest of existing start_game logic ...
}

// In handle_answer function (around line 650-750)
// Add late joiner validation before processing answer
GameMessage::Answer { question_id, answer_index } => {
    // ... existing validation code ...

    // Get participant join time and question display time
    let validation_result = sqlx::query_as::<_, (Option<chrono::DateTime<chrono::Utc>>, Option<chrono::DateTime<chrono::Utc>>)>(
        r#"
        SELECT ss.joined_at, q.displayed_at
        FROM segment_scores ss
        CROSS JOIN questions q
        WHERE ss.segment_id = $1
          AND ss.user_id = $2
          AND q.id = $3
        "#
    )
    .bind(segment_id)
    .bind(uid)
    .bind(question_id)
    .fetch_optional(&state.db)
    .await;

    match validation_result {
        Ok(Some((Some(joined_at), Some(displayed_at)))) => {
            // Check if participant joined after question was displayed
            if joined_at > displayed_at {
                // Send error to participant
                let error_msg = ServerMessage::Error {
                    message: "You can start answering with the next question".to_string(),
                    code: Some("LATE_JOIN_ANSWER_BLOCKED".to_string()),
                };

                if let Err(e) = participant_tx.send(error_msg).await {
                    error!("Failed to send late join error to participant {}: {}", uid, e);
                }

                return Ok(());
            }
        }
        Ok(Some((None, _))) => {
            // No joined_at record - this is their first answer, allow it
            // The joined_at will be set when we insert into segment_scores
        }
        Ok(Some((_, None))) => {
            error!("Question {} has no displayed_at timestamp", question_id);
            // Continue processing - don't block on missing metadata
        }
        Ok(None) => {
            error!("Could not fetch validation data for user {} question {}", uid, question_id);
            // Continue processing - fail open
        }
        Err(e) => {
            error!("Database error during late join validation: {}", e);
            // Continue processing - fail open
        }
    }

    // ... rest of existing answer processing logic ...
}
```

### 4. `backend/src/ws/messages.rs`

Add new error code for late join answer blocking:

```rust
// Update ServerMessage enum with new error variant
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing variants ...

    /// Error message with optional error code
    Error {
        message: String,
        #[serde(skip_serializing_if = "Option::is_none")]
        code: Option<String>,
    },

    // ... rest of variants ...
}

// Document error codes in a comment or constant
/// Known error codes:
/// - LATE_JOIN_ANSWER_BLOCKED: Participant tried to answer question displayed before they joined
/// - INVALID_ANSWER: Answer index out of bounds
/// - ALREADY_ANSWERED: Participant already answered this question
/// - GAME_NOT_STARTED: Quiz has not started yet
```

### 5. `backend/src/models/event.rs`

Add response types for segment state with quiz start time:

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct SegmentResponse {
    pub id: Uuid,
    pub event_id: Uuid,
    pub title: String,
    pub presenter_id: Uuid,
    pub presenter_username: String,
    pub order_index: i32,
    pub audio_file_url: Option<String>,
    pub transcript: Option<String>,
    pub created_at: DateTime<Utc>,

    /// Timestamp when the quiz phase started for this segment
    /// Used to determine if participants joined before or after quiz start
    #[serde(skip_serializing_if = "Option::is_none")]
    pub quiz_start_time: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentWithQuestions {
    #[serde(flatten)]
    pub segment: SegmentResponse,
    pub questions: Vec<QuestionResponse>,
}
```

### 6. `frontend/src/api/endpoints.ts`

Update segment response interface:

```typescript
export interface SegmentResponse {
  id: string
  event_id: string
  title: string
  presenter_id: string
  presenter_username: string
  order_index: number
  audio_file_url?: string
  transcript?: string
  created_at: string
  quiz_start_time?: string // ISO 8601 timestamp
}

export interface SegmentWithQuestions {
  id: string
  event_id: string
  title: string
  presenter_id: string
  presenter_username: string
  order_index: number
  audio_file_url?: string
  transcript?: string
  created_at: string
  quiz_start_time?: string
  questions: QuestionResponse[]
}

// Add error code type
export type ErrorCode =
  | 'LATE_JOIN_ANSWER_BLOCKED'
  | 'INVALID_ANSWER'
  | 'ALREADY_ANSWERED'
  | 'GAME_NOT_STARTED'
```

### 7. `frontend/src/hooks/useEventWebSocket.ts`

Handle late join error messages and track join state:

```typescript
import { useEffect, useRef, useState, useCallback } from 'react'
import type { LeaderboardEntry, QuestionResponse, ErrorCode } from '@/api/endpoints'

interface ServerMessage {
  type: string
  // ... existing fields ...
  message?: string
  code?: ErrorCode
}

export function useEventWebSocket(eventId: string, userId: string) {
  // ... existing state ...
  const [isLateJoiner, setIsLateJoiner] = useState(false)
  const [lateJoinMessage, setLateJoinMessage] = useState<string | null>(null)
  const [canAnswerCurrent, setCanAnswerCurrent] = useState(true)

  useEffect(() => {
    // ... existing connection setup ...

    ws.onmessage = (event) => {
      const message: ServerMessage = JSON.parse(event.data)

      switch (message.type) {
        case 'error':
          if (message.code === 'LATE_JOIN_ANSWER_BLOCKED') {
            // Show late join message and disable current question
            setIsLateJoiner(true)
            setLateJoinMessage(message.message || 'You can start answering with the next question')
            setCanAnswerCurrent(false)
          } else {
            // Handle other errors normally
            console.error('WebSocket error:', message.message)
          }
          break

        case 'question':
          // Reset late join restrictions on new question
          if (isLateJoiner) {
            setCanAnswerCurrent(true)
            // Keep the banner for one more question cycle
            setTimeout(() => {
              setIsLateJoiner(false)
              setLateJoinMessage(null)
            }, 3000)
          }
          setCurrentQuestion(message as any)
          setSelectedAnswer(null)
          setHasAnswered(false)
          break

        // ... rest of message handlers ...
      }
    }

    // ... rest of useEffect ...
  }, [eventId, userId])

  return {
    // ... existing return values ...
    isLateJoiner,
    lateJoinMessage,
    canAnswerCurrent,
  }
}
```

### 8. `frontend/src/pages/EventParticipant.tsx`

Display late join banner and disable answer submission:

```tsx
import { useEventWebSocket } from '@/hooks/useEventWebSocket'
import { Clock, AlertCircle } from 'lucide-react'

export function EventParticipant() {
  const { eventId } = useParams()
  const { user } = useAuthStore()

  const {
    currentQuestion,
    selectedAnswer,
    hasAnswered,
    isLateJoiner,
    lateJoinMessage,
    canAnswerCurrent,
    sendAnswer,
    // ... other values ...
  } = useEventWebSocket(eventId!, user!.id)

  // ... existing state and handlers ...

  return (
    <div className="min-h-screen bg-dark-950 text-white p-6">
      {/* Late Join Banner */}
      {isLateJoiner && lateJoinMessage && (
        <div className="max-w-4xl mx-auto mb-6">
          <div className="bg-yellow-500/10 border-2 border-yellow-500/40 rounded-lg p-4 flex items-start gap-3">
            <Clock className="w-6 h-6 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-semibold text-yellow-300">Joined During Quiz</span>
              </div>
              <p className="text-sm text-gray-300">
                {lateJoinMessage}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        {phase === 'showing_question' && currentQuestion && (
          <div className="space-y-6">
            {/* Question Display */}
            <QuestionDisplay
              question={currentQuestion}
              timeRemaining={timeRemaining}
            />

            {/* Answer Selection - disabled for late joiners on current question */}
            {!canAnswerCurrent && !hasAnswered && (
              <div className="bg-dark-800/60 border-2 border-yellow-500/30 rounded-lg p-6">
                <div className="flex items-center justify-center gap-3 text-gray-400">
                  <AlertCircle className="w-6 h-6" />
                  <p className="text-lg">
                    You can start answering with the next question
                  </p>
                </div>
              </div>
            )}

            {canAnswerCurrent && !hasAnswered && (
              <AnswerSelection
                answers={currentQuestion.answers}
                selectedAnswer={selectedAnswer}
                onSelectAnswer={(index) => {
                  setSelectedAnswer(index)
                  sendAnswer(currentQuestion.id, index)
                }}
                disabled={hasAnswered || !canAnswerCurrent}
              />
            )}

            {hasAnswered && (
              <div className="bg-accent-cyan/10 border border-accent-cyan/30 rounded-lg p-4 text-center">
                <p className="text-accent-cyan font-semibold">
                  Answer submitted! Waiting for others...
                </p>
              </div>
            )}
          </div>
        )}

        {/* ... rest of component ... */}
      </div>
    </div>
  )
}
```

### 9. `frontend/src/components/quiz/AnswerSelection.tsx`

Add visual disabled state for late joiners:

```tsx
import { cn } from '@/lib/utils'

interface AnswerSelectionProps {
  answers: string[]
  selectedAnswer: number | null
  onSelectAnswer: (index: number) => void
  disabled?: boolean
}

export function AnswerSelection({
  answers,
  selectedAnswer,
  onSelectAnswer,
  disabled = false,
}: AnswerSelectionProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {answers.map((answer, index) => (
        <button
          key={index}
          onClick={() => !disabled && onSelectAnswer(index)}
          disabled={disabled}
          className={cn(
            'p-6 rounded-lg border-2 transition-all text-left',
            'focus:outline-none focus:ring-2 focus:ring-accent-cyan/50',
            disabled
              ? 'bg-dark-800/30 border-gray-700 text-gray-500 cursor-not-allowed opacity-50'
              : selectedAnswer === index
              ? 'bg-accent-cyan/20 border-accent-cyan text-white'
              : 'bg-dark-800 border-dark-700 text-white hover:border-accent-cyan/50 hover:bg-dark-700'
          )}
        >
          <div className="flex items-start gap-3">
            <span className={cn(
              'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center font-bold',
              disabled
                ? 'bg-gray-700 text-gray-500'
                : selectedAnswer === index
                ? 'bg-accent-cyan text-dark-900'
                : 'bg-dark-700 text-gray-400'
            )}>
              {String.fromCharCode(65 + index)}
            </span>
            <span className="flex-1 text-lg">{answer}</span>
          </div>
        </button>
      ))}
    </div>
  )
}
```

## Implementation Steps

1. **Create database migration**:
   ```bash
   cd backend
   sqlx migrate add -r add_question_display_tracking
   ```

2. **Write migration SQL** (up and down files as shown above)

3. **Run migration**:
   ```bash
   cargo sqlx migrate run
   ```

4. **Update backend WebSocket handler** in `ws/handler.rs`:
   - Set `displayed_at` in `StartGame` handler for first question
   - Set `displayed_at` in `NextQuestion` handler for subsequent questions
   - Add validation in `Answer` handler to check join time vs display time
   - Send appropriate error message for blocked answers

5. **Update backend models** in `models/event.rs`:
   - Add `quiz_start_time` field to `SegmentResponse`
   - Update serialization to include timestamp

6. **Update backend message types** in `ws/messages.rs`:
   - Add error code field to `Error` variant
   - Document known error codes

7. **Update frontend TypeScript types**:
   - Add `quiz_start_time` to `SegmentResponse` interface
   - Add `ErrorCode` type for known error codes
   - Update `SegmentWithQuestions` interface

8. **Update frontend WebSocket hook** in `useEventWebSocket.ts`:
   - Add state for late join tracking
   - Handle `LATE_JOIN_ANSWER_BLOCKED` error code
   - Reset restrictions on new questions
   - Return late join state to components

9. **Update participant UI** in `EventParticipant.tsx`:
   - Display late join banner with clock icon
   - Show disabled state when `canAnswerCurrent` is false
   - Add informational message about next question

10. **Update answer selection component**:
    - Add `disabled` prop
    - Apply disabled styling
    - Prevent click events when disabled

11. **Test the implementation** (see Testing section below)

## Acceptance Criteria

- [ ] Migration adds `displayed_at` column to questions table
- [ ] Index created for efficient validation queries
- [ ] Backend sets `displayed_at` when first question shown (StartGame)
- [ ] Backend sets `displayed_at` when subsequent questions shown (NextQuestion)
- [ ] Backend validates join time vs display time before accepting answer
- [ ] Late join answer attempts return error with `LATE_JOIN_ANSWER_BLOCKED` code
- [ ] Error message is "You can start answering with the next question"
- [ ] Frontend receives and handles late join error
- [ ] Late join banner displays with clock icon and explanation
- [ ] Answer buttons are disabled when `canAnswerCurrent` is false
- [ ] Disabled state has visual indication (grayed out, cursor not-allowed)
- [ ] Late joiner can answer when next question appears
- [ ] Banner auto-dismisses after participant answers next question
- [ ] No TypeScript compilation errors
- [ ] No Rust compilation errors or warnings
- [ ] `quiz_start_time` included in segment responses

## Testing

### Manual Testing

1. **Setup**: Create event with 1 segment containing 3 questions

2. **Test Late Join During Presentation**:
   - Participant A joins and connects
   - Host starts quiz (displays Q1)
   - Participant B joins late (after Q1 displayed)
   - Participant B attempts to answer Q1
   - **Verify**: Answer blocked, banner shows "You can start answering with the next question"
   - **Verify**: Answer buttons are grayed out and disabled
   - Host advances to Q2
   - **Verify**: Participant B can now answer Q2
   - **Verify**: Banner auto-dismisses after answering

3. **Test Multiple Late Joiners**:
   - Participant A joins before quiz
   - Host starts quiz (Q1 displayed)
   - Participant B joins (after Q1)
   - Host advances to Q2
   - Participant C joins (after Q2)
   - **Verify**: Participant A can answer all questions
   - **Verify**: Participant B can answer Q2+, blocked on Q1
   - **Verify**: Participant C can answer Q3+, blocked on Q1 and Q2

4. **Test Early Join (Not Late)**:
   - Participant D joins before quiz starts
   - Host starts quiz
   - **Verify**: Participant D can answer Q1 immediately
   - **Verify**: No late join banner appears

5. **Test Error Handling**:
   - Join late and try to answer missed question
   - **Verify**: WebSocket error message received
   - **Verify**: Error has code "LATE_JOIN_ANSWER_BLOCKED"
   - **Verify**: UI updates to show blocked state
   - **Verify**: No answer recorded in database

### Database Verification

```sql
-- Check displayed_at timestamps are set
SELECT id, question_text, displayed_at
FROM questions
WHERE displayed_at IS NOT NULL
ORDER BY displayed_at;

-- Check join times vs display times
SELECT
    u.username,
    ss.joined_at,
    q.question_text,
    q.displayed_at,
    CASE
        WHEN ss.joined_at > q.displayed_at THEN 'BLOCKED'
        ELSE 'ALLOWED'
    END as answer_status
FROM segment_scores ss
INNER JOIN users u ON ss.user_id = u.id
CROSS JOIN questions q
WHERE ss.segment_id = q.segment_id
ORDER BY ss.joined_at, q.displayed_at;

-- Verify no answers recorded for blocked questions
SELECT
    u.username,
    q.question_text,
    a.answer_index,
    ss.joined_at,
    q.displayed_at
FROM answers a
INNER JOIN users u ON a.user_id = u.id
INNER JOIN questions q ON a.question_id = q.id
LEFT JOIN segment_scores ss ON ss.user_id = a.user_id AND ss.segment_id = q.segment_id
WHERE ss.joined_at > q.displayed_at; -- Should return zero rows
```

### Unit Tests

```bash
cd backend
cargo test late_join_answer_validation
cargo test question_display_tracking

cd frontend
npm test -- useEventWebSocket
npm test -- EventParticipant
npm test -- AnswerSelection
```

### Integration Test Scenarios

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_late_join_answer_blocked() {
        // Setup: Create segment with questions
        // Start quiz (sets displayed_at on Q1)
        // Join participant after Q1 displayed
        // Attempt to answer Q1
        // Assert: Answer rejected with LATE_JOIN_ANSWER_BLOCKED error
        // Assert: No answer record in database
    }

    #[tokio::test]
    async fn test_late_joiner_can_answer_next_question() {
        // Setup: Create segment with questions
        // Start quiz (Q1 displayed)
        // Join participant late
        // Attempt to answer Q1 (blocked)
        // Advance to Q2
        // Attempt to answer Q2
        // Assert: Q2 answer accepted
        // Assert: Q2 answer recorded in database
    }

    #[tokio::test]
    async fn test_early_joiner_not_restricted() {
        // Setup: Create segment with questions
        // Join participant before quiz starts
        // Start quiz
        // Attempt to answer Q1
        // Assert: Answer accepted
        // Assert: No late join error
    }
}
```

## Dependencies

- **TICKET-001**: Device/Session Identity - Database
  - Requires participant tracking infrastructure
  - Uses segment_scores table for join time tracking

- **TICKET-016**: Join State Awareness - Database
  - Provides `joined_at` timestamp in segment_scores
  - Foundation for join time comparisons

- **TICKET-017**: Join State Awareness - State Transitions
  - Provides state machine for quiz phases
  - Ensures questions have proper lifecycle tracking

## Related Tickets

- **TICKET-019**: Late Joiner Indicators - Leaderboard Marking
  - Complements this ticket by marking late joiners visually
  - Both use same `joined_at` timestamp infrastructure

- **TICKET-020**: Test Presenter Flow
  - End-to-end testing includes late join scenarios
  - Validates presenter experience with late joiners

## Notes

### Design Decisions

- **Block vs Warn**: Actively prevent answer submission rather than just warning
  - Ensures quiz fairness
  - Prevents confusion about whether answer will count

- **Granular Question Tracking**: Track `displayed_at` per question, not just segment quiz start
  - Allows future enhancement: mid-quiz joins can answer from their join point
  - More precise than segment-level tracking

- **Fail Open**: If validation fails due to DB error, allow answer
  - Prevents blocking participants due to technical issues
  - Log errors for monitoring

- **Error Code System**: Use structured error codes instead of string matching
  - Frontend can handle different error types appropriately
  - Enables localization in future

- **Auto-Dismiss Banner**: Remove banner after participant answers next question
  - Reduces UI clutter once participant is engaged
  - Keeps reminder visible for first missed question

### Edge Cases

- **Participant joins exactly at quiz start**: `joined_at = quiz_start_time`
  - Comparison is `>` not `>=`, so they CAN answer Q1

- **Question displayed_at is NULL**: Fail open and allow answer
  - Log error for investigation
  - Don't block participants due to missing metadata

- **Multiple rapid question changes**: Each NextQuestion sets new displayed_at
  - Late joiners unblocked on each new question
  - No race conditions due to sequential WebSocket handling

- **Network interruption during join**: Reconnection preserves original `joined_at`
  - segment_scores insert uses `ON CONFLICT ... DO UPDATE` without updating joined_at
  - Fair treatment on reconnection

### Future Enhancements

- **Mid-Question Join Timing**: Track exactly when in question timer participant joined
  - Could disable answer if <50% time remaining
  - More granular fairness

- **Partial Credit**: Allow late joiners to answer missed questions for partial points
  - Reduces "all or nothing" penalty
  - Requires scoring system changes

- **Join Cutoff**: Don't allow joins after certain point in quiz
  - Prevents "quiz sniping" (joining at end to see results)
  - Requires product decision on cutoff timing

- **Retroactive Allowance**: Host can manually allow late joiner to answer missed questions
  - Useful for technical issues
  - Requires admin interface

### Performance Considerations

- **Index on displayed_at**: Enables efficient validation queries
  - Each answer requires one indexed lookup
  - Minimal performance impact

- **Validation Query**: Single query combining join time and display time
  - Avoids N+1 query problem
  - Could be optimized further with in-memory cache if needed

- **Error Message Sending**: Individual WebSocket message to blocked participant
  - Doesn't broadcast to all participants
  - No performance impact on quiz flow

### Security Considerations

- **Client Can't Bypass**: Validation happens server-side
  - Client state is informational only
  - Tampering with frontend has no effect

- **SQL Injection**: All queries use parameterized bindings
  - Safe against injection attacks

- **Timing Attacks**: Timestamps from server, not client
  - Client can't manipulate join or display times

### Accessibility

- **Visual + Text**: Banner includes icon and text explanation
  - Not relying solely on color
  - Screen readers can announce message

- **Keyboard Navigation**: Disabled buttons still focusable
  - Focus outline visible
  - Screen reader announces disabled state

- **Clear Messaging**: Plain language explanation
  - "You can start answering with the next question"
  - No jargon or unclear phrasing

### UX Considerations

- **Positive Framing**: "You can answer next question" vs "You're blocked"
  - Encourages continued participation
  - Reduces frustration

- **Visual Consistency**: Uses same clock icon as TICKET-019 leaderboard badge
  - Coherent design language
  - Recognizable late join indicator

- **Progressive Enhancement**: Banner auto-dismisses after engagement
  - Doesn't nag participants
  - Focuses on enabling, not restricting

### Monitoring & Debugging

- **Log Late Join Blocks**: Log each blocked answer attempt
  - Track frequency of late joins
  - Identify if timing windows need adjustment

- **Error Metrics**: Track LATE_JOIN_ANSWER_BLOCKED error rate
  - Alert if unusually high (could indicate bug)
  - Monitor user experience impact

- **Display Time Audit**: Verify displayed_at is always set
  - Alert if questions shown without timestamp
  - Ensures validation works correctly
