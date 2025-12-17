---
allowed-tools: Bash(websocat:*), Bash(curl:*), Bash(wscat:*)
argument-hint: [session-code]
description: Debug WebSocket connections and game state
---

# WebSocket Debug

Debug WebSocket connections for the quiz game.

## Test WebSocket Connection
If websocat is installed:
```bash
websocat ws://localhost:8080/api/ws/$ARGUMENTS
```

## Check Backend WebSocket Status
!`curl -s http://localhost:8080/api/health 2>&1`

## WebSocket Message Types

### Client to Server
```json
{"type": "join", "userId": "uuid", "sessionCode": "ABC123"}
{"type": "answer", "questionId": "uuid", "selectedAnswer": "text", "responseTimeMs": 1500}
{"type": "start_game"}
{"type": "next_question"}
{"type": "reveal_answer"}
{"type": "show_leaderboard"}
{"type": "end_game"}
```

### Server to Client
```json
{"type": "connected", "participants": [...]}
{"type": "participant_joined", "user": {...}}
{"type": "question", "questionId": "uuid", "text": "...", "answers": [...], "timeLimit": 30}
{"type": "reveal", "correctAnswer": "...", "distribution": [...]}
{"type": "leaderboard", "rankings": [...]}
```

## Common Issues

1. **Connection refused**: Backend not running or wrong port
2. **401 Unauthorized**: JWT token missing or invalid
3. **Session not found**: Invalid session code
4. **Message not received**: Check message format matches expected schema
5. **Connection drops**: Check for idle timeout settings

## Debug Steps
1. Verify backend is running: `docker compose ps`
2. Check backend logs: `docker compose logs backend`
3. Test HTTP endpoints first before WebSocket
4. Use browser DevTools Network tab to inspect WS frames
