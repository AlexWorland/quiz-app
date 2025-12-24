# Edge-Case & Missing-Feature Design Bundle

**Scope:** Design proposals to close the remaining gaps called out in `USER_STORIES_IMPLEMENTATION_STATUS_2025-01-21_UPDATED.md`. Each section is a stand-alone mini-design with goals, current state, proposed approach, data/WS/API changes, UX notes, risks, and test plan.

---

## 1) Segment Flow: “No Questions Generated” Handler (Frontend)
**Goal:** When a segment has zero questions (generation failed or manual entry missing), guide the host to continue smoothly (skip, regenerate, or add manually) without blocking the event.

**Current State:**
- Backend supports question generation and segment progression.
- Frontend lacks a dedicated “no questions” path for quiz-ready segments that have 0 questions (status doc flagged).

**Proposal:**
- Add a `no-questions` UI card in host view (`EventHost.tsx`) shown when segment status is `quiz_ready` or `completed` with zero questions and no mega-quiz ready state.
- Actions:
  - “Retry Generation” (listen-only) → re-trigger recording/restart flow (existing `handleRestartRecording`).
  - “Add Questions Manually” → focus “Add” tab or open bulk import.
  - “Skip Segment” → existing skip flow.
- Block “Start Quiz” until ≥1 question.

**Data/WS/API Changes:** None.

**UX Notes:** Reuse `NoQuestionsNotice` but make entry unconditional when question count is 0; add concise explainer text.

**Risks:** None major; ensure not shown during mega-quiz-ready state.

**Test Plan:**
- Unit: render condition shows card when questions.length === 0 and status in {quiz_ready, completed} and no mega quiz.
- E2E2: create event/segment with zero questions → host sees card, “Start Quiz” disabled; “Skip Segment” works; “Retry Generation” calls restart in listen-only.

---

## 2) Leaderboard: Tie-Break Reason Tooltips
**Goal:** Surface why a participant ranks higher when scores are equal (faster response time).

**Current State:**
- Tie-breaking logic exists (score desc, response_time asc). UI tooltip missing.

**Proposal:**
- In leaderboard rows (`MasterLeaderboard`, `SegmentLeaderboard`, final results), when consecutive entries share the same score, show an info icon with tooltip “Faster response time” (or “Earlier submission”) and display response-time delta if available.
- Add optional prop `showTieTooltip` default true to avoid regressions.

**Data/WS/API Changes:** Ensure response_time_ms is available in leaderboard payload; if absent, omit delta and keep generic message.

**UX Notes:** Small icon; accessible title; keep layout stable.

**Risks:** None.

**Test Plan:**
- Unit: render rows with equal scores yields tooltip.
- E2E: mocked data with ties shows tooltip content.

---

## 3) Presenter Rotation Edge Cases
### 3a) Pass to Disconnected Participant Feedback
**Goal:** Give immediate UI feedback when attempting to pass presenter to an offline participant.
**Current State:** Backend returns error; UI shows generic error via alert.
**Proposal:** In `PassPresenterButton`, inspect response and show inline error toast “Cannot pass presenter to disconnected participant. Select someone online.” Also gray out offline participants (needs online list from WS).
**Data/WS/API:** Expose connection presence in WS participant info (boolean `online`), or derive from `connections` broadcast. Minimal change: include `online` in `ParticipantInfo`.
**Risks:** Keep payload small; optional field.
**Test:** Unit for button disabling; e2e2 mock WS to send offline state and expect inline error.

### 3b) All Participants Disconnect Handling
**Goal:** If everyone leaves, pause the quiz and notify host to wait or end.
**Proposal:** When `participant_count` drops to 0 during an active quiz, hub sets `presenter_paused=true`, phase `presenter_paused`, broadcasts `presenter_paused` with reason “all_disconnected”, host sees banner “All participants disconnected—waiting for rejoin”.
**Data/WS:** Extend `PresenterPausedMessage` with `reason?: string` (“all_disconnected”). Frontend shows specific banner copy.
**Test:** Unit: hub transitions to paused when count hits zero; mock WS e2e2 for banner.

### 3c) Presenter Disconnects Before Selection
**Goal:** If the current presenter disconnects before picking next, host gets a guided prompt to assign a new presenter, participants see waiting banner.
**Current:** Host gets disconnected message; participant-facing feedback partial.
**Proposal:** Reuse `presenter_paused` reason `presenter_disconnected`; host banner already exists; participant view shows “Presenter disconnected, waiting for host to assign a replacement.”
**Data/WS:** Same `reason` field.
**Test:** e2e2 mock WS to show banner for participants; unit for message parsing.

---

## 4) Recovery Edge Cases
### 4a) Resume After All Participants Left
**Goal:** If resume is triggered while no participants are connected, warn host and keep phase paused until someone joins.
**Proposal:** On `resume_segment`/`resume_event`, backend checks connection count; if zero, return 200 with header `x-warning: no-participants` and broadcast `presenter_paused` reason `no_participants`. Host UI shows warning; controls disabled until participant joins; first join clears paused state.
**Test:** Backend unit to assert warning header + paused state; e2e2 mock WS for banner behavior.

### 4b) Multiple Rapid Resume Attempts Protection
**Goal:** Prevent double-resume race.
**Proposal:** Add in-memory debounce per event/segment (timestamp check) in resume endpoint; respond 429 or idempotent no-op within 2s window. Frontend disable button briefly after click.
**Test:** Unit: two rapid calls -> second 429 or noop; UI unit ensures button disables briefly.

---

## 5) Join Flow Edge Cases
### 5a) Single Device Per Event Enforcement
**Goal:** Enforce one active session per device per event.
**Proposal:** On join, if device_id already active for that event, return 409 with message “This device is already joined. Reopen your existing session.” Provide `is_rejoining` and participant id in body; frontend redirects to participant view with that token. WS join should reject duplicate connection for same device_id (drop second).
**Data:** DB already stores device_id; need an index + query on `event_id, device_id` active. Frontend: handle 409 with rejoin CTA.
**Test:** API unit for 409 and rejoin body; e2e2: join twice with same device → second gets redirected/rejoin message.

### 5b) QR Lock Reminder After 5+ Minutes
**Goal:** Remind host when join lock left on.
**Proposal:** Reuse existing join-lock timer but surface a toast/banner after 5 minutes; add WS/admin notification optional. No backend change needed if UI polls lock status; or add periodic WS `join_lock_status` broadcast (low priority).
**Test:** Unit: timer triggers reminder flag; e2e2 (mock timers) shows banner.

### 5c) Answer Submission at Timeout Boundary
**Goal:** Deterministic handling of answers at expiry.
**Proposal:** In `hub.record_answer`, allow answers where `elapsed <= time_limit_seconds + grace_ms` (default grace 0). To avoid ambiguity, set grace to 0 and return explicit error “Time expired” if `elapsed >= time_limit_seconds`. Log timing data for audit. Frontend: show precise message.
**Test:** Unit with submitted_at exactly at limit → rejected with `too_late`; one ms before → accepted.

---

## 6) Mega Quiz Edge Cases
### 6a) Single-Segment Event
**Goal:** Mega quiz should still work (or be skipped) when only one segment exists.
**Proposal:** If only one segment, still allow mega quiz (it’s just a second round) or auto-skip with message “Only one segment—showing final results.” Add toggle in host UI when segments == 1: “Run final quiz remix” vs “Skip to results.”
**Test:** Unit: aggregation with 1 segment returns questions; e2e2: create single segment event, finish segment, see choice.

### 6b) Participants Leave Before Mega Quiz
**Goal:** Handle missing participants gracefully.
**Proposal:** Before starting mega quiz, snapshot current participants; if zero, prompt host “No participants connected—start anyway or wait?” and allow start. If started with zero, keep quiz paused until first participant joins (use `presenter_paused` reason `no_participants`). Answers from late joiners allowed.
**Test:** Unit for start with zero participants sets paused; e2e2 mock WS for banner.

---

## 7) UI Polish & Participant-Facing Feedback
### 7a) Presenter Disconnect Feedback to Participants
**Goal:** Participants see a clear waiting state when presenter disconnects.
**Proposal:** We already added a pause banner; add reason string (“Presenter disconnected—waiting for host”) and disable answer buttons until phase changes off `presenter_paused`.
**Data/WS:** Use `PresenterPausedMessage.reason` and surface on frontend.
**Test:** E2E2 mock WS for pause message shows banner and disabled answers.

---

## Cross-Cutting Notes
- **Schema/Indices:** Add DB index on `event_id, device_id` for device enforcement.
- **WS Message Extension:** Add optional `reason` to `PresenterPausedMessage`.
- **Frontend Disablement:** Ensure controls respect `presenter_paused` for host and participants (already added; extend to new reasons).
- **Telemetry:** Log pause/resume reason and answer timing rejections for observability.

---

## Testing Matrix (minimal)
- Unit (backend): `record_answer` boundary, resume debounce, device duplicate join, presenter_paused reasons.
- Unit (frontend): banners, tooltips, disabled states, timer-based reminders.
- E2E2: zero-questions flow, presenter pause banners (already added), device rejoin enforcement, single-segment mega quiz choice, pass-to-offline feedback.

---

## Rollout & Flags
- Add env flag for `ANSWER_TIMEOUT_GRACE_MS` (default 0).
- Optional flag `ENFORCE_SINGLE_DEVICE=true` to gate enforcement.
- Feature flag `MEGA_QUIZ_SINGLE_SEGMENT_MODE=remix|skip` (default remix).

---

## Out of Scope
- Full network-loss buffering/replay; treated separately.
- AI provider fallbacks beyond existing handlers.

