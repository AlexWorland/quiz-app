# Multi-Presenter Quiz Flow Implementation Guide

This document provides detailed implementation steps for the multi-presenter quiz features.

## Overview of Features to Implement

1. **Segment-Level Presenter Linking** - Link segments to user accounts
2. **Role Passing System** - Allow presenter to hand off control
3. **Answer Collection & Auto-Reveal** - Detect when all participants answered
4. **Question Results Review Flow** - Structured reveal phase per question
5. **End-of-Segment Leaderboard Display** - Dedicated segment/overall leaderboard screens
6. **Presenter View Unification** - Consistent experience when switching roles

---

## Feature 1: Segment-Level Presenter Linking

### Problem
Currently, segments only store `presenter_name` as a string. There's no link to an actual user account, which means:
- Can't enforce who controls a segment
- Can't pass control to a specific user
- Can't track presenter-specific permissions

### Database Changes

#### Migration: Add presenter_user_id to segments

**File: `backend/migrations/YYYYMMDDHHMMSS_add_segment_presenter_user_id.up.sql`**

```sql
-- Add presenter_user_id column (nullable for backward compatibility)
ALTER TABLE segments
ADD COLUMN presenter_user_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- Create index for efficient lookups
CREATE INDEX idx_segments_presenter_user_id ON segments(presenter_user_id);

-- Update existing segments: try to match presenter_name to user display_name
UPDATE segments s
SET presenter_user_id = u.id
FROM users u
WHERE s.presenter_name = u.display_name
  AND s.presenter_user_id IS NULL;
```

**File: `backend/migrations/YYYYMMDDHHMMSS_add_segment_presenter_user_id.down.sql`**

```sql
DROP INDEX IF EXISTS idx_segments_presenter_user_id;
ALTER TABLE segments DROP COLUMN IF EXISTS presenter_user_id;
```

### Backend Model Changes

**File: `backend/src/models/segment.rs`**

Add the new field to the Segment struct:

```rust
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Segment {
    pub id: Uuid,
    pub event_id: Uuid,
    pub presenter_name: String,
    pub presenter_user_id: Option<Uuid>,  // NEW FIELD
    pub title: Option<String>,
    pub order_index: i32,
    pub status: String,
    pub recording_started_at: Option<DateTime<Utc>>,
    pub recording_ended_at: Option<DateTime<Utc>>,
    pub quiz_started_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
```

### Backend Route Changes

**File: `backend/src/routes/quiz.rs`**

Update segment creation to accept presenter_user_id:

```rust
#[derive(Debug, Deserialize)]
pub struct CreateSegmentRequest {
    pub presenter_name: String,
    pub presenter_user_id: Option<Uuid>,  // NEW FIELD
    pub title: Option<String>,
}

pub async fn create_segment(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Path(event_id): Path<Uuid>,
    Json(req): Json<CreateSegmentRequest>,
) -> Result<Json<Segment>, AppError> {
    // Verify user is event host
    let event = sqlx::query_as::<_, Event>(
        "SELECT * FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    if event.host_id != auth_user.id {
        return Err(AppError::Forbidden("Only event host can create segments".into()));
    }

    // Get next order_index
    let max_order: Option<i32> = sqlx::query_scalar(
        "SELECT MAX(order_index) FROM segments WHERE event_id = $1"
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    let order_index = max_order.map(|m| m + 1).unwrap_or(0);

    let segment = sqlx::query_as::<_, Segment>(
        r#"
        INSERT INTO segments (id, event_id, presenter_name, presenter_user_id, title, order_index, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'pending')
        RETURNING *
        "#
    )
    .bind(Uuid::new_v4())
    .bind(event_id)
    .bind(&req.presenter_name)
    .bind(req.presenter_user_id)  // NEW FIELD
    .bind(&req.title)
    .bind(order_index)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(segment))
}
```

### Frontend API Changes

**File: `frontend/src/api/endpoints.ts`**

Update the segment types and API calls:

```typescript
export interface Segment {
  id: string;
  event_id: string;
  presenter_name: string;
  presenter_user_id?: string;  // NEW FIELD
  title?: string;
  order_index: number;
  status: 'pending' | 'recording' | 'recording_paused' | 'quiz_ready' | 'quizzing' | 'completed';
  recording_started_at?: string;
  recording_ended_at?: string;
  quiz_started_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateSegmentRequest {
  presenter_name: string;
  presenter_user_id?: string;  // NEW FIELD
  title?: string;
}
```

### Frontend UI Changes

**File: `frontend/src/components/segments/SegmentForm.tsx`** (new or update existing)

Add a participant selector when creating segments:

```typescript
interface SegmentFormProps {
  eventId: string;
  participants: Participant[];
  onSubmit: (data: CreateSegmentRequest) => void;
}

export function SegmentForm({ eventId, participants, onSubmit }: SegmentFormProps) {
  const [presenterName, setPresenterName] = useState('');
  const [presenterUserId, setPresenterUserId] = useState<string | undefined>();

  const handleParticipantSelect = (userId: string) => {
    const participant = participants.find(p => p.id === userId);
    if (participant) {
      setPresenterUserId(userId);
      setPresenterName(participant.display_name);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      onSubmit({ presenter_name: presenterName, presenter_user_id: presenterUserId });
    }}>
      <label>Select Presenter</label>
      <select
        value={presenterUserId || ''}
        onChange={(e) => handleParticipantSelect(e.target.value)}
      >
        <option value="">-- Select participant --</option>
        {participants.map(p => (
          <option key={p.id} value={p.id}>{p.display_name}</option>
        ))}
      </select>

      <label>Or enter name manually</label>
      <input
        value={presenterName}
        onChange={(e) => setPresenterName(e.target.value)}
        placeholder="Presenter name"
      />

      <button type="submit">Create Segment</button>
    </form>
  );
}
```

### Authorization Helper

**File: `backend/src/ws/handler.rs`**

Add a helper function to check segment presenter authorization:

```rust
/// Check if user is authorized to control the current segment
/// Returns true if user is event host OR segment presenter
async fn is_segment_controller(
    db: &PgPool,
    event_id: Uuid,
    segment_id: Uuid,
    user_id: Uuid,
) -> Result<bool, AppError> {
    let result = sqlx::query_scalar::<_, bool>(
        r#"
        SELECT EXISTS(
            SELECT 1 FROM events e
            LEFT JOIN segments s ON s.event_id = e.id
            WHERE e.id = $1
              AND s.id = $2
              AND (e.host_id = $3 OR s.presenter_user_id = $3)
        )
        "#
    )
    .bind(event_id)
    .bind(segment_id)
    .bind(user_id)
    .fetch_one(db)
    .await?;

    Ok(result)
}
```

---

## Feature 2: Role Passing System

### Problem
No mechanism exists for a presenter to hand off control to another participant.

### WebSocket Message Types

**File: `backend/src/ws/messages.rs`**

```rust
// Add to GameMessage enum (client → server)
#[derive(Debug, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum GameMessage {
    // ... existing variants ...

    /// Current presenter passes control to another user
    PassPresenter {
        next_presenter_user_id: Uuid,
    },
}

// Add to ServerMessage enum (server → client)
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing variants ...

    /// Notify all clients that presenter has changed
    PresenterChanged {
        previous_presenter_id: Uuid,
        new_presenter_id: Uuid,
        new_presenter_name: String,
        segment_id: Uuid,
    },
}
```

### WebSocket Handler

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::PassPresenter { next_presenter_user_id } => {
    // 1. Verify sender is current segment presenter or event host
    let game_state = hub.get_game_state(&event_id).await?;
    let segment_id = game_state.current_segment_id
        .ok_or(AppError::BadRequest("No active segment"))?;

    if !is_segment_controller(&state.db, event_id, segment_id, user_id).await? {
        return Err(AppError::Forbidden("Not authorized to pass presenter"));
    }

    // 2. Verify next presenter is a participant in this event
    let next_presenter = sqlx::query_as::<_, User>(
        "SELECT u.* FROM users u
         JOIN event_participants ep ON ep.user_id = u.id
         WHERE ep.event_id = $1 AND u.id = $2"
    )
    .bind(event_id)
    .bind(next_presenter_user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(AppError::NotFound("User not in event"))?;

    // 3. Update segment presenter_user_id
    sqlx::query(
        "UPDATE segments SET presenter_user_id = $1 WHERE id = $2"
    )
    .bind(next_presenter_user_id)
    .bind(segment_id)
    .execute(&state.db)
    .await?;

    // 4. Broadcast presenter change to all clients
    hub.broadcast(&event_id, ServerMessage::PresenterChanged {
        previous_presenter_id: user_id,
        new_presenter_id: next_presenter_user_id,
        new_presenter_name: next_presenter.display_name,
        segment_id,
    }).await;
}
```

### Frontend State Updates

**File: `frontend/src/pages/EventParticipant.tsx`**

```typescript
// Add to WebSocket message handler
case 'presenter_changed': {
  const { new_presenter_id, new_presenter_name } = message;
  setCurrentPresenterId(new_presenter_id);
  setCurrentPresenterName(new_presenter_name);

  // Check if current user is now the presenter
  if (new_presenter_id === user?.id) {
    setIsPresenter(true);
    toast.success("You are now the presenter");
  } else {
    setIsPresenter(false);
  }
  break;
}
```

### Frontend UI - Pass Control Button

**File: `frontend/src/components/quiz/PassPresenterButton.tsx`** (new file)

```typescript
interface PassPresenterButtonProps {
  participants: Participant[];
  currentUserId: string;
  onPass: (nextPresenterId: string) => void;
}

export function PassPresenterButton({
  participants,
  currentUserId,
  onPass
}: PassPresenterButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  const eligibleParticipants = participants.filter(p => p.id !== currentUserId);

  return (
    <div className="relative">
      <Button onClick={() => setIsOpen(!isOpen)}>
        Pass Presenter Role
      </Button>

      {isOpen && (
        <div className="absolute mt-2 bg-white shadow-lg rounded p-2">
          <p className="text-sm text-gray-600 mb-2">Select next presenter:</p>
          {eligibleParticipants.map(p => (
            <button
              key={p.id}
              onClick={() => { onPass(p.id); setIsOpen(false); }}
              className="block w-full text-left px-3 py-2 hover:bg-gray-100"
            >
              {p.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
```

---

## Feature 3: Answer Collection & Auto-Reveal

### Problem
Currently, the presenter must manually click "Reveal Answer." There's no detection of when all participants have answered.

### Backend: Track Answer Count

**File: `backend/src/ws/hub.rs`**

Add tracking to GameState:

```rust
pub struct GameState {
    // ... existing fields ...
    pub total_participants: usize,  // NEW: count of non-presenter participants
    pub answers_received: HashMap<Uuid, String>,  // existing
}

impl GameState {
    pub fn all_answered(&self) -> bool {
        // Check if all non-presenter participants have answered
        self.answers_received.len() >= self.total_participants
    }
}
```

### Backend: Notify Presenter When All Answered

**File: `backend/src/ws/messages.rs`**

```rust
// Add new server message
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing ...

    /// Sent to presenter when all participants have answered
    AllAnswered {
        answer_count: usize,
        total_participants: usize,
    },
}
```

**File: `backend/src/ws/handler.rs`**

Update answer handling:

```rust
GameMessage::Answer { question_id, selected_answer, response_time_ms } => {
    // ... existing answer processing ...

    // Record answer in game state
    hub.record_answer(&event_id, user_id, &selected_answer).await;

    // Check if all participants answered
    let game_state = hub.get_game_state(&event_id).await?;
    if game_state.all_answered() {
        // Notify presenter that all answers are in
        let presenter_id = get_segment_presenter_id(&state.db, segment_id).await?;
        hub.send_to_user(&event_id, presenter_id, ServerMessage::AllAnswered {
            answer_count: game_state.answers_received.len(),
            total_participants: game_state.total_participants,
        }).await;
    }
}
```

### Backend: Update Participant Count on Join/Leave

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::Join { user_id, session_code } => {
    // ... existing join logic ...

    // Update participant count (exclude presenter)
    let presenter_id = get_current_presenter_id(&state.db, event_id).await?;
    if user_id != presenter_id {
        hub.increment_participant_count(&event_id).await;
    }
}

// On disconnect
pub async fn handle_disconnect(hub: &Hub, event_id: Uuid, user_id: Uuid) {
    let presenter_id = /* get presenter */;
    if user_id != presenter_id {
        hub.decrement_participant_count(&event_id).await;
    }
}
```

### Frontend: Show Answer Progress

**File: `frontend/src/components/quiz/AnswerProgress.tsx`** (new file)

```typescript
interface AnswerProgressProps {
  answeredCount: number;
  totalParticipants: number;
  allAnswered: boolean;
}

export function AnswerProgress({
  answeredCount,
  totalParticipants,
  allAnswered
}: AnswerProgressProps) {
  const percentage = totalParticipants > 0
    ? (answeredCount / totalParticipants) * 100
    : 0;

  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span>Answers received</span>
        <span>{answeredCount} / {totalParticipants}</span>
      </div>

      <div className="w-full bg-gray-200 rounded-full h-3">
        <div
          className={`h-3 rounded-full transition-all ${
            allAnswered ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {allAnswered && (
        <p className="text-green-600 font-medium text-center">
          All participants have answered
        </p>
      )}
    </div>
  );
}
```

### Frontend: Presenter View Integration

**File: `frontend/src/pages/EventHost.tsx`**

```typescript
// Add state
const [answeredCount, setAnsweredCount] = useState(0);
const [allAnswered, setAllAnswered] = useState(false);

// Handle WebSocket messages
case 'answer_received': {
  setAnsweredCount(prev => prev + 1);
  break;
}

case 'all_answered': {
  setAllAnswered(true);
  // Optional: auto-reveal after short delay
  // setTimeout(() => handleRevealAnswer(), 2000);
  break;
}

// Reset on new question
case 'question': {
  setAnsweredCount(0);
  setAllAnswered(false);
  // ... existing logic
  break;
}
```

---

## Feature 4: Question Results Review Flow

### Problem
Need a structured flow: Question → Wait for answers → Reveal correct answer → Show stats → Next question.

### Quiz State Machine

**File: `backend/src/ws/hub.rs`**

```rust
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub enum QuizPhase {
    NotStarted,
    ShowingQuestion,    // Participants answering
    RevealingAnswer,    // Showing correct answer + distribution
    ShowingLeaderboard, // Post-question leaderboard
    BetweenQuestions,   // Transition state
    SegmentComplete,    // All questions in segment done
    EventComplete,      // All segments done
}

pub struct GameState {
    // ... existing fields ...
    pub quiz_phase: QuizPhase,
}
```

### WebSocket Messages for Phase Control

**File: `backend/src/ws/messages.rs`**

```rust
// Server messages
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing ...

    /// Current quiz phase changed
    PhaseChanged {
        phase: QuizPhase,
        question_index: i32,
        total_questions: i32,
    },

    /// Question with enhanced metadata
    Question {
        question_id: Uuid,
        question_number: i32,    // NEW: 1-indexed for display
        total_questions: i32,    // NEW: total in segment
        text: String,
        answers: Vec<String>,
        time_limit: i32,
    },

    /// Enhanced reveal with question context
    Reveal {
        question_id: Uuid,
        question_number: i32,
        question_text: String,  // NEW: include question for context
        correct_answer: String,
        distribution: Vec<AnswerDistribution>,
        segment_leaderboard: Vec<LeaderboardEntry>,
        event_leaderboard: Vec<LeaderboardEntry>,
    },
}
```

### Presenter Controls Component

**File: `frontend/src/components/quiz/PresenterControls.tsx`** (new file)

```typescript
interface PresenterControlsProps {
  phase: QuizPhase;
  questionIndex: number;
  totalQuestions: number;
  allAnswered: boolean;
  onRevealAnswer: () => void;
  onShowLeaderboard: () => void;
  onNextQuestion: () => void;
  onEndQuiz: () => void;
}

export function PresenterControls({
  phase,
  questionIndex,
  totalQuestions,
  allAnswered,
  onRevealAnswer,
  onShowLeaderboard,
  onNextQuestion,
  onEndQuiz
}: PresenterControlsProps) {
  const isLastQuestion = questionIndex >= totalQuestions - 1;

  return (
    <div className="bg-gray-800 p-4 rounded-lg space-y-4">
      <div className="text-white text-sm">
        Question {questionIndex + 1} of {totalQuestions}
      </div>

      {phase === 'showing_question' && (
        <Button
          onClick={onRevealAnswer}
          variant={allAnswered ? 'primary' : 'secondary'}
          className="w-full"
        >
          {allAnswered ? 'Reveal Answer (All answered)' : 'Reveal Answer'}
        </Button>
      )}

      {phase === 'revealing_answer' && (
        <Button onClick={onShowLeaderboard} className="w-full">
          Show Leaderboard
        </Button>
      )}

      {phase === 'showing_leaderboard' && (
        <Button
          onClick={isLastQuestion ? onEndQuiz : onNextQuestion}
          className="w-full"
        >
          {isLastQuestion ? 'End Quiz' : 'Next Question'}
        </Button>
      )}
    </div>
  );
}
```

### Participant View - Phase-Aware Display

**File: `frontend/src/components/quiz/ParticipantQuizView.tsx`** (new file)

```typescript
interface ParticipantQuizViewProps {
  phase: QuizPhase;
  question: Question | null;
  revealData: RevealData | null;
  leaderboard: LeaderboardEntry[];
  hasAnswered: boolean;
  onAnswer: (answer: string) => void;
}

export function ParticipantQuizView({
  phase,
  question,
  revealData,
  leaderboard,
  hasAnswered,
  onAnswer
}: ParticipantQuizViewProps) {
  switch (phase) {
    case 'showing_question':
      return (
        <div>
          <QuestionDisplay question={question} />
          {hasAnswered ? (
            <WaitingMessage text="Waiting for other participants..." />
          ) : (
            <AnswerSelection
              answers={question?.answers || []}
              onSelect={onAnswer}
            />
          )}
        </div>
      );

    case 'revealing_answer':
      return (
        <div>
          <QuestionDisplay question={question} showCorrect />
          <AnswerDistributionChart data={revealData?.distribution} />
          <p className="text-center mt-4">
            Correct: {revealData?.correct_answer}
          </p>
        </div>
      );

    case 'showing_leaderboard':
      return (
        <div>
          <h2 className="text-xl font-bold mb-4">Current Standings</h2>
          <SegmentLeaderboard entries={leaderboard} />
        </div>
      );

    case 'between_questions':
      return <WaitingMessage text="Next question coming up..." />;

    default:
      return <WaitingMessage text="Waiting for presenter..." />;
  }
}
```

### Backend Phase Transitions

**File: `backend/src/ws/handler.rs`**

```rust
// On RevealAnswer
GameMessage::RevealAnswer => {
    // ... existing reveal logic ...

    // Update phase
    hub.set_quiz_phase(&event_id, QuizPhase::RevealingAnswer).await;

    // Broadcast phase change
    hub.broadcast(&event_id, ServerMessage::PhaseChanged {
        phase: QuizPhase::RevealingAnswer,
        question_index: game_state.current_question_index,
        total_questions,
    }).await;

    // Then send reveal data
    hub.broadcast(&event_id, ServerMessage::Reveal { ... }).await;
}

// On ShowLeaderboard
GameMessage::ShowLeaderboard => {
    hub.set_quiz_phase(&event_id, QuizPhase::ShowingLeaderboard).await;
    // ... existing leaderboard logic ...
}

// On NextQuestion
GameMessage::NextQuestion => {
    hub.set_quiz_phase(&event_id, QuizPhase::ShowingQuestion).await;
    hub.clear_answers(&event_id).await;
    // ... existing next question logic ...
}
```

---

## Feature 5: End-of-Segment Leaderboard Display

### Problem
At the end of a segment, the presenter needs to show:
1. Segment leaderboard (winner of this presentation)
2. Overall event leaderboard (cumulative standings)

### WebSocket Messages

**File: `backend/src/ws/messages.rs`**

```rust
#[derive(Debug, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    // ... existing ...

    /// End of segment results
    SegmentComplete {
        segment_id: Uuid,
        segment_title: String,
        presenter_name: String,
        segment_leaderboard: Vec<LeaderboardEntry>,
        event_leaderboard: Vec<LeaderboardEntry>,
        segment_winner: Option<LeaderboardEntry>,
        event_leader: Option<LeaderboardEntry>,
    },

    /// Final event results
    EventComplete {
        event_id: Uuid,
        final_leaderboard: Vec<LeaderboardEntry>,
        winner: Option<LeaderboardEntry>,
        segment_winners: Vec<SegmentWinner>,
    },
}

#[derive(Debug, Serialize)]
pub struct SegmentWinner {
    pub segment_id: Uuid,
    pub segment_title: String,
    pub winner_name: String,
    pub winner_score: i32,
}
```

### Backend Handler - Segment Complete

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::EndQuiz => {
    // Verify authorization
    if !is_segment_controller(&state.db, event_id, segment_id, user_id).await? {
        return Err(AppError::Forbidden("Not authorized"));
    }

    // Get segment info
    let segment = sqlx::query_as::<_, Segment>(
        "SELECT * FROM segments WHERE id = $1"
    )
    .bind(segment_id)
    .fetch_one(&state.db)
    .await?;

    // Get segment leaderboard
    let segment_lb = get_segment_leaderboard(&state.db, segment_id).await?;

    // Get event leaderboard
    let event_lb = get_event_leaderboard(&state.db, event_id).await?;

    // Update segment status
    sqlx::query("UPDATE segments SET status = 'completed' WHERE id = $1")
        .bind(segment_id)
        .execute(&state.db)
        .await?;

    // Update quiz phase
    hub.set_quiz_phase(&event_id, QuizPhase::SegmentComplete).await;

    // Broadcast segment complete
    hub.broadcast(&event_id, ServerMessage::SegmentComplete {
        segment_id,
        segment_title: segment.title.unwrap_or_default(),
        presenter_name: segment.presenter_name,
        segment_leaderboard: segment_lb.clone(),
        event_leaderboard: event_lb.clone(),
        segment_winner: segment_lb.first().cloned(),
        event_leader: event_lb.first().cloned(),
    }).await;
}
```

### End-of-Segment Display Component

**File: `frontend/src/components/quiz/SegmentCompleteView.tsx`** (new file)

```typescript
interface SegmentCompleteViewProps {
  segmentTitle: string;
  presenterName: string;
  segmentLeaderboard: LeaderboardEntry[];
  eventLeaderboard: LeaderboardEntry[];
  segmentWinner?: LeaderboardEntry;
  isPresenter: boolean;
  onShowOverallLeaderboard: () => void;
  onPassPresenter: () => void;
}

export function SegmentCompleteView({
  segmentTitle,
  presenterName,
  segmentLeaderboard,
  eventLeaderboard,
  segmentWinner,
  isPresenter,
  onShowOverallLeaderboard,
  onPassPresenter
}: SegmentCompleteViewProps) {
  const [showingOverall, setShowingOverall] = useState(false);

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* Segment Winner Announcement */}
      {segmentWinner && (
        <div className="text-center mb-8 animate-bounce-in">
          <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-2" />
          <h2 className="text-2xl font-bold">
            {segmentWinner.display_name} wins {segmentTitle || 'this round'}
          </h2>
          <p className="text-gray-600">
            Score: {segmentWinner.score} points
          </p>
        </div>
      )}

      {/* Toggle between segment and overall */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setShowingOverall(false)}
          className={`flex-1 py-2 rounded ${!showingOverall ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          This Segment
        </button>
        <button
          onClick={() => setShowingOverall(true)}
          className={`flex-1 py-2 rounded ${showingOverall ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
        >
          Overall Standings
        </button>
      </div>

      {/* Leaderboard */}
      {showingOverall ? (
        <MasterLeaderboard entries={eventLeaderboard} />
      ) : (
        <SegmentLeaderboard entries={segmentLeaderboard} />
      )}

      {/* Presenter Controls */}
      {isPresenter && (
        <div className="mt-6 space-y-3">
          <Button onClick={onPassPresenter} className="w-full">
            Pass Presenter Role
          </Button>
        </div>
      )}
    </div>
  );
}
```

### Final Event Results Component

**File: `frontend/src/components/quiz/EventCompleteView.tsx`** (new file)

```typescript
interface EventCompleteViewProps {
  finalLeaderboard: LeaderboardEntry[];
  winner?: LeaderboardEntry;
  segmentWinners: SegmentWinner[];
}

export function EventCompleteView({
  finalLeaderboard,
  winner,
  segmentWinners
}: EventCompleteViewProps) {
  return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      {/* Grand Winner */}
      {winner && (
        <div className="mb-8">
          <Crown className="w-20 h-20 text-yellow-500 mx-auto mb-4" />
          <h1 className="text-3xl font-bold mb-2">
            {winner.display_name} is the Champion
          </h1>
          <p className="text-xl text-gray-600">
            Final Score: {winner.score} points
          </p>
        </div>
      )}

      {/* Final Standings */}
      <div className="mb-8">
        <h2 className="text-xl font-bold mb-4">Final Standings</h2>
        <MasterLeaderboard entries={finalLeaderboard} showPodium />
      </div>

      {/* Segment Winners Summary */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Segment Winners</h3>
        <div className="space-y-2">
          {segmentWinners.map((sw, idx) => (
            <div key={sw.segment_id} className="flex justify-between p-2 bg-gray-50 rounded">
              <span>{sw.segment_title || `Segment ${idx + 1}`}</span>
              <span className="font-medium">{sw.winner_name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## Feature 6: Presenter View Unification

### Problem
When a presenter finishes and becomes a participant, they need to seamlessly switch to the participant view. Currently EventHost and EventParticipant are separate pages.

### Solution: Unified Event Page

Create a single page that dynamically renders based on user role.

**File: `frontend/src/pages/EventPage.tsx`** (new unified page)

```typescript
export function EventPage() {
  const { eventId } = useParams();
  const { user } = useAuthStore();
  const [isPresenter, setIsPresenter] = useState(false);
  const [currentSegment, setCurrentSegment] = useState<Segment | null>(null);
  const [quizPhase, setQuizPhase] = useState<QuizPhase>('not_started');

  // Determine if current user is the presenter
  useEffect(() => {
    if (currentSegment && user) {
      setIsPresenter(currentSegment.presenter_user_id === user.id);
    }
  }, [currentSegment, user]);

  // Handle presenter change from WebSocket
  const handlePresenterChanged = useCallback((data: PresenterChangedMessage) => {
    if (data.new_presenter_id === user?.id) {
      setIsPresenter(true);
    } else {
      setIsPresenter(false);
    }
  }, [user]);

  // Render appropriate view based on role
  return (
    <div className="min-h-screen bg-gray-100">
      <EventHeader
        eventName={event?.name}
        segmentTitle={currentSegment?.title}
        presenterName={currentSegment?.presenter_name}
        isPresenter={isPresenter}
      />

      {isPresenter ? (
        <PresenterView
          segment={currentSegment}
          quizPhase={quizPhase}
          onStartQuiz={handleStartQuiz}
          onRevealAnswer={handleRevealAnswer}
          onNextQuestion={handleNextQuestion}
          onEndQuiz={handleEndQuiz}
          onPassPresenter={handlePassPresenter}
        />
      ) : (
        <ParticipantView
          segment={currentSegment}
          quizPhase={quizPhase}
          onAnswer={handleAnswer}
        />
      )}
    </div>
  );
}
```

### Presenter View Component

**File: `frontend/src/components/views/PresenterView.tsx`** (new file)

```typescript
interface PresenterViewProps {
  segment: Segment | null;
  quizPhase: QuizPhase;
  participants: Participant[];
  answeredCount: number;
  allAnswered: boolean;
  currentQuestion: Question | null;
  revealData: RevealData | null;
  segmentLeaderboard: LeaderboardEntry[];
  eventLeaderboard: LeaderboardEntry[];
  onStartQuiz: () => void;
  onRevealAnswer: () => void;
  onNextQuestion: () => void;
  onEndQuiz: () => void;
  onPassPresenter: (userId: string) => void;
}

export function PresenterView({
  segment,
  quizPhase,
  participants,
  answeredCount,
  allAnswered,
  currentQuestion,
  revealData,
  segmentLeaderboard,
  eventLeaderboard,
  onStartQuiz,
  onRevealAnswer,
  onNextQuestion,
  onEndQuiz,
  onPassPresenter
}: PresenterViewProps) {
  // Pre-quiz: Show segment info and start button
  if (quizPhase === 'not_started') {
    return (
      <div className="p-6 text-center">
        <h2 className="text-2xl mb-4">Ready to start quiz?</h2>
        <p className="mb-4">{participants.length} participants connected</p>
        <Button onClick={onStartQuiz} size="lg">
          Start Quiz
        </Button>
      </div>
    );
  }

  // During quiz: Show question + controls
  if (quizPhase === 'showing_question') {
    return (
      <div className="p-6">
        <QuestionDisplay question={currentQuestion} isPresenter />
        <AnswerProgress
          answeredCount={answeredCount}
          totalParticipants={participants.length}
          allAnswered={allAnswered}
        />
        <PresenterControls
          phase={quizPhase}
          allAnswered={allAnswered}
          onRevealAnswer={onRevealAnswer}
        />
      </div>
    );
  }

  // Revealing: Show answer + distribution
  if (quizPhase === 'revealing_answer') {
    return (
      <div className="p-6">
        <QuestionDisplay question={currentQuestion} showCorrect />
        <AnswerDistributionChart data={revealData?.distribution} />
        <PresenterControls
          phase={quizPhase}
          onShowLeaderboard={() => {/* send ShowLeaderboard */}}
        />
      </div>
    );
  }

  // Segment complete: Show results + pass control
  if (quizPhase === 'segment_complete') {
    return (
      <SegmentCompleteView
        segmentLeaderboard={segmentLeaderboard}
        eventLeaderboard={eventLeaderboard}
        isPresenter={true}
        onPassPresenter={() => {/* open selector */}}
      />
    );
  }

  return null;
}
```

### Participant View Component

**File: `frontend/src/components/views/ParticipantView.tsx`** (new file)

```typescript
interface ParticipantViewProps {
  segment: Segment | null;
  quizPhase: QuizPhase;
  currentQuestion: Question | null;
  revealData: RevealData | null;
  hasAnswered: boolean;
  myScore: number;
  segmentLeaderboard: LeaderboardEntry[];
  eventLeaderboard: LeaderboardEntry[];
  onAnswer: (answer: string) => void;
}

export function ParticipantView({
  segment,
  quizPhase,
  currentQuestion,
  revealData,
  hasAnswered,
  myScore,
  segmentLeaderboard,
  eventLeaderboard,
  onAnswer
}: ParticipantViewProps) {
  // Waiting for quiz to start
  if (quizPhase === 'not_started') {
    return (
      <div className="p-6 text-center">
        <h2 className="text-xl mb-2">Waiting for {segment?.presenter_name}</h2>
        <p className="text-gray-600">Quiz will start soon...</p>
        <LoadingSpinner />
      </div>
    );
  }

  // Answering question
  if (quizPhase === 'showing_question') {
    return (
      <div className="p-6">
        <QuestionDisplay question={currentQuestion} />
        {hasAnswered ? (
          <div className="text-center py-8">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
            <p>Answer submitted. Waiting for others...</p>
          </div>
        ) : (
          <AnswerSelection
            answers={currentQuestion?.answers || []}
            onSelect={onAnswer}
          />
        )}
      </div>
    );
  }

  // Viewing reveal
  if (quizPhase === 'revealing_answer') {
    return (
      <div className="p-6">
        <QuestionDisplay question={currentQuestion} showCorrect />
        <AnswerDistributionChart data={revealData?.distribution} />
        <div className="text-center mt-4">
          <p className="text-lg">Your score: {myScore}</p>
        </div>
      </div>
    );
  }

  // Segment complete
  if (quizPhase === 'segment_complete') {
    return (
      <SegmentCompleteView
        segmentLeaderboard={segmentLeaderboard}
        eventLeaderboard={eventLeaderboard}
        isPresenter={false}
      />
    );
  }

  return <WaitingMessage text="Waiting..." />;
}
```

### Router Update

**File: `frontend/src/App.tsx`**

```typescript
// Replace separate routes with unified page
<Route path="/event/:eventId" element={
  <ProtectedRoute>
    <EventPage />
  </ProtectedRoute>
} />

// Remove or redirect old routes
// /event/:eventId/host -> /event/:eventId
// /event/:eventId/participant -> /event/:eventId
```

---

## Implementation Order

Recommended order for implementing these features:

1. **Feature 1**: Database migration for `presenter_user_id` (foundation)
2. **Feature 4**: Quiz phase state machine (core flow)
3. **Feature 3**: Answer tracking and progress (enhances UX)
4. **Feature 6**: Unified event page (consolidates views)
5. **Feature 5**: End-of-segment displays (completion flow)
6. **Feature 2**: Role passing (enables multi-presenter)

## Testing Checklist

- [ ] Create event with multiple segments assigned to different users
- [ ] First presenter starts quiz, advances through all questions
- [ ] Verify all participants see same phase simultaneously
- [ ] Verify answer progress shows correctly for presenter
- [ ] End segment and verify leaderboards display
- [ ] Pass presenter role to next user
- [ ] New presenter starts their segment quiz
- [ ] Complete all segments and verify final results
- [ ] Verify former presenter now sees participant view

---

## User Story Gap Analysis

The following features are **partially implemented** or **missing** based on user story requirements.

---

## Feature 7: QR Code Scanning (Partial → Full)

### Current State
- QR code **displayed** via `qrcode.react` on EventDetail page
- Users must **manually type** the 6-character join code
- No camera-based scanning capability

### Required Changes

#### Install QR Scanner Library

```bash
cd frontend && npm install html5-qrcode
```

#### Add QR Scanner Component

**File: `frontend/src/components/join/QRScanner.tsx`** (new file)

```typescript
import { Html5QrcodeScanner } from 'html5-qrcode';
import { useEffect, useRef, useState } from 'react';

interface QRScannerProps {
  onScan: (code: string) => void;
  onError: (error: string) => void;
}

export function QRScanner({ onScan, onError }: QRScannerProps) {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    scannerRef.current = new Html5QrcodeScanner(
      'qr-reader',
      { fps: 10, qrbox: { width: 250, height: 250 } },
      false
    );

    scannerRef.current.render(
      (decodedText) => {
        // Extract join code from URL: /join?code=ABC123
        const match = decodedText.match(/[?&]code=([A-Z0-9]{6})/i);
        if (match) {
          onScan(match[1].toUpperCase());
        } else {
          onError('Invalid QR code format');
        }
      },
      (error) => {
        if (error.includes('NotAllowedError')) {
          setHasPermission(false);
          onError('Camera permission denied');
        }
      }
    );

    return () => {
      scannerRef.current?.clear();
    };
  }, [onScan, onError]);

  if (hasPermission === false) {
    return (
      <div className="text-center p-4 bg-red-50 rounded">
        <p className="text-red-600 font-medium">Camera Access Required</p>
        <p className="text-sm mt-2">
          Please enable camera permissions in your browser settings to scan QR codes.
        </p>
      </div>
    );
  }

  return <div id="qr-reader" className="w-full max-w-sm mx-auto" />;
}
```

#### Update JoinEvent Page

**File: `frontend/src/pages/JoinEvent.tsx`** (update)

Add toggle between QR scan and manual entry:

```typescript
const [mode, setMode] = useState<'scan' | 'manual'>('scan');

return (
  <div className="max-w-md mx-auto p-6">
    <div className="flex gap-2 mb-6">
      <button
        onClick={() => setMode('scan')}
        className={`flex-1 py-2 rounded ${mode === 'scan' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
      >
        Scan QR Code
      </button>
      <button
        onClick={() => setMode('manual')}
        className={`flex-1 py-2 rounded ${mode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
      >
        Enter Code
      </button>
    </div>

    {mode === 'scan' ? (
      <QRScanner onScan={handleJoinCode} onError={setError} />
    ) : (
      <Input
        value={joinCode}
        onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
        placeholder="Enter 6-digit code"
        maxLength={6}
      />
    )}
  </div>
);
```

---

## Feature 8: Device Binding & Duplicate Prevention (Missing)

### Current State
- No device ID in JWT tokens
- Same user can join an event multiple times simultaneously
- No session binding for rejoin

### Database Migration

**File: `backend/migrations/YYYYMMDDHHMMSS_add_device_sessions.up.sql`**

```sql
CREATE TABLE event_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(64) NOT NULL,
    session_token UUID NOT NULL DEFAULT gen_random_uuid(),
    connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    disconnected_at TIMESTAMPTZ,
    is_active BOOLEAN NOT NULL DEFAULT true,
    UNIQUE(event_id, user_id, device_id)
);

CREATE INDEX idx_event_sessions_active ON event_sessions(event_id, is_active);
```

### Backend: Duplicate Check in Join Handler

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::Join { user_id, device_id } => {
    // Check for existing active session
    let existing = sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(
            SELECT 1 FROM event_sessions
            WHERE event_id = $1 AND user_id = $2 AND is_active = true
        )"
    )
    .bind(event_id)
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;

    if existing {
        return Err(AppError::Conflict("Already connected to this event"));
    }

    // Create session record
    sqlx::query(
        "INSERT INTO event_sessions (event_id, user_id, device_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (event_id, user_id, device_id)
         DO UPDATE SET is_active = true, connected_at = NOW()"
    )
    .bind(event_id)
    .bind(user_id)
    .bind(&device_id)
    .execute(&state.db)
    .await?;

    // Continue with existing join logic...
}
```

### Frontend: Generate Device ID

**File: `frontend/src/utils/deviceId.ts`** (new file)

```typescript
const DEVICE_ID_KEY = 'quiz_device_id';

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}
```

---

## Feature 9: Late Joiner Handling (Missing)

### Current State
- Participants can join anytime
- No detection of late join relative to quiz start
- No visual indicator on leaderboard
- No zero-scoring for missed questions

### Database Changes

**File: `backend/migrations/YYYYMMDDHHMMSS_add_late_joiner_tracking.up.sql`**

```sql
ALTER TABLE event_participants
ADD COLUMN is_late_joiner BOOLEAN DEFAULT false,
ADD COLUMN joined_during_question INTEGER;
```

### Backend: Detect Late Join

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::Join { user_id, .. } => {
    // Check if quiz has started
    let quiz_started = sqlx::query_scalar::<_, Option<DateTime<Utc>>>(
        "SELECT quiz_started_at FROM segments WHERE id = $1"
    )
    .bind(current_segment_id)
    .fetch_one(&state.db)
    .await?;

    let is_late = quiz_started.is_some();
    let current_question = if is_late {
        hub.get_current_question_index(&event_id).await
    } else {
        None
    };

    // Record late join status
    sqlx::query(
        "UPDATE event_participants
         SET is_late_joiner = $1, joined_during_question = $2
         WHERE event_id = $3 AND user_id = $4"
    )
    .bind(is_late)
    .bind(current_question)
    .bind(event_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    // Include late join info in Connected message
    hub.send_to_user(&event_id, user_id, ServerMessage::Connected {
        participants,
        is_late_joiner: is_late,
        missed_questions: current_question.unwrap_or(0),
    }).await;
}
```

### Update LeaderboardEntry

**File: `backend/src/ws/messages.rs`**

```rust
#[derive(Debug, Serialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub score: i32,
    pub is_late_joiner: bool,  // NEW
}
```

### Frontend: Late Joiner Badge

**File: `frontend/src/components/leaderboard/LeaderboardEntry.tsx`**

```typescript
{entry.is_late_joiner && (
  <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
    Late Join
  </span>
)}
```

---

## Feature 10: Lock/Unlock Joining (Missing)

### Current State
- No mechanism to temporarily disable new joins
- Participants can join at any time

### Database Changes

**File: `backend/migrations/YYYYMMDDHHMMSS_add_joining_locked.up.sql`**

```sql
ALTER TABLE events ADD COLUMN joining_locked BOOLEAN DEFAULT false;
```

### WebSocket Messages

**File: `backend/src/ws/messages.rs`**

```rust
// Client → Server
pub enum GameMessage {
    // ... existing ...
    LockJoining,
    UnlockJoining,
}

// Server → Client
pub enum ServerMessage {
    // ... existing ...
    JoiningLocked { locked: bool },
    JoinRejected { reason: String },
}
```

### Backend Handler

**File: `backend/src/ws/handler.rs`**

```rust
GameMessage::LockJoining => {
    // Verify presenter/host
    if !is_event_host(&state.db, event_id, user_id).await? {
        return Err(AppError::Forbidden("Only host can lock joining"));
    }

    sqlx::query("UPDATE events SET joining_locked = true WHERE id = $1")
        .bind(event_id)
        .execute(&state.db)
        .await?;

    hub.broadcast(&event_id, ServerMessage::JoiningLocked { locked: true }).await;
}

GameMessage::Join { .. } => {
    // Check if joining is locked
    let locked = sqlx::query_scalar::<_, bool>(
        "SELECT joining_locked FROM events WHERE id = $1"
    )
    .bind(event_id)
    .fetch_one(&state.db)
    .await?;

    if locked {
        return hub.send_to_user(&event_id, user_id, ServerMessage::JoinRejected {
            reason: "Joining is temporarily disabled".into()
        }).await;
    }
    // Continue with join...
}
```

### Frontend: Lock Toggle Button

**File: `frontend/src/components/quiz/PresenterControls.tsx`**

```typescript
<Button
  onClick={() => sendMessage({ type: joiningLocked ? 'unlock_joining' : 'lock_joining' })}
  variant="secondary"
>
  {joiningLocked ? 'Unlock Joining' : 'Lock Joining'}
</Button>
```

---

## Feature 11: Participant Status Display (Missing)

### Current State
- No status field showing "joined", "waiting", "active"
- Participants don't know their current state

### Update ParticipantMessage

**File: `backend/src/ws/messages.rs`**

```rust
#[derive(Debug, Serialize)]
pub struct ParticipantMessage {
    pub id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub status: ParticipantStatus,  // NEW
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ParticipantStatus {
    Joined,       // Connected, waiting for quiz
    Active,       // Answering current question
    Answered,     // Submitted answer for current question
    Disconnected, // Temporarily disconnected
}
```

### Frontend Status Badge

**File: `frontend/src/components/participants/ParticipantList.tsx`**

```typescript
const statusColors = {
  joined: 'bg-gray-100 text-gray-600',
  active: 'bg-blue-100 text-blue-600',
  answered: 'bg-green-100 text-green-600',
  disconnected: 'bg-red-100 text-red-600',
};

<span className={`text-xs px-2 py-0.5 rounded ${statusColors[p.status]}`}>
  {p.status}
</span>
```

---

## Feature 12: Rejoin State Restoration (Partial → Full)

### Current State
- Frontend auto-reconnects with 3-second retry
- Backend removes participant on disconnect (no state preservation)

### Backend: Graceful Disconnect Handling

**File: `backend/src/ws/handler.rs`**

```rust
// On WebSocket close, mark as disconnected but don't remove
pub async fn handle_disconnect(hub: &Hub, state: &AppState, event_id: Uuid, user_id: Uuid) {
    // Mark session as disconnected (not removed)
    sqlx::query(
        "UPDATE event_sessions SET is_active = false, disconnected_at = NOW()
         WHERE event_id = $1 AND user_id = $2"
    )
    .bind(event_id)
    .bind(user_id)
    .execute(&state.db)
    .await.ok();

    // Update participant status (don't remove from game state)
    hub.set_participant_status(&event_id, user_id, ParticipantStatus::Disconnected).await;

    // Broadcast status change
    hub.broadcast(&event_id, ServerMessage::ParticipantStatusChanged {
        user_id,
        status: ParticipantStatus::Disconnected,
    }).await;
}

// On rejoin, restore state
GameMessage::Join { user_id, .. } => {
    // Check for existing session to restore
    let existing = sqlx::query_as::<_, EventSession>(
        "SELECT * FROM event_sessions
         WHERE event_id = $1 AND user_id = $2
         ORDER BY connected_at DESC LIMIT 1"
    )
    .bind(event_id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    if let Some(session) = existing {
        // Restore session, send current game state
        hub.send_to_user(&event_id, user_id, ServerMessage::StateRestored {
            current_question: game_state.current_question.clone(),
            phase: game_state.quiz_phase.clone(),
            your_score: get_user_score(&state.db, event_id, user_id).await?,
        }).await;
    }
}
```

---

## User Story Gap Summary

| Feature | User Stories Addressed | Status | Effort |
|---------|----------------------|--------|--------|
| Feature 7: QR Scanning | Join via QR, Camera permissions | Partial | 3h |
| Feature 8: Device Binding | Prevent duplicates, Rejoin via QR | Missing | 4h |
| Feature 9: Late Joiner | Late join scoring, Leaderboard marking | Missing | 3h |
| Feature 10: Lock Joining | Lock/Unlock QR joining | Missing | 2h |
| Feature 11: Participant Status | Join state awareness | Missing | 2h |
| Feature 12: Rejoin Restoration | Network loss handling | Partial | 3h |
| **Total** | **11 user stories** | | **~17h** |

## Recommended Implementation Order (User Story Features)

After completing Features 1-6 (multi-presenter):

1. **Feature 8**: Device Binding (foundation for identity)
2. **Feature 12**: Rejoin Restoration (requires Feature 8)
3. **Feature 9**: Late Joiner Handling (scoring fairness)
4. **Feature 11**: Participant Status (visibility)
5. **Feature 10**: Lock/Unlock Joining (presenter control)
6. **Feature 7**: QR Scanning (optional UX enhancement)

## User Story Coverage After Implementation

| Category | Before | After |
|----------|--------|-------|
| Session Entry (QR-Only) | 2/4 | 4/4 |
| Identity & Rejoining | 0/4 | 4/4 |
| Late Joiners | 1/3 | 3/3 |
| Presenter Controls | 1/3 | 3/3 |
| Quiz Flow | 1/2 | 2/2 |
| Scoring & Leaderboards | 2/3 | 3/3 |
| Presenter Rotation | 2/2 | 2/2 |
| Reliability & Edge Cases | 0/3 | 3/3 |
| **Total** | **9/24** | **24/24** |
