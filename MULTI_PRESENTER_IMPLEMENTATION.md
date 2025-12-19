# Multi-Presenter Quiz Implementation Guide

**Created:** 2024-12-17

---

## User Story

> There's a group of friends giving each other presentations. Each person gets to switch from being the presenter back to being a participant. Their experience should be to watch another person's presentation, then at the end of the presentation get shown a Kahoot-style quiz game based on the content of the presentation.
>
> Each presentation from each participant should be a separate segment and the user should be able to see a leaderboard of who is winning at the end.
>
> **Quiz Flow:**
> 1. Once everyone is done with a segment, the presenter will go through each question and show the results for each question
> 2. The presenter manually advances the questions
> 3. After everyone has answered, the presenter reveals the correct answer
> 4. At the end of the quiz, show the leaderboard for the current presentation (segment), then the overall leaderboard (event)
> 5. The presenter can then pass the presenter role to the next player
> 6. After passing, the previous presenter becomes a participant

---

## Current Implementation Status

### Fully Implemented

| Feature | Location | Notes |
|---------|----------|-------|
| `PassPresenter` WebSocket message | `backend/src/ws/handler.rs:1496-1592` | Updates DB, broadcasts `PresenterChanged` |
| `presenter_user_id` column | `migrations/20251217195932_add_segment_presenter_user_id.up.sql` | Links segment to presenter |
| `PassPresenterButton` component | `frontend/src/components/quiz/PassPresenterButton.tsx` | UI exists but not integrated |
| Quiz flow commands | `backend/src/ws/handler.rs` | `start_game`, `next_question`, `reveal_answer`, `show_leaderboard`, `end_game` |
| `SegmentComplete` message | `backend/src/ws/handler.rs:1460-1479` | Broadcasts both leaderboards |
| Presenter authorization check | `backend/src/ws/handler.rs:85-109` | `is_segment_controller()` function |

### Partially Implemented

| Feature | What Exists | What's Missing |
|---------|-------------|----------------|
| Event completion | Message type defined, frontend handles it | No backend trigger logic |
| Presenter can control quiz | Can end game and pass presenter | Cannot start quiz (host only) |

### Not Implemented

| Feature | Description |
|---------|-------------|
| PassPresenterButton integration | Not in EventHost.tsx UI |
| Presenter indicator | No UI shows who the current presenter is |
| Participant role switching | No dynamic role change when presenter passes |

---

## Implementation Plan

### Phase 1: Presenter Authorization Enhancement
**Estimated Effort:** 2-3 hours

Allow segment presenters to start and control quizzes for their segments.

### Phase 2: UI Integration
**Estimated Effort:** 3-4 hours

Integrate PassPresenterButton and add presenter indicators.

### Phase 3: Role Switching
**Estimated Effort:** 2-3 hours

Handle dynamic role changes when presenter is passed.

### Phase 4: Event Completion Logic
**Estimated Effort:** 2-3 hours

Trigger EventComplete when all segments are done.

---

## Detailed Implementation

### Phase 1: Presenter Authorization Enhancement

**Goal:** Allow segment presenters to start and control quizzes for their segments.

**Files to Modify:**
- `backend/src/ws/handler.rs`

#### 1.1 Update `StartGame` Authorization

**Current Code (handler.rs ~line 765):**
```rust
// Only host can start
if auth_user.id != event.host_id {
    return Err(AppError::Forbidden);
}
```

**New Code:**
```rust
// Host OR segment presenter can start
if !is_segment_controller(&state.db, &auth_user, &event, segment_id).await? {
    return Err(AppError::Forbidden);
}
```

#### 1.2 Update `NextQuestion` Authorization

**Current Code (handler.rs ~line 917):**
```rust
if auth_user.id != event.host_id {
    return Err(AppError::Forbidden);
}
```

**New Code:**
```rust
if !is_segment_controller(&state.db, &auth_user, &event, segment_id).await? {
    return Err(AppError::Forbidden);
}
```

#### 1.3 Update `RevealAnswer` Authorization

**Current Code (handler.rs ~line 1050):**
```rust
if auth_user.id != event.host_id {
    return Err(AppError::Forbidden);
}
```

**New Code:**
```rust
if !is_segment_controller(&state.db, &auth_user, &event, segment_id).await? {
    return Err(AppError::Forbidden);
}
```

#### 1.4 Existing `is_segment_controller` Function

Already implemented at `handler.rs:85-109`:
```rust
async fn is_segment_controller(
    db: &PgPool,
    auth_user: &AuthUser,
    event: &Event,
    segment_id: Option<Uuid>,
) -> Result<bool> {
    // Host always has control
    if auth_user.id == event.host_id {
        return Ok(true);
    }

    // Check if user is segment presenter
    if let Some(seg_id) = segment_id {
        let segment = sqlx::query_as::<_, Segment>(
            "SELECT * FROM segments WHERE id = $1"
        )
        .bind(seg_id)
        .fetch_optional(db)
        .await?;

        if let Some(seg) = segment {
            if seg.presenter_user_id == Some(auth_user.id) {
                return Ok(true);
            }
        }
    }

    Ok(false)
}
```

---

### Phase 2: UI Integration

**Goal:** Add presenter controls and indicators to the UI.

**Files to Modify:**
- `frontend/src/pages/EventHost.tsx`
- `frontend/src/pages/EventParticipant.tsx`
- `frontend/src/components/quiz/PresenterControls.tsx` (new)

#### 2.1 Integrate PassPresenterButton in EventHost.tsx

**Location:** After quiz ends, show pass presenter option.

**Import:**
```typescript
import { PassPresenterButton } from '@/components/quiz/PassPresenterButton'
```

**Add to Quiz Controls section (~line 456):**
```tsx
{/* Show after segment complete */}
{_segmentComplete && (
  <div className="mt-4 p-4 bg-dark-800 rounded-lg border border-cyan-500/30">
    <h3 className="text-white font-semibold mb-2">Segment Complete</h3>
    <p className="text-gray-400 text-sm mb-3">
      Pass the presenter role to the next person.
    </p>
    <PassPresenterButton
      participants={participants}
      currentUserId={user?.id}
      onPassPresenter={(nextPresenterId) => {
        sendMessage({ type: 'pass_presenter', next_presenter_user_id: nextPresenterId })
      }}
    />
  </div>
)}
```

#### 2.2 Add Presenter Indicator to EventHost.tsx

**Add to header section (~line 318):**
```tsx
{_currentPresenterName && (
  <div className="text-sm text-cyan-400">
    Current Presenter: {_currentPresenterName}
  </div>
)}
```

#### 2.3 Add Presenter Indicator to EventParticipant.tsx

**Add to connection banner section (~line 224):**
```tsx
{_currentPresenterName && (
  <div className="text-xs text-cyan-400 mt-1">
    Presenter: {_currentPresenterName}
  </div>
)}
```

#### 2.4 Show Segment/Event Complete Views in EventParticipant.tsx

**Add to the main content area (~line 282):**
```tsx
{/* Segment Complete View */}
{_segmentResults && !_finalResults && (
  <div className="bg-dark-900 rounded-lg p-6 border border-cyan-500/30">
    <h2 className="text-xl font-bold text-white mb-2">
      Segment Complete: {_segmentResults.segment_title}
    </h2>
    <p className="text-gray-400 mb-4">
      Presented by {_segmentResults.presenter_name}
    </p>
    {_segmentResults.segment_winner && (
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4">
        <span className="text-yellow-400">Segment Winner: </span>
        <span className="text-white font-semibold">
          {_segmentResults.segment_winner.username}
        </span>
        <span className="text-gray-400"> ({_segmentResults.segment_winner.score} pts)</span>
      </div>
    )}
    <p className="text-sm text-gray-500">Waiting for next presenter...</p>
  </div>
)}

{/* Event Complete View */}
{_finalResults && (
  <div className="bg-dark-900 rounded-lg p-6 border border-green-500/30">
    <h2 className="text-xl font-bold text-white mb-4">Event Complete!</h2>
    {_finalResults.winner && (
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 mb-4">
        <div className="text-green-400 text-lg">Overall Winner</div>
        <div className="text-2xl font-bold text-white">
          {_finalResults.winner.username}
        </div>
        <div className="text-gray-400">{_finalResults.winner.score} total points</div>
      </div>
    )}
  </div>
)}
```

---

### Phase 3: Role Switching

**Goal:** Handle dynamic role changes when presenter is passed.

**Files to Modify:**
- `frontend/src/pages/EventHost.tsx`
- `frontend/src/pages/EventParticipant.tsx`
- `frontend/src/App.tsx` (routing)

#### 3.1 Handle `presenter_changed` Message in EventHost.tsx

When someone else becomes presenter, the current user should:
1. See that they're no longer the presenter
2. Potentially redirect to participant view

**Update the handler (already in place, enhance logic):**
```typescript
} else if (msg.type === 'presenter_changed') {
  setCurrentPresenterId(msg.new_presenter_id)
  setCurrentPresenterName(msg.new_presenter_name)

  // If I was the presenter and now I'm not, reset my state
  if (user && msg.previous_presenter_id === user.id) {
    setSegmentComplete(null)
    // Optionally navigate to participant view
    // navigate(`/events/${eventId}/participate/${msg.segment_id}`)
  }
}
```

#### 3.2 Handle `presenter_changed` in EventParticipant.tsx

When I become the presenter, redirect to host view:
```typescript
} else if (msg.type === 'presenter_changed') {
  setCurrentPresenterName(msg.new_presenter_name)

  // If I'm the new presenter, redirect to host view
  if (user && msg.new_presenter_id === user.id) {
    navigate(`/events/${eventId}/host/${msg.segment_id}`)
  }
}
```

#### 3.3 Add `isPresenter` Computed State

**EventParticipant.tsx:**
```typescript
const isPresenter = useMemo(() => {
  if (!user || !_currentPresenterId) return false
  return user.id === _currentPresenterId
}, [user, _currentPresenterId])
```

**Use in UI:**
```tsx
{isPresenter && (
  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 mb-4">
    <span className="text-cyan-400">You are the presenter!</span>
    <Button onClick={() => navigate(`/events/${eventId}/host/${segmentId}`)}>
      Go to Presenter View
    </Button>
  </div>
)}
```

---

### Phase 4: Event Completion Logic

**Goal:** Trigger EventComplete when all segments are done.

**Files to Modify:**
- `backend/src/ws/handler.rs`
- `backend/src/routes/quiz.rs` (optional: add endpoint)

#### 4.1 Option A: Manual Event End

Add a new `end_event` WebSocket message that the host sends after the last segment.

**Add to `GameMessage` enum (messages.rs):**
```rust
#[serde(rename = "end_event")]
EndEvent,
```

**Add handler in handler.rs:**
```rust
GameMessage::EndEvent => {
    // Only host can end event
    if auth_user.id != event.host_id {
        return Err(AppError::Forbidden);
    }

    // Update event status
    sqlx::query("UPDATE events SET status = 'finished' WHERE id = $1")
        .bind(event.id)
        .execute(&state.db)
        .await?;

    // Calculate final leaderboard
    let final_leaderboard = get_event_leaderboard(&state.db, event.id).await?;

    // Get segment winners
    let segment_winners = get_all_segment_winners(&state.db, event.id).await?;

    // Broadcast event complete
    hub.broadcast_to_event(event.id, ServerMessage::EventComplete {
        event_id: event.id,
        final_leaderboard,
        winner: final_leaderboard.first().cloned(),
        segment_winners,
    }).await;
}
```

#### 4.2 Option B: Automatic Event End

Automatically trigger EventComplete when all segments are completed.

**Add check after PassPresenter or EndGame:**
```rust
// Check if all segments are complete
let incomplete_count: (i64,) = sqlx::query_as(
    "SELECT COUNT(*) FROM segments WHERE event_id = $1 AND status != 'completed'"
)
.bind(event.id)
.fetch_one(&state.db)
.await?;

if incomplete_count.0 == 0 {
    // All segments complete - end event
    trigger_event_complete(&state, &hub, event.id).await?;
}
```

#### 4.3 Helper Functions to Add

**Add to handler.rs:**
```rust
async fn get_all_segment_winners(
    db: &PgPool,
    event_id: Uuid,
) -> Result<Vec<SegmentWinner>> {
    let rows = sqlx::query(
        r#"
        SELECT
            s.id as segment_id,
            COALESCE(s.title, s.presenter_name) as segment_title,
            u.username as winner_name,
            ss.score as winner_score
        FROM segments s
        LEFT JOIN LATERAL (
            SELECT user_id, score
            FROM segment_scores
            WHERE segment_id = s.id
            ORDER BY score DESC
            LIMIT 1
        ) ss ON true
        LEFT JOIN users u ON ss.user_id = u.id
        WHERE s.event_id = $1 AND s.status = 'completed'
        ORDER BY s.order_index
        "#
    )
    .bind(event_id)
    .fetch_all(db)
    .await?;

    let mut winners = Vec::new();
    for row in rows {
        winners.push(SegmentWinner {
            segment_id: row.get("segment_id"),
            segment_title: row.get("segment_title"),
            winner_name: row.get::<Option<String>, _>("winner_name")
                .unwrap_or_else(|| "No winner".to_string()),
            winner_score: row.get::<Option<i32>, _>("winner_score").unwrap_or(0),
        });
    }

    Ok(winners)
}
```

---

## Summary

### Total Estimated Effort: 10-13 hours

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| 1 | Presenter Authorization Enhancement | 2-3h | High |
| 2 | UI Integration | 3-4h | High |
| 3 | Role Switching | 2-3h | Medium |
| 4 | Event Completion Logic | 2-3h | Medium |

### Implementation Order

1. **Phase 1** - Backend authorization changes (enables presenters to control quizzes)
2. **Phase 2** - UI for pass presenter and indicators
3. **Phase 3** - Dynamic role switching and navigation
4. **Phase 4** - Event completion trigger

---

## Open Questions

Before implementation, consider:

1. **Segment Creation**: How are segments created?
   - Pre-created by host with assigned presenters?
   - Created dynamically when passing presenter role?

2. **Intermission State**: Between segments, should there be:
   - An explicit "intermission" screen?
   - Automatic transition to next segment?

3. **Participant During Presentation**: What do participants see while presenter is presenting?
   - Waiting screen with presenter info?
   - Canvas/screen share feature?

4. **Event End Trigger**: Manual or automatic?
   - Host clicks "End Event" after last segment?
   - Automatic when all segments complete?

---

## Files Changed Summary

**Backend:**
- `backend/src/ws/handler.rs` - Authorization changes for quiz commands
- `backend/src/ws/messages.rs` - Optional: add `EndEvent` message

**Frontend:**
- `frontend/src/pages/EventHost.tsx` - Pass presenter UI, presenter indicator
- `frontend/src/pages/EventParticipant.tsx` - Presenter indicator, role switching navigation
- `frontend/src/hooks/useEventWebSocket.ts` - Already updated with message types

---

## Testing Checklist

- [ ] Presenter can start quiz for their segment
- [ ] Presenter can advance questions and reveal answers
- [ ] Presenter can end quiz and see segment leaderboard
- [ ] Presenter can pass role to another participant
- [ ] New presenter receives notification and can navigate to host view
- [ ] Previous presenter sees they are no longer presenter
- [ ] All participants see current presenter indicator
- [ ] Event completion shows final leaderboard with all segment winners
