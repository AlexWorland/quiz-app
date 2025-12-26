# Implementation Gaps

**Generated:** 2024-12-17

This document tracks features that are partially implemented or not yet implemented based on the user story requirements.

---

## Partially Implemented

### 1. Event Completion Trigger

**Status:** Backend message defined, no automatic trigger

**What Exists:**
- `EventComplete` WebSocket message type defined in `backend/src/ws/messages.rs`
- Frontend handles `event_complete` message in `EventParticipant.tsx:172-180`
- `EventCompleteView.tsx` component displays final results

**What's Missing:**
- No automatic trigger when all segments are marked complete
- No manual `end_event` WebSocket message for host to explicitly end event
- Host cannot signal "event is finished" after the last segment

**Implementation Options:**

Option A - Automatic trigger after last segment:
```rust
// After PassPresenter or EndGame, check if all segments complete
let incomplete_count: (i64,) = sqlx::query_as(
    "SELECT COUNT(*) FROM segments WHERE event_id = $1 AND status != 'completed'"
)
.bind(event_id)
.fetch_one(&state.db)
.await?;

if incomplete_count.0 == 0 {
    trigger_event_complete(&state, &hub, event_id).await?;
}
```

Option B - Add manual `EndEvent` message:
```rust
// In messages.rs GameMessage enum
#[serde(rename = "end_event")]
EndEvent,

// Handler checks host-only permission and broadcasts EventComplete
```

**Files to Modify:**
- `backend/src/ws/messages.rs` - Add `EndEvent` variant (if Option B)
- `backend/src/ws/handler.rs` - Add trigger logic

**Effort:** 2-3 hours

---

### 2. Presenter Indicator Visibility

**Status:** State tracked, not prominently displayed

**What Exists:**
- `currentPresenterName` state in `EventParticipant.tsx`
- `currentPresenterId` state in `EventHost.tsx`
- Presenter name shown in some contexts

**What's Missing:**
- No prominent header/banner showing current presenter
- Participants don't always see who is presenting at a glance

**Suggested Implementation:**

Add to `EventHost.tsx` header section:
```tsx
{currentPresenterName && (
  <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg px-3 py-1">
    <span className="text-cyan-400 text-sm">
      Current Presenter: {currentPresenterName}
    </span>
  </div>
)}
```

Add to `EventParticipant.tsx` connection banner:
```tsx
{currentPresenterName && (
  <div className="text-xs text-cyan-400 mt-1">
    Presenter: {currentPresenterName}
  </div>
)}
```

**Files to Modify:**
- `frontend/src/pages/EventHost.tsx`
- `frontend/src/pages/EventParticipant.tsx`

**Effort:** 1 hour

---

## Not Implemented

### 1. Results Export Feature

**Priority:** Medium

**Description:**
Export quiz results to CSV or JSON format for post-event analysis.

**What's Needed:**
- Backend endpoint: `GET /api/events/:id/export?format=csv|json`
- CSV generation with participant scores, answers, response times
- JSON export with full event data
- Frontend download button in event summary or EventCompleteView

**Suggested API Response (JSON):**
```json
{
  "event": {
    "id": "uuid",
    "name": "Event Name",
    "created_at": "2024-12-17T00:00:00Z"
  },
  "segments": [
    {
      "id": "uuid",
      "title": "Segment 1",
      "presenter": "John",
      "questions": [
        {
          "text": "Question?",
          "correct_answer": "A",
          "responses": [
            { "user": "Jane", "answer": "A", "correct": true, "time_ms": 3200 }
          ]
        }
      ]
    }
  ],
  "final_leaderboard": [
    { "rank": 1, "username": "Jane", "score": 1500 }
  ]
}
```

**Files to Create/Modify:**
- `backend/src/routes/quiz.rs` - Add export endpoint
- `frontend/src/components/quiz/ExportButton.tsx` - New component
- `frontend/src/pages/EventHost.tsx` - Integrate export button

**Effort:** 5-7 hours

---

### 2. Manual End Event Command

**Priority:** Low (covered by automatic trigger if implemented)

**Description:**
Allow event host to explicitly end the entire event, triggering final results display for all participants.

**What's Needed:**
- New `EndEvent` WebSocket message type
- Handler that validates host permission
- Broadcasts `EventComplete` with aggregated results

**Implementation:**

In `backend/src/ws/messages.rs`:
```rust
#[serde(rename = "end_event")]
EndEvent,
```

In `backend/src/ws/handler.rs`:
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

    // Calculate final leaderboard and broadcast EventComplete
    // ...
}
```

**Effort:** 2-3 hours

---

## Summary

| Feature | Type | Priority | Effort |
|---------|------|----------|--------|
| Event completion trigger | Partial | High | 2-3h |
| Presenter indicator visibility | Partial | Low | 1h |
| Results export | Missing | Medium | 5-7h |
| Manual end event command | Missing | Low | 2-3h |

**Total Remaining Effort:** ~10-14 hours

---

## Related Documentation

- `REMAINING_WORK.md` - Full list of remaining features
- `MULTI_PRESENTER_IMPLEMENTATION.md` - Detailed implementation guide
- `APPLICATION_HEALTH_REPORT.md` - Overall application status
