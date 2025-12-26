# Work Item 025: Automatic Segment Generation and Dynamic Presenter Flow

## Overview

This work item implements automatic segment generation when a presenter starts their presentation, removes the need for manual segment creation, and allows participants to join events before segments exist.

## User Stories

### US-1: Host Selects First Presenter
**As a** host  
**I want to** select the first presenter from joined participants  
**So that** I can start the event without manually creating segments first

**Acceptance Criteria:**
- Host can see a list of joined participants
- Host can select any participant as the first presenter
- Segment is NOT created yet - just presenter is assigned
- Selected presenter is notified they are the presenter

### US-2: Presenter Starts Recording
**As a** presenter  
**I want to** see a "Start" button and start recording when ready  
**So that** I can control when my presentation begins

**Acceptance Criteria:**
- Presenter sees a "Start Presentation" button
- When clicked, a new segment is automatically created
- Recording begins immediately
- Segment status is set to "recording"
- Other participants see that the segment has started

### US-3: Presenter Generates Quiz
**As a** presenter  
**I want to** press "Generate Quiz" to end recording and create questions  
**So that** I can transition from presenting to quizzing

**Acceptance Criteria:**
- Recording stops when "Generate Quiz" is pressed
- Quiz generation begins (transcription + question generation)
- Flappy Bird game shows during generation
- Quiz starts automatically when ready

### US-4: Segment Ends After Leaderboards
**As a** presenter  
**I want** the segment to end after leaderboards are shown  
**So that** I can pass control to the next presenter

**Acceptance Criteria:**
- Segment completes after final leaderboard display
- Presenter sees option to select next presenter
- Cannot select themselves as next presenter

### US-5: Select Next Presenter
**As a** presenter or host  
**I want to** select the next presenter from online participants  
**So that** the event can continue with another presenter

**Acceptance Criteria:**
- List shows only online participants
- Current presenter cannot select themselves
- Selected presenter becomes the new presenter
- New presenter sees "Start Presentation" button

### US-6: Join Event Without Segments
**As a** participant  
**I want to** join an event even if no segments exist yet  
**So that** I can be ready when the first presenter starts

**Acceptance Criteria:**
- Join works without segments existing
- Participants see "Waiting for host to select presenter" message
- Host can select any joined participant as first presenter

## Technical Requirements

### Backend Changes

#### 1. New WebSocket Messages (messages.py)

```python
class SelectPresenterMessage(BaseModel):
    type: str = "select_presenter"
    presenter_user_id: UUID

class PresenterSelectedMessage(BaseModel):
    type: str = "presenter_selected"
    presenter_id: UUID
    presenter_name: str
    is_first_presenter: bool = False

class StartPresentationMessage(BaseModel):
    type: str = "start_presentation"

class PresentationStartedMessage(BaseModel):
    type: str = "presentation_started"
    segment_id: UUID
    presenter_id: UUID
    presenter_name: str
```

#### 2. Game Handler Changes (game_handler.py)

- Add `select_presenter` message handler
  - Validates user is host or current presenter
  - Validates selected user is a participant and online
  - Validates selected user is not the current presenter (for pass_presenter)
  - Stores pending presenter in game state
  - Broadcasts `presenter_selected` to all

- Add `start_presentation` message handler
  - Validates user is the pending presenter
  - Creates new segment via database
  - Starts recording via API
  - Updates game state with new segment
  - Broadcasts `presentation_started` to all

- Modify segment completion logic
  - After final leaderboard, set segment status to completed
  - Clear current presenter
  - Broadcast segment_complete with option to select next presenter

#### 3. Join Handler Changes (join.py)

- Allow joining when no segments exist
- Return appropriate join status for segment-less events

#### 4. GameState Changes (hub.py)

Add to GameState:
```python
pending_presenter_id: UUID | None = None
pending_presenter_name: str | None = None
```

### Frontend Changes

#### 1. EventDetail.tsx (Host View)
- Remove "Add Segment" form requirement
- Add presenter selection dropdown
- "Select as First Presenter" button
- Handle `presenter_selected` message

#### 2. EventHost.tsx (Presenter View)
- Show "Start Presentation" button for pending presenter
- Handle presentation start flow
- After segment_complete, show "Select Next Presenter" UI
- Filter out self from presenter selection list

#### 3. EventParticipant.tsx (Participant View)
- Show "Waiting for host to select presenter" when no active segment
- Handle transition to active quiz state

#### 4. useEventWebSocket.ts
- Add new message types to ServerMessage union
- Handle `presenter_selected` message
- Handle `presentation_started` message

#### 5. API Endpoints (endpoints.ts)
- Add `startPresentation` API call (creates segment + starts recording)

### Database Changes

No schema changes required - using existing Segment model.

## Implementation Plan

### Phase 1: Backend WebSocket Messages
1. Add new message types to messages.py
2. Add message parsing to parse_client_message

### Phase 2: Backend Game Handler
1. Add select_presenter handler
2. Add start_presentation handler
3. Modify pass_presenter to enforce not selecting self
4. Update segment completion flow

### Phase 3: Backend Join Flow
1. Update join handler to allow segment-less events
2. Update join status logic

### Phase 4: Frontend Host Flow
1. Update EventDetail with presenter selection
2. Update EventHost with start presentation button
3. Update segment complete flow

### Phase 5: Frontend Participant Flow
1. Update waiting states
2. Handle new message types

### Phase 6: Tests
1. Unit tests for new handlers
2. E2E2 tests for full flow

## Test Scenarios

### Unit Tests

1. `test_select_presenter_as_host` - Host can select presenter
2. `test_select_presenter_validates_participant` - Can't select non-participant
3. `test_select_presenter_validates_online` - Can't select offline participant
4. `test_start_presentation_creates_segment` - Segment created on start
5. `test_start_presentation_validates_pending_presenter` - Only pending presenter can start
6. `test_pass_presenter_excludes_self` - Can't pass to self
7. `test_join_without_segments` - Join works without segments

### E2E2 Tests

1. `test_full_presenter_flow` - Host selects presenter, presenter starts, generates quiz, passes to next
2. `test_join_before_segments` - Participant joins before any segments exist
3. `test_presenter_cannot_select_self` - Validates self-selection prevention

## API Endpoints

### POST /api/segments/{event_id}/start-presentation
Create segment and start recording for the pending presenter.

**Request Body:**
```json
{
  "title": "optional segment title"
}
```

**Response:**
```json
{
  "id": "uuid",
  "event_id": "uuid",
  "presenter_user_id": "uuid",
  "presenter_name": "string",
  "status": "recording",
  "recording_started_at": "datetime"
}
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Race condition in presenter selection | Use hub locks and validate in handler |
| Presenter disconnects before starting | Show "waiting for presenter" message, allow host override |
| Multiple rapid presenter changes | Debounce on frontend, validate state on backend |

## Definition of Done

- [x] All acceptance criteria met
- [x] Unit tests pass
- [x] E2E2 tests pass
- [ ] Code reviewed
- [ ] No regressions in existing tests

## Implementation Summary

### Completed Changes

#### Backend (Python)

1. **WebSocket Messages** (`backend-python/app/ws/messages.py`)
   - Added `SelectPresenterMessage` for host to select presenter
   - Added `PresenterSelectedMessage` broadcast to all participants
   - Added `StartPresentationMessage` for presenter to start
   - Added `PresentationStartedMessage` broadcast when presentation begins
   - Added `WaitingForPresenterMessage` for participants waiting

2. **Game Handler** (`backend-python/app/ws/game_handler.py`)
   - Added `select_presenter` handler - validates host, looks up presenter, broadcasts selection
   - Added `start_presentation` handler - creates segment, starts recording, broadcasts start
   - Modified `pass_presenter` to prevent self-selection

3. **GameState** (`backend-python/app/ws/hub.py`)
   - Added `pending_presenter_id` and `pending_segment_id` fields

4. **Join Handler** (`backend-python/app/ws/join.py`)
   - Already supported joining without segments (no changes needed)

#### Frontend (React/TypeScript)

1. **useEventWebSocket Hook** (`frontend/src/hooks/useEventWebSocket.ts`)
   - Added `pendingPresenter` and `isPendingPresenter` state
   - Added handlers for `presenter_selected` and `presentation_started` messages
   - Updated `ServerMessage` and `GameMessage` types

2. **EventDetail.tsx** (`frontend/src/pages/EventDetail.tsx`)
   - Added presenter selection UI for host
   - Shows list of online participants
   - Sends `select_presenter` WebSocket message

3. **EventParticipant.tsx** (`frontend/src/pages/EventParticipant.tsx`)
   - Added "Start Presentation" button for selected presenter
   - Shows "Waiting for presenter to start" for non-presenters
   - Shows "Waiting for host to select presenter" before selection
   - Handles navigation to host view on presentation start

4. **EventHost.tsx** (`frontend/src/pages/EventHost.tsx`)
   - Added auto-start recording when arriving at recording segment

### New Tests

1. **Backend Unit Tests** (`backend-python/tests/test_automatic_segment_generation.py`)
   - `test_join_event_without_segments`
   - `test_segment_creation_on_start_presentation`
   - `test_segment_order_index_increments`
   - `test_pass_presenter_self_selection_prevented`
   - `test_pass_presenter_to_different_user_succeeds`
   - `test_host_can_select_any_presenter`
   - `test_only_host_can_select_first_presenter`
   - `test_segment_status_transitions`
   - `test_presenter_lookup_by_user_id`
   - `test_multiple_participants_can_join_before_segments`

2. **Frontend Unit Tests** (`frontend/src/hooks/__tests__/useEventWebSocket.test.ts`)
   - Added tests for `presenter_selected` message handling
   - Added tests for `isPendingPresenter` state
   - Added tests for `presentation_started` message handling
   - Added tests for `presenter_changed` message handling

3. **E2E2 Tests** (`frontend/e2e2/tests/automatic-segment-generation.e2e2.spec.ts`)
   - `participant can join event without segments`
   - `host sees presenter selection UI on event detail page`
   - `selected presenter sees Start Presentation button`
   - `non-selected participant sees waiting message`
   - `clicking Start Presentation sends WS message`
   - `presentation_started message redirects presenter to host view`
   - `waiting_for_presenter message shows appropriate UI`

