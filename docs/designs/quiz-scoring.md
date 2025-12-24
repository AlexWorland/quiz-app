# Quiz Scoring Pipeline Design

## Goals
- Persist per-question scoring so leaderboards reflect correct, incorrect, and missed answers.
- Assign zero to missed/late-join questions to keep fairness and consistent totals.
- Keep existing real-time flow: reveal/segment/event completion already broadcast leaderboards.
- Minimize schema churn by using existing tables (`segment_scores`, `event_participants`).

## Scope
- Backend (FastAPI/WebSocket) only for scoring logic and leaderboards.
- Frontend consumes existing leaderboard payloads; no scoring logic in the client.
- Tests: backend unit/integration; targeted e2e (mocked WS) to ensure scores/leaderboards surface.

## Data Model
- `segment_scores` already holds: `score`, `questions_answered`, `questions_correct`, `total_response_time_ms`.
- `event_participants.total_score` is the event-level aggregate.
- No DB migration required.

## Scoring Rules
- Correct answer: speed-based score using `calculate_speed_based_score(time_limit_ms, response_time_ms)`.
  - With a 30s default, max 1000, min 1.
- Incorrect answer: 0 points, counts as answered, not correct.
- Missed/late (no answer by reveal or next-question advance): 0 points, counts as answered, not correct.
- Duplicate answers: rejected (existing check).
- Late-join block stays; missed questions before activation get zero on close.

## Backend Changes
1) **Helpers (scoring service)**
   - `upsert_segment_score(db, segment_id, participant_id)` to fetch/create the row.
   - `apply_score(db, segment_id, participant_id, delta_score, is_correct, response_time_ms)`:
     - Increment `questions_answered`, `questions_correct` when `is_correct`.
     - Add `delta_score` to segment_score and `total_score` on `event_participants`.
     - Add `response_time_ms` to `total_response_time_ms` (if provided).

2) **Answer handling (WS game_handler)**
   - On `answer` message:
     - Look up current question from `session.game_state.questions`.
     - Compute correctness and `delta_score` (speed-based when correct; 0 otherwise).
     - Call `apply_score`; keep `answers_received` for dedupe/all_answered.

3) **Zero-fill on question close**
   - On `reveal_answer` (or when advancing past last question):
     - Determine participants who did not answer (and any late joiners still in waiting state).
     - Apply `delta_score = 0`, `is_correct=False`, `response_time_ms=None`.
   - Transition late joiners from `waiting_for_segment` to `active_in_quiz` on the next question broadcast.

4) **Leaderboards**
   - After scoring, refresh segment/event leaderboards:
     - Include in `reveal` payloads.
     - Already included in `segment_complete` and `event_complete`.

## Frontend Impact
- No scoring logic added.
- Existing screens already render leaderboards from websocket messages; they will reflect new scores/zeros automatically.

## Edge Cases
- Participant answers right as timer expires: existing time check rejects after limit; no score applied.
- Missing question metadata: if question not found in cache, return error.
- Late joiners: blocked for current question; zero applied on close; activated for subsequent questions.
- Reconnects: rely on participant ID; scoring uses DB, so duplicate prevention stays via `answers_received`.

## Testing Plan
- **Backend pytest**
  - Correct answer adds speed-based score; incorrect adds 0; totals aggregate.
  - Missed question (no answer) yields zero and increments `questions_answered`.
  - Late joiner blocked and receives zero on close; becomes active next question.
  - Leaderboard ordering reflects scores and ties broken by `total_response_time_ms`.
- **E2E (mocked WS, optional)**
  - Join mid-question → blocked; reveal applies zero.
  - Next question answered correctly updates leaderboard with non-zero delta.

