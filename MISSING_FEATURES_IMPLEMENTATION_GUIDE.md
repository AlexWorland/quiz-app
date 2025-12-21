# Missing Features Implementation Guide

This guide outlines how to implement the outstanding user stories listed in `USER_STORIES.md`. It focuses on the missing or partially implemented items identified in `REMAINING_WORK.md` and the `work-items/` tickets. Some quick wins below are now implemented (marked ✅).

## Contents
- ✅ Quick Wins Completed
- QR-Only Join & Display
- Device Identity, Duplicate Prevention, Rejoin
- Late Join Rules & Join Status
- QR Lock/Unlock Controls
- Resume Accidentally Ended Segment/Event
- Network Resilience & Duplicate Join Attempts
- Camera/QR Error Handling
- Leaderboard Nuances (Late Join Indicators, Ties, All-Zero)
- Presenter Rotation Edge Cases
- Account/Profile Management

---

## ✅ Quick Wins Completed
- LICENSE added at repo root (MIT)
- Audio format fallback warning implemented and tested (see `AudioFormatNotice` in `frontend/src/components/recording/AudioFormatNotice.tsx` and host wiring)

---

## QR-Only Join & Display
**Related stories:** Join via QR, Required QR Scan, Display Join QR, Persistent QR, Simultaneous scans, QR display failure fallback.
**Related tickets:** 004, 005, 009, 023.

### Backend
- Add endpoint to fetch/generate join QR payload: `GET /events/:id/qr` returning join code + QR data (PNG/SVG or text to render client-side).
- Ensure join code validity window (persistent across event unless locked/ended).
- Add rate limiting on QR fetch to prevent abuse.

### Frontend
- Replace manual code entry with QR scanner UI; auto-join via scanned payload.
- Show large, high-contrast QR on presenter screen; add fallback manual code for failure case.
- Handle simultaneous scans by making join idempotent on device+event (ties into device identity).

### Acceptance
- Only QR-based join in UI; manual input removed except fallback.
- Presenter screen shows scannable QR with refresh handling.
- Scanning concurrently does not error; all valid scans join.
- Clear error for invalid/expired QR.

### Testing
- Unit: QR payload parsing/validation.
- Integration: scan flow end-to-end, concurrent scan simulation, fallback path.
- UI: responsiveness and accessibility (camera permissions prompts).

---

## Device Identity, Duplicate Prevention, Rejoin
**Related stories:** Prevent duplicate players, Device identity binding, Rejoin via QR, Username already taken, Device identity changes mid-session.
**Related tickets:** 001-003, 013-015.

### Backend
- Wire `device_id`, `session_token`, `join_timestamp`, `last_heartbeat` columns (already migrated) into join handler: generate fingerprint/token, enforce `(event_id, device_id)` uniqueness, return session token.
- Persist/refresh `last_heartbeat` on websocket pings; drop/expire stale sessions.
- Rejoin endpoint: if device/session_token match and event active, restore participant state (score, role, join_status) and issue new token if needed.
- Conflict responses for duplicate devices; graceful message for expired/ended event.

### Frontend
- Add device fingerprint utility (per TICKET-003) with localStorage persistence.
- Pass device fingerprint on join; store returned device_id/session_token in auth store; attach to websocket query params and axios headers.
- Rejoin flow: if tokens exist, attempt silent rejoin before showing errors.
- UX for “username taken” and “device already joined” conflicts.

### Acceptance
- Same device cannot join same event twice; receives 409 with clear message.
- Rejoin after refresh/disconnect restores prior score/state.
- Heartbeat updates keep active users connected; stale sessions expire.

### Testing
- Unit: fingerprint generation determinism; token validation logic.
- Integration: duplicate join attempt, rejoin after disconnect, heartbeat expiration.
- UI: conflict error surfaces, silent rejoin success path.

---

## Late Join Rules & Join Status
**Related stories:** Late join during presentation/quiz, scoring rules (missed questions = zero), join state awareness.
**Related tickets:** 016-019, 021-022.

### Backend
- Use `join_status` column to track states (`joined`, `waiting_for_segment`, `active_in_quiz`, `segment_complete`).
- On segment start, include only `active_in_quiz` participants for answering; late joiners are `waiting_for_segment` until next question.
- Score missed earlier questions as zero by default (exclude from attempts but keep total questions for fairness in ranking).
- Expose join status via websocket and REST so clients can render state.

### Frontend
- Show banner/state chip: joined → waiting → active → complete.
- Disable answer UI when `waiting_for_segment`; auto-enable on next question.
- Indicate late joiners in leaderboard (see next section).

### Acceptance
- Late join cannot answer current in-flight question; can answer next.
- Missed questions count as zero, not disqualification.
- UI reflects status transitions accurately.

### Testing
- Integration: join mid-question, ensure answers rejected; join before next question, answers accepted.
- State machine unit tests for join_status transitions.

---

## QR Lock/Unlock Controls
**Related stories:** Lock QR joining, unlock, lock while mid-scan, reminder to unlock.
**Related tickets:** 010-012.

### Backend
- Add websocket messages `lock_qr`/`unlock_qr` and broadcast `qr_locked` with actor/timestamp.
- In join handler, return 409 when `qr_locked = true`.
- Ensure idempotency (locking twice is safe) and host-only permission.

### Frontend
- Presenter UI: toggle button with visual locked state + reminder timer.
- Join UI: show “joining locked” error and retry guidance.

### Acceptance
- Lock prevents new joins immediately; existing participants unaffected.
- Unlock restores ability to join; reminder appears after prolonged lock.

### Testing
- Integration: lock then attempt join → 409; unlock → join succeeds.
- UI: reminder timer and real-time state updates via websocket.

---

## Resume Accidentally Ended Segment/Event
**Related stories:** Resume segment/event, clear resume state, resume after all participants left, rapid resume attempts.
**Related tickets:** 006-008.

### Backend
- Leverage `previous_status`, `was_ended_at`, `end_reason` columns to snapshot before end.
- Add resume endpoints/actions: `POST /events/:id/resume`, `POST /segments/:id/resume` restoring prior state if within allowed window.
- Guard against repeated rapid resumes; enforce expiry (e.g., 30 minutes configurable).
- Broadcast resume state to clients; block new segments until cleared.

### Frontend
- Presenter modal: confirm resume with context (who ended, when, reason); option to clear resume state.
- Disable conflicting actions while resume pending; surface errors if window expired.

### Acceptance
- Ending a segment/event captures prior status; resume restores it when within window.
- Double-click/rapid resumes do not corrupt state.
- Clear resume state path exists and works.

### Testing
- Unit: resume eligibility logic, expiry enforcement.
- Integration: end → resume → continue quiz; resume after all participants left shows warning.

---

## Network Resilience & Duplicate Join Attempts
**Related stories:** Network loss after join, multiple simultaneous events, duplicate join attempts, browser tab closed during quiz.
**Related tickets:** 013-015.

### Backend
- Use `last_heartbeat` to keep participants active during temporary network loss; grace period before marking disconnected.
- Allow reconnect with existing device/session_token without score loss.
- Enforce single active event per device (or per user, configurable) to prevent multiple simultaneous events.

### Frontend
- Heartbeat/ping on event websocket; retry with backoff; show reconnecting banner.
- On tab close/reopen, attempt silent reconnect with stored device/session tokens.
- If joining another event while already in one, warn and require confirmation/leave.

### Acceptance
- Temporary disconnects within grace period do not drop scores or presence.
- Reconnect succeeds with same identity; duplicate simultaneous event join prevented per policy.

### Testing
- Integration: simulate network loss, reconnect within/after grace period.
- UI: reconnect banner, conflict warning when attempting second event.

---

## Camera/QR Error Handling
**Related stories:** Camera permission failure, WebRTC camera not supported, invalid/corrupted QR, invalid/expired QR, invalid event code handling.
**Related tickets:** 009, 023.

### Frontend
- Detect permission denial; show actionable steps (browser settings, reload prompt).
- Detect unsupported `getUserMedia`; offer fallback manual code entry if allowed, or alternate device guidance.
- Validate QR payload format; on invalid/expired, show clear error and retry instructions.
- Copyable support code for presenter to assist (e.g., event code display).

### Backend
- Expire QR payloads if encoded with TTL; return distinct errors for invalid vs expired vs not-found codes.

### Acceptance
- Users see clear guidance for camera denial/unsupported; can still join via permitted fallback.
- Invalid/corrupted QR produces informative error, not crash.

### Testing
- UI mocks for permission denied/unsupported; QR parsing unit tests; integration for invalid/expired code responses.

---

## Leaderboard Nuances (Late Indicators, Ties, All-Zero)
**Related stories:** Late join visibility, tie-breaking, all participants score zero.
**Related tickets:** 019, tie-breaking not ticketed yet.

### Backend
- Include `joined_at`/`join_status` in leaderboard payloads; flag late joiners.
- Tie-breaker field (e.g., fastest average response time) in leaderboard query; include reason string.
- Handle all-zero scores gracefully (no divide-by-zero, still render ranks).

### Frontend
- Mark late joiners with badge/icon; show tie-break reason on hover.
- Friendly empty/zero state for all-zero scores.

### Acceptance
- Leaderboard clearly marks late joiners; ties resolved deterministically with explanation.
- All-zero scenario renders without errors.

### Testing
- Query unit tests for tie-break logic; UI tests for badges and zero-state rendering.

---

## Presenter Rotation Edge Cases
**Related stories:** QR remains active across presenter changes, presenter role transfer without rejoin, pass to disconnected participant, all potential presenters disconnect.
**Related tickets:** 020-022 (and multi-presenter doc).

### Backend
- Ensure pass-presenter handler validates target is connected or recently connected; give clear error if disconnected.
- If all presenters disconnected, broadcast paused/recovery state and keep QR valid.
- Keep presenter change state in hub; ensure event completion logic considers presenter handoff.

### Frontend
- Surface presenter change events in UI; indicators for current presenter.
- Block passing presenter to offline users; show selectable list of active participants only.
- Recovery UI when all presenters disconnected (pause quiz, show instructions).

### Acceptance
- Presenter can hand off without rejoin; QR remains valid during handoff.
- Attempting to pass to disconnected participant shows error and does not change state.
- All-presenter-disconnect triggers visible recovery flow.

### Testing
- Integration: handoff success path; handoff to disconnected user; all presenters disconnect.

---

## Account/Profile Management
**Related stories:** Manage account settings, change username/avatar, validation for taken usernames and invalid/oversize avatar uploads, live profile updates in active event.

### Backend
- Add profile update endpoints: change username (unique constraint errors mapped to 409), update avatar with size/format validation and storage integration.
- Emit profile-updated events to active sessions so leaderboards and presence update live.

### Frontend
- Account settings page with username change + feedback on duplicates; avatar upload with size/type checks and progress UI.
- Live updates in event UI when profile changes (avatar/name refresh in participant lists/leaderboards).

### Acceptance
- Username change enforces uniqueness with clear error.
- Avatar upload enforces max size and allowed formats; errors surfaced.
- Active event reflects profile changes without rejoin.

### Testing
- Unit: validation helpers; API error mapping.
- Integration: username conflict, avatar too large/wrong type, live UI update in session.

---

## Rollout & Testing Strategy
- Prioritize critical QR/device identity flow first (tickets 001-005, 010-015), then late-join/lock/resume, then presenter rotation and account management.
- Add integration tests (backend) for join/rejoin/lock/late-join; add frontend e2e for scan/join/reconnect.
- Feature flag risky additions (e.g., resume, lock reminders) for controlled rollout.

## Definition of Done (per feature)
- Schema and migrations applied and used in code paths.
- API contracts documented (OpenAPI or README updates).
- Frontend wired to new APIs with error handling and accessibility.
- Tests: unit + integration (backend) and UI/e2e (frontend) where applicable.
- Observability: logs and tracing around joins, locks, resumes, and reconnects.
