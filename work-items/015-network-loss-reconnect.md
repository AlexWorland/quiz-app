# TICKET-015: Network Loss Resilience - Reconnect Restoration

**Priority:** 🟡 HIGH
**Effort:** 2-2.5 hours
**Status:** Pending
**Depends On:** TICKET-013, TICKET-014

---

## Description

Implement automatic state restoration for participants who reconnect with the same device_id and session_token after temporary disconnection. When a participant reconnects within the grace period, restore their score, current question, and game state seamlessly.

## Files to Modify

### 1. `backend/src/routes/quiz.rs`

Add endpoint to check for existing participant and restore state:

```rust
use crate::ws::hub::ParticipantState;

#[derive(Debug, Serialize)]
pub struct ReconnectStateResponse {
    pub reconnected: bool,
    pub current_segment_id: Option<String>,
    pub current_question_index: Option<usize>,
    pub score: i32,
    pub participant_state: String,
    pub event_phase: String,
}

pub async fn check_reconnect_state(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<Json<ReconnectStateResponse>, AppError> {
    let device_id = query
        .get("device_id")
        .ok_or(AppError::BadRequest("Missing device_id"))?;
    let session_token = query
        .get("session_token")
        .ok_or(AppError::BadRequest("Missing session_token"))?;

    // Check if participant exists in hub
    if let Some(participant) = state.hub.get_participant(&event_id, device_id) {
        // Verify session token matches
        if participant.session_token != *session_token {
            return Err(AppError::Unauthorized("Invalid session token"));
        }

        // Check participant state
        match participant.state {
            ParticipantState::Connected | ParticipantState::TemporarilyDisconnected { .. } => {
                // Get game state from hub
                let game_state = state.hub.get_game_state(&event_id);

                // Get participant score from database
                let score = sqlx::query_scalar::<_, i32>(
                    "SELECT COALESCE(SUM(points_earned), 0)
                     FROM participant_answers
                     WHERE event_id = $1 AND device_id = $2"
                )
                .bind(&event_id)
                .bind(device_id)
                .fetch_one(&state.db)
                .await
                .unwrap_or(0);

                let response = ReconnectStateResponse {
                    reconnected: true,
                    current_segment_id: game_state.as_ref().map(|g| g.current_segment_id.clone()),
                    current_question_index: game_state.as_ref().map(|g| g.current_question_index),
                    score,
                    participant_state: format!("{:?}", participant.state),
                    event_phase: game_state
                        .as_ref()
                        .map(|g| format!("{:?}", g.phase))
                        .unwrap_or_else(|| "not_started".to_string()),
                };

                return Ok(Json(response));
            }
            ParticipantState::PermanentlyLeft => {
                return Ok(Json(ReconnectStateResponse {
                    reconnected: false,
                    current_segment_id: None,
                    current_question_index: None,
                    score: 0,
                    participant_state: "permanently_left".to_string(),
                    event_phase: "unknown".to_string(),
                }));
            }
        }
    }

    // No existing participant found
    Ok(Json(ReconnectStateResponse {
        reconnected: false,
        current_segment_id: None,
        current_question_index: None,
        score: 0,
        participant_state: "not_found".to_string(),
        event_phase: "unknown".to_string(),
    }))
}
```

Add to router in `backend/src/main.rs`:

```rust
.route(
    "/api/quiz/event/:event_id/reconnect",
    get(routes::quiz::check_reconnect_state),
)
```

### 2. `backend/src/ws/handler.rs`

Update WebSocket handler to detect reconnects and restore game state:

```rust
use crate::ws::messages::{ServerMessage, StateRestoration};

async fn handle_websocket_connection(
    mut socket: WebSocket,
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    Query(query): Query<HashMap<String, String>>,
) -> Result<(), AppError> {
    let device_id = query
        .get("device_id")
        .ok_or(AppError::BadRequest("Missing device_id"))?
        .clone();
    let session_token = query
        .get("session_token")
        .ok_or(AppError::BadRequest("Missing session_token"))?
        .clone();

    // Check if this is a reconnect
    let is_reconnect = state.hub.get_participant(&event_id, &device_id).is_some();

    if is_reconnect {
        // Reconnecting participant
        state.hub.update_heartbeat(&event_id, &device_id);

        // Get current game state
        let game_state = state.hub.get_game_state(&event_id);

        // Get participant's score
        let score = sqlx::query_scalar::<_, i32>(
            "SELECT COALESCE(SUM(points_earned), 0)
             FROM participant_answers
             WHERE event_id = $1 AND device_id = $2"
        )
        .bind(&event_id)
        .bind(&device_id)
        .fetch_one(&state.db)
        .await
        .unwrap_or(0);

        // Get current question if in progress
        let current_question = if let Some(ref gs) = game_state {
            if let Some(segment_id) = &gs.current_segment_id {
                sqlx::query_as::<_, Question>(
                    "SELECT * FROM questions WHERE segment_id = $1 ORDER BY order_index LIMIT 1 OFFSET $2"
                )
                .bind(segment_id)
                .bind(gs.current_question_index as i64)
                .fetch_optional(&state.db)
                .await
                .ok()
                .flatten()
            } else {
                None
            }
        } else {
            None
        };

        // Send state restoration message
        let restoration = StateRestoration {
            score,
            current_segment_id: game_state.as_ref().and_then(|g| g.current_segment_id.clone()),
            current_question_index: game_state.as_ref().map(|g| g.current_question_index),
            current_question,
            phase: game_state
                .as_ref()
                .map(|g| format!("{:?}", g.phase))
                .unwrap_or_else(|| "not_started".to_string()),
            time_remaining: game_state.as_ref().and_then(|g| g.time_remaining),
        };

        socket
            .send(
                serde_json::to_string(&ServerMessage::StateRestored { restoration })
                    .unwrap()
                    .into(),
            )
            .await?;

        // Broadcast reconnection to all participants
        state.hub.broadcast(
            &event_id,
            ServerMessage::ParticipantReconnected {
                device_id: device_id.clone(),
                user_id: state
                    .hub
                    .get_participant(&event_id, &device_id)
                    .map(|p| p.user_id)
                    .unwrap_or_default(),
            },
        );

        tracing::info!(
            "Participant {} reconnected to event {}",
            device_id,
            event_id
        );
    } else {
        // New participant - add to tracking
        let user_id = query.get("user_id").cloned().unwrap_or_default();
        state.hub.add_participant(&event_id, &device_id, session_token.clone(), user_id.clone());

        // Send initial connection message
        socket
            .send(
                serde_json::to_string(&ServerMessage::Connected {
                    device_id: device_id.clone(),
                })
                .unwrap()
                .into(),
            )
            .await?;

        // Broadcast new participant
        state.hub.broadcast(
            &event_id,
            ServerMessage::ParticipantJoined {
                device_id: device_id.clone(),
                user_id,
            },
        );
    }

    // Continue with normal WebSocket message handling
    handle_websocket_messages(socket, state, event_id, device_id).await
}
```

### 3. `backend/src/ws/messages.rs`

Add state restoration message types:

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StateRestoration {
    pub score: i32,
    pub current_segment_id: Option<String>,
    pub current_question_index: Option<usize>,
    pub current_question: Option<Question>,
    pub phase: String,
    pub time_remaining: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    // ... existing variants ...

    #[serde(rename = "state_restored")]
    StateRestored {
        restoration: StateRestoration,
    },

    #[serde(rename = "reconnect_failed")]
    ReconnectFailed {
        reason: String,
    },
}
```

### 4. `frontend/src/hooks/useEventWebSocket.ts`

Add auto-reconnect logic with exponential backoff:

```typescript
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../store/authStore';

interface ReconnectConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  initialDelay: 1000,      // 1 second
  maxDelay: 30000,         // 30 seconds
  backoffMultiplier: 1.5,
};

export function useEventWebSocket(eventId: string) {
  const [ws, setWs] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [restoredState, setRestoredState] = useState<any>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const wsRef = useRef<WebSocket | null>(null);
  const { user } = useAuthStore();

  const calculateReconnectDelay = useCallback((attempt: number): number => {
    const { initialDelay, maxDelay, backoffMultiplier } = DEFAULT_RECONNECT_CONFIG;
    const delay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, attempt),
      maxDelay
    );
    // Add jitter to prevent thundering herd
    return delay + Math.random() * 1000;
  }, []);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    const deviceId = localStorage.getItem('device_id');
    const sessionToken = localStorage.getItem('session_token');

    if (!deviceId || !sessionToken) {
      console.error('Missing device_id or session_token');
      return;
    }

    const wsUrl = `${import.meta.env.VITE_WS_URL}/api/ws/event/${eventId}?device_id=${deviceId}&session_token=${sessionToken}&user_id=${user?.id || ''}`;

    const socket = new WebSocket(wsUrl);
    wsRef.current = socket;

    socket.onopen = () => {
      console.log('WebSocket connected to event:', eventId);
      setIsConnected(true);
      setIsReconnecting(false);
      setReconnectAttempt(0);
      setWs(socket);
    };

    socket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);

        // Handle state restoration
        if (message.type === 'state_restored') {
          console.log('State restored:', message.restoration);
          setRestoredState(message.restoration);
        } else if (message.type === 'reconnect_failed') {
          console.error('Reconnect failed:', message.reason);
          setIsReconnecting(false);
        }

        // Propagate message to listeners
        messageListeners.current.forEach(listener => listener(message));
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    socket.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    socket.onclose = (event) => {
      console.log('WebSocket closed:', event.code, event.reason);
      setIsConnected(false);
      wsRef.current = null;
      setWs(null);

      // Attempt reconnect if not a clean close
      if (event.code !== 1000) {
        attemptReconnect();
      }
    };
  }, [eventId, user]);

  const attemptReconnect = useCallback(() => {
    if (reconnectAttempt >= DEFAULT_RECONNECT_CONFIG.maxAttempts) {
      console.error('Max reconnection attempts reached');
      setIsReconnecting(false);
      return;
    }

    setIsReconnecting(true);
    const delay = calculateReconnectDelay(reconnectAttempt);

    console.log(`Reconnecting in ${Math.round(delay / 1000)}s (attempt ${reconnectAttempt + 1}/${DEFAULT_RECONNECT_CONFIG.maxAttempts})`);

    reconnectTimeoutRef.current = setTimeout(() => {
      setReconnectAttempt(prev => prev + 1);
      connect();
    }, delay);
  }, [reconnectAttempt, calculateReconnectDelay, connect]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'Client disconnect');
      wsRef.current = null;
    }

    setWs(null);
    setIsConnected(false);
    setIsReconnecting(false);
    setReconnectAttempt(0);
  }, []);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    } else {
      console.warn('WebSocket not connected, cannot send message');
    }
  }, []);

  // Message listeners
  const messageListeners = useRef<Array<(message: any) => void>>([]);

  const onMessage = useCallback((listener: (message: any) => void) => {
    messageListeners.current.push(listener);
    return () => {
      messageListeners.current = messageListeners.current.filter(l => l !== listener);
    };
  }, []);

  // Initial connection
  useEffect(() => {
    connect();
    return () => disconnect();
  }, []);

  // Heartbeat
  useEffect(() => {
    if (!isConnected) return;

    const heartbeatInterval = setInterval(() => {
      sendMessage({ type: 'heartbeat' });
    }, 10000);

    return () => clearInterval(heartbeatInterval);
  }, [isConnected, sendMessage]);

  return {
    isConnected,
    isReconnecting,
    reconnectAttempt,
    restoredState,
    sendMessage,
    onMessage,
    disconnect,
  };
}
```

### 5. `frontend/src/pages/EventParticipant.tsx`

Handle state restoration and display reconnect status:

```typescript
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useEventWebSocket } from '../hooks/useEventWebSocket';

export default function EventParticipant() {
  const { eventId } = useParams<{ eventId: string }>();
  const {
    isConnected,
    isReconnecting,
    reconnectAttempt,
    restoredState,
    sendMessage,
    onMessage
  } = useEventWebSocket(eventId!);

  const [score, setScore] = useState(0);
  const [currentQuestion, setCurrentQuestion] = useState<any>(null);
  const [phase, setPhase] = useState('not_started');

  // Handle state restoration
  useEffect(() => {
    if (restoredState) {
      setScore(restoredState.score);
      setCurrentQuestion(restoredState.current_question);
      setPhase(restoredState.phase);

      console.log('Game state restored:', {
        score: restoredState.score,
        segment: restoredState.current_segment_id,
        question: restoredState.current_question_index,
        phase: restoredState.phase,
      });
    }
  }, [restoredState]);

  // Handle incoming messages
  useEffect(() => {
    return onMessage((message: any) => {
      switch (message.type) {
        case 'question':
          setCurrentQuestion(message.question);
          setPhase('showing_question');
          break;
        case 'scores_update':
          const myScore = message.scores.find(
            (s: any) => s.device_id === localStorage.getItem('device_id')
          );
          if (myScore) {
            setScore(myScore.score);
          }
          break;
        case 'phase_changed':
          setPhase(message.phase);
          break;
        // ... other message handlers
      }
    });
  }, [onMessage]);

  return (
    <div className="min-h-screen bg-gray-900 text-white p-6">
      {/* Reconnection status banner */}
      {isReconnecting && (
        <div className="bg-yellow-500/20 border border-yellow-500/50 p-4 rounded-lg mb-4">
          <p className="text-yellow-300 text-sm">
            ⚠️ Connection lost. Reconnecting... (Attempt {reconnectAttempt}/10)
          </p>
        </div>
      )}

      {/* State restored notification */}
      {restoredState && (
        <div className="bg-green-500/20 border border-green-500/50 p-4 rounded-lg mb-4">
          <p className="text-green-300 text-sm">
            ✅ Connection restored! Your score: {restoredState.score} points
          </p>
        </div>
      )}

      {/* Connection status indicator */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Quiz Participant</h1>
        <div className="flex items-center gap-2">
          <div
            className={`w-3 h-3 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-400">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Score display */}
      <div className="bg-gray-800 p-6 rounded-lg mb-6">
        <p className="text-4xl font-bold text-center">{score} points</p>
      </div>

      {/* Question display */}
      {currentQuestion && phase === 'showing_question' && (
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">{currentQuestion.text}</h2>
          <div className="space-y-2">
            {currentQuestion.answers.map((answer: any, index: number) => (
              <button
                key={index}
                onClick={() => sendMessage({ type: 'answer', answer_index: index })}
                className="w-full p-4 bg-gray-700 hover:bg-gray-600 rounded-lg text-left transition-colors"
              >
                {answer.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Waiting for next question */}
      {phase === 'between_questions' && (
        <div className="bg-gray-800 p-6 rounded-lg text-center">
          <p className="text-gray-400">Waiting for next question...</p>
        </div>
      )}
    </div>
  );
}
```

### 6. `frontend/src/api/endpoints.ts`

Add reconnect state check endpoint:

```typescript
export const quizApi = {
  // ... existing endpoints ...

  checkReconnectState: async (
    eventId: string,
    deviceId: string,
    sessionToken: string
  ): Promise<{
    reconnected: boolean;
    current_segment_id: string | null;
    current_question_index: number | null;
    score: number;
    participant_state: string;
    event_phase: string;
  }> => {
    const response = await client.get(
      `/quiz/event/${eventId}/reconnect?device_id=${deviceId}&session_token=${sessionToken}`
    );
    return response.data;
  },
};
```

## Acceptance Criteria

- [ ] `check_reconnect_state` endpoint returns participant state and score
- [ ] Session token validation prevents unauthorized reconnects
- [ ] State restoration includes current segment, question index, and score
- [ ] WebSocket handler detects reconnects and sends `state_restored` message
- [ ] Frontend implements exponential backoff for reconnection attempts
- [ ] Reconnection attempts limited to 10 with increasing delays
- [ ] Restored state includes current question if quiz is in progress
- [ ] UI displays reconnection status and progress
- [ ] UI shows "State restored" notification with score
- [ ] Score persists across reconnection
- [ ] Current question restored if still active
- [ ] Heartbeat updates `last_heartbeat` timestamp on reconnect
- [ ] Broadcast notifies all participants of reconnection
- [ ] No compiler errors or warnings
- [ ] Unit tests for state restoration logic

## Testing

```bash
# Backend tests
cd backend
cargo test reconnect_state_restoration
cargo test reconnect_validation

# Frontend tests
cd frontend
npm test -- useEventWebSocket
npm test -- EventParticipant
```

**Manual Testing:**
1. Join event as participant
2. Disconnect network (airplane mode or disable WiFi)
3. Wait 5-10 seconds
4. Reconnect network
5. Verify auto-reconnect with exponential backoff
6. Verify score and question state restored
7. Verify "State restored" notification displayed
8. Answer question to verify full functionality

**Edge Cases:**
- Reconnect after grace period expires (should fail)
- Reconnect with invalid session token (should reject)
- Reconnect during question transition
- Multiple rapid reconnects

## Dependencies

- TICKET-013: Disconnect tracking infrastructure (provides `ParticipantState` tracking)
- TICKET-014: Grace period logic (provides background cleanup and heartbeat)

## Related Tickets

- TICKET-013: Network loss disconnect tracking
- TICKET-014: Network loss grace period
- TICKET-001: Device session identity (provides device_id/session_token)

## Notes

- Exponential backoff prevents overwhelming server during network issues
- State restoration happens on WebSocket connect, not as separate HTTP call
- Session token validation ensures security (prevent device_id hijacking)
- Jitter added to reconnect delay prevents thundering herd problem
- Grace period (30s) provides reasonable window for network recovery
- Frontend stores device_id and session_token in localStorage for persistence
- Reconnect preserves all participant state: score, answers, progress
- UI feedback critical for user experience during network issues
- Consider adding metric tracking for reconnection success rate
- Future enhancement: Persist unanswered questions for offline resilience
