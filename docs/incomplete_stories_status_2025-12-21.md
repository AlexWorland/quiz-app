# Incomplete / Missing User Story Coverage (2025-12-21)

This document lists the user-story gaps based on the current codebase (backend-python + frontend) after the latest scoring and presenter changes.

## Still Incomplete

1) **Presenter disconnect edge cases**
   - When the current presenter disconnects, the backend only notifies the host (`PresenterDisconnectedMessage`) and does not auto-select or force a replacement presenter, nor pause/guard the segment for all-disconnect scenarios.
   - Impacted stories: “Pass to disconnected participant feedback”, “All participants disconnect handling”, “Presenter disconnects before selection”.

2) **Tie-break explanation UI**
   - Leaderboards show a static tie-break note, but there is no per-row tooltip or explicit “why this rank” affordance.
   - Impacted story: “Tie-break reason tooltips”.

## Confirmed Covered (previously flagged but implemented)

- **QR lock reminder after 5+ minutes**: `JoinLockReminder` with timer and reminder logic in `EventHost.tsx`.
- **No-questions-generated handling**: `NoQuestionsNotice` rendered in `EventHost` when a segment is quiz-ready/completed with zero questions.
- **Single device per event enforcement**: Backend join route rejects a device already in another active event and rejoins same-event devices instead of duplicating.
- **Answer timeout boundary**: Backend `record_answer` rejects answers past time limit; stale-question answers also rejected.
- **Mega-quiz edge cases**: Handles empty questions (errors) and one-segment events by reusing aggregated questions; skips gracefully if none.
- **Resume protections**: Resume controls debounce rapid clicks; backend emits warnings via `X-Warning` header when resuming with zero participants.***

