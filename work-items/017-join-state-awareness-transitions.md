# TICKET-017: Join State Awareness - State Transitions

**Priority:** 🟡 MEDIUM
**Effort:** 1.5-2 hours
**Status:** Pending
**Depends On:** TICKET-016

---

## Description

Implement state machine to transition participants through join states based on quiz phase changes. This ensures participants are correctly tracked as they move through different stages of the quiz lifecycle: joining, waiting for segment to start, actively participating, and completing segments.

## Files to Modify

### 1. `backend/src/ws/messages.rs`

Add new server message for join status changes:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing variants ...

    #[serde(rename = "join_status_changed")]
    JoinStatusChanged {
        device_id: String,
        user_id: Uuid,
        new_status: String, // "joined", "waiting_for_segment", "active_in_quiz", "segment_complete"
    },
}
```

### 2. `backend/src/ws/hub.rs`

Add helper method to transition all participants to a new join state:

```rust
impl Hub {
    // ... existing methods ...

    /// Transition all participants to a new join status
    pub async fn transition_participant_status(
        &self,
        event_id: Uuid,
        new_status: &str,
    ) -> Vec<(String, Uuid)> {
        // Returns list of (device_id, user_id) pairs that were transitioned
        let mut transitioned = Vec::new();

        let sessions = self.event_sessions.read().await;
        if let Some((_, game_state)) = sessions.get(&event_id) {
            for participant in game_state.participants.values() {
                // In a full implementation, we'd update a participant status field
                // For now, we return the list to be broadcast
                transitioned.push((
                    format!("device_{}", participant.user_id), // Placeholder device_id
                    participant.user_id,
                ));
            }
        }

        transitioned
    }

    /// Transition specific participant to new status
    pub async fn transition_single_participant(
        &self,
        event_id: Uuid,
        user_id: Uuid,
        new_status: &str,
    ) -> Option<String> {
        // Returns device_id if participant exists
        let sessions = self.event_sessions.read().await;
        if let Some((_, game_state)) = sessions.get(&event_id) {
            if game_state.participants.contains_key(&user_id) {
                return Some(format!("device_{}", user_id)); // Placeholder
            }
        }
        None
    }
}
```

### 3. `backend/src/ws/handler.rs`

Update message handlers to trigger state transitions at appropriate times:

```rust
// In handle_start_game (when quiz starts)
async fn handle_start_game(
    state: &AppState,
    event_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    // ... existing start game logic ...

    // Transition all participants from 'waiting_for_segment' to 'active_in_quiz'
    let transitioned = state.hub
        .transition_participant_status(event_id, "active_in_quiz")
        .await;

    // Broadcast status changes to all clients
    for (device_id, participant_user_id) in transitioned {
        broadcast_ws_message(
            &state.hub,
            event_id,
            ServerMessage::JoinStatusChanged {
                device_id,
                user_id: participant_user_id,
                new_status: "active_in_quiz".to_string(),
            },
        ).await;
    }

    // ... rest of start game logic ...

    Ok(())
}

// In handle_end_game (when segment ends)
async fn handle_end_game(
    state: &AppState,
    event_id: Uuid,
    segment_id: Uuid,
    user_id: Uuid,
) -> Result<()> {
    // ... existing end game logic ...

    // Set quiz phase to segment complete
    state.hub.set_quiz_phase(event_id, QuizPhase::SegmentComplete).await;

    // Transition all participants from 'active_in_quiz' to 'segment_complete'
    let transitioned = state.hub
        .transition_participant_status(event_id, "segment_complete")
        .await;

    // Broadcast status changes
    for (device_id, participant_user_id) in transitioned {
        broadcast_ws_message(
            &state.hub,
            event_id,
            ServerMessage::JoinStatusChanged {
                device_id,
                user_id: participant_user_id,
                new_status: "segment_complete".to_string(),
            },
        ).await;
    }

    // ... rest of end game logic ...

    Ok(())
}

// When participant first joins
GameMessage::Join { user_id, session_code } => {
    // ... existing join logic ...

    // Determine initial status based on current quiz phase
    let game_state = state.hub.get_game_state(event_id).await;
    let initial_status = match game_state.map(|s| s.quiz_phase) {
        Some(QuizPhase::NotStarted) => "joined",
        Some(QuizPhase::ShowingQuestion) |
        Some(QuizPhase::RevealingAnswer) |
        Some(QuizPhase::ShowingLeaderboard) |
        Some(QuizPhase::BetweenQuestions) => "active_in_quiz",
        Some(QuizPhase::SegmentComplete) => "segment_complete",
        Some(QuizPhase::EventComplete) => "event_complete",
        None => "joined",
    };

    // Add participant with status
    state.hub.add_participant(
        event_id,
        Participant {
            user_id: *user_id,
            username: username.clone(),
            avatar_url: avatar_url.clone(),
        },
    ).await;

    // Broadcast join status
    broadcast_ws_message(
        &state.hub,
        event_id,
        ServerMessage::JoinStatusChanged {
            device_id: device_id.clone(),
            user_id: *user_id,
            new_status: initial_status.to_string(),
        },
    ).await;

    // ... rest of join logic ...
}

// When recording ends and segment is ready (in audio handler or segment update)
async fn on_segment_recording_complete(
    state: &AppState,
    event_id: Uuid,
    segment_id: Uuid,
) -> Result<()> {
    // Transition participants from 'joined' to 'waiting_for_segment'
    let transitioned = state.hub
        .transition_participant_status(event_id, "waiting_for_segment")
        .await;

    for (device_id, user_id) in transitioned {
        broadcast_ws_message(
            &state.hub,
            event_id,
            ServerMessage::JoinStatusChanged {
                device_id,
                user_id,
                new_status: "waiting_for_segment".to_string(),
            },
        ).await;
    }

    Ok(())
}
```

## Implementation Steps

1. **Add message type** in `backend/src/ws/messages.rs`:
   - Add `JoinStatusChanged` variant to `ServerMessage` enum
   - Include `device_id`, `user_id`, and `new_status` fields

2. **Update Hub** in `backend/src/ws/hub.rs`:
   - Add `transition_participant_status()` method for bulk transitions
   - Add `transition_single_participant()` method for individual transitions
   - Methods should return list of affected participants for broadcasting

3. **Update join handler** in `backend/src/ws/handler.rs`:
   - Determine initial join status based on current quiz phase
   - Send `JoinStatusChanged` message on initial join
   - Map `QuizPhase` to appropriate join status

4. **Update start_game handler**:
   - Call `transition_participant_status()` with "active_in_quiz"
   - Broadcast `JoinStatusChanged` to all participants
   - Transition happens when quiz starts

5. **Update end_game handler**:
   - Call `transition_participant_status()` with "segment_complete"
   - Broadcast `JoinStatusChanged` to all participants
   - Transition happens when segment ends

6. **Add recording complete handler**:
   - Transition participants from "joined" to "waiting_for_segment"
   - Trigger when segment recording ends and questions are ready
   - Broadcast status change to all participants

7. **Test state transitions**:
   - Verify participants move through states correctly
   - Check that broadcasts reach all connected clients
   - Ensure status persists across reconnections (if implemented)

## Acceptance Criteria

- [ ] `JoinStatusChanged` message type added to `ServerMessage` enum
- [ ] `transition_participant_status()` method implemented in Hub
- [ ] `transition_single_participant()` method implemented in Hub
- [ ] Join handler determines correct initial status based on quiz phase
- [ ] Initial join status broadcast when participant joins
- [ ] Participants transition to "waiting_for_segment" when recording ends
- [ ] Participants transition to "active_in_quiz" when quiz starts (start_game)
- [ ] Participants transition to "segment_complete" when segment ends (end_game)
- [ ] All state changes broadcast via WebSocket to all event participants
- [ ] State transitions match quiz phase transitions
- [ ] No compiler errors or warnings
- [ ] Code compiles with `cargo build`

## Testing

```bash
cd backend
cargo test join_state_transitions
cargo test participant_status_changes
cargo build --release
```

Manual testing:
1. Join an event before segment starts - should receive "joined" status
2. Wait for recording to complete - should transition to "waiting_for_segment"
3. Start quiz - should transition to "active_in_quiz"
4. Complete segment - should transition to "segment_complete"
5. Join mid-quiz - should receive "active_in_quiz" status immediately

## Dependencies

- TICKET-016: Join State Awareness - Broadcast join status (provides initial join status tracking)

## Related Tickets

- TICKET-016: Join State Awareness - Broadcast (prerequisite)
- TICKET-018: Join State Awareness - Frontend UI (consumes these status changes)

## Notes

- Join status states: `"joined"`, `"waiting_for_segment"`, `"active_in_quiz"`, `"segment_complete"`, `"event_complete"`
- State transitions are triggered by quiz phase changes
- All participants in an event transition together (bulk transitions)
- Individual transitions used for new joiners to match current phase
- Device IDs are placeholder implementations until TICKET-001 is complete
- Status should eventually be persisted to database for reconnection resilience
- Frontend will use these status changes to update participant UI (TICKET-018)
