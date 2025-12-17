# Phase 2: Streaming Transcription Testing Guide

## Overview

Phase 2 implements **WebSocket-based Deepgram streaming transcription** for real-time audio processing. Instead of buffering audio chunks and sending HTTP requests, transcription now streams continuously with sub-second latency. This guide validates that streaming mode works correctly and outperforms the REST fallback.

---

## Prerequisites

### 1. Environment Variables
Ensure `.env` contains:
```
ENABLE_STREAMING_TRANSCRIPTION=true
DEEPGRAM_API_KEY=<your-deepgram-key>
DATABASE_URL=<postgres-connection>
JWT_SECRET=<signing-key>
```

### 2. Start Services
```bash
# Database
docker-compose up -d postgres

# Backend
cd backend && cargo run

# Frontend
cd frontend && npm run dev
```

### 3. Verify Setup
- Navigate to http://localhost:5173
- Backend logs should show: `Streaming transcription: ENABLED`

---

## Test Scenarios

### Scenario 1: Enable/Disable Streaming Mode

**Steps:**
1. Start backend with `ENABLE_STREAMING_TRANSCRIPTION=true`
2. Check backend logs during startup
3. Restart backend with `ENABLE_STREAMING_TRANSCRIPTION=false`
4. Check backend logs

**Expected Results:**
- ✓ With `true`: Logs show "Streaming transcription: ENABLED" and "WebSocket connection to Deepgram established"
- ✓ With `false`: Logs show "Using REST transcription" (fallback mode)

---

### Scenario 2: Create Listen-Only Event & Start Recording

**Steps:**
1. Login to http://localhost:5173
2. Create new event with "Listen Only" mode
3. Click "Start Recording"
4. Speak into microphone (10-15 seconds of audio)
5. Watch transcription appear in real-time
6. Stop recording after 15 seconds

**Expected Results:**
- ✓ Recording button changes to "Stop Recording"
- ✓ Transcription appears **within 200-500ms** of speaking (streaming mode)
- ✓ Interim results update continuously
- ✓ Final transcription finalizes after speaking stops
- ✓ No visible lag between audio and text

**Backend Logs Should Show:**
```
Streaming transcription handler connected
Processing audio chunk: 4096 bytes
Interim transcript: "hello world"
Final transcript: "hello world testing"
Disconnected from Deepgram
```

---

### Scenario 3: Compare Streaming vs REST Latency

**Steps:**
1. Test with streaming enabled:
   - Speak: "What is the capital of France?"
   - Record time from completion to text appearance
   - Note: Should be ~100-300ms

2. Stop backend, disable streaming in `.env`:
   ```
   ENABLE_STREAMING_TRANSCRIPTION=false
   ```

3. Restart backend and repeat test:
   - Speak same phrase
   - Record time to text appearance
   - Note: Should be ~1-2 seconds

**Expected Results:**
- ✓ Streaming mode: Transcription appears within 300ms
- ✓ REST mode: Transcription appears after 1-2 seconds
- ✓ Streaming is **5-10x faster** than REST

---

### Scenario 4: Interim vs Final Results

**Steps:**
1. Enable streaming transcription
2. Start recording
3. Slowly speak: "The quick brown fox jumps over the lazy dog"
4. Observe transcription updates in real-time
5. Stop speaking
6. Note final transcription

**Expected Results:**
- ✓ Interim results appear before speaking stops (partial text)
- ✓ Interim results update continuously as you speak
- ✓ Final result appears after short silence (confidence increases)
- ✓ Final result is more accurate than interim
- ✓ UI shows distinction between interim (lighter) and final (bold)

**Example:**
```
Interim: "the quick"
Interim: "the quick brown"
Interim: "the quick brown fox"
Final: "The quick brown fox jumps over the lazy dog"
```

---

### Scenario 5: Connection Persistence

**Steps:**
1. Enable streaming transcription
2. Start recording
3. Speak short phrase: "Hello"
4. Continue recording silently for 10 seconds
5. Speak again: "World"
6. Stop recording

**Expected Results:**
- ✓ Single WebSocket connection to Deepgram remains open
- ✓ Both phrases transcribed on same connection
- ✓ No reconnection attempts in logs
- ✓ Total time: ~12 seconds with single connection overhead

**Backend Logs:**
```
Streaming transcription handler connected
Processing audio chunk: 4096 bytes
...
Processing audio chunk: 4096 bytes
Disconnected from Deepgram (connection closed gracefully)
```

---

### Scenario 6: Connection Failure & Fallback

**Steps:**
1. Start backend with invalid `DEEPGRAM_API_KEY`
2. Create event and start recording
3. Speak: "Test phrase"
4. Check logs and transcription behavior

**Expected Results:**
- ✓ Connection fails immediately
- ✓ Backend logs show error: "Failed to connect to Deepgram: ..."
- ✓ System automatically falls back to REST mode
- ✓ Transcription still appears (slower) after 1-2 seconds
- ✓ No crash or silent failure
- ✓ User sees transcription (no error visible)

**Backend Logs:**
```
Failed to connect to Deepgram: Authentication failed
Falling back to REST transcription mode
```

---

## Verification Steps

### Check DevTools Network Tab

1. Open Browser DevTools (F12)
2. Go to **Network** tab
3. Filter by "WS" (WebSocket)
4. Start recording in app
5. Observe:
   - ✓ WebSocket connection to `deepgram` or similar endpoint
   - ✓ Binary frames being sent (audio data)
   - ✓ Multiple frames per second (real-time streaming)

### Check Backend Logs

```bash
# Filter for streaming transcription logs
docker-compose logs backend | grep -i "streaming\|deepgram\|transcript"
```

Expected patterns:
- `Streaming transcription: ENABLED`
- `WebSocket connection established`
- `Processing audio chunk:`
- `Interim transcript:` (multiple)
- `Final transcript:`

### Database Verification

```sql
-- Check transcriptions are stored
SELECT id, event_id, interim_text, final_text, created_at
FROM transcriptions
ORDER BY created_at DESC
LIMIT 5;
```

Expected: New rows with both interim and final transcripts.

---

## Expected Behavior Differences

| Aspect | Streaming Mode | REST Mode |
|--------|---|---|
| Connection Type | WebSocket (persistent) | HTTP (request-per-chunk) |
| Latency | 100-300ms | 1-2 seconds |
| Interim Results | Yes (real-time) | No (final only) |
| Connection Count | 1 per recording | ~10-20 per recording |
| Bandwidth | Efficient (continuous) | Less efficient (repeated headers) |
| Failure Mode | Automatic fallback to REST | N/A |

---

## Success Criteria

Streaming transcription is working correctly if:
- ✓ Logs show "Streaming transcription: ENABLED"
- ✓ DevTools shows WebSocket connection to Deepgram
- ✓ Transcription appears within 300ms (vs 1-2s for REST)
- ✓ Interim results update in real-time as user speaks
- ✓ Final result is accurate after silence
- ✓ Single connection persists for entire recording
- ✓ Invalid API key triggers fallback to REST (no crash)
- ✓ Questions still generate correctly from streaming transcripts

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Streaming transcription: DISABLED" | Check `ENABLE_STREAMING_TRANSCRIPTION=true` in `.env` |
| No WebSocket in DevTools | Verify Deepgram API key is valid |
| Slow transcription (~1-2s) | Streaming may have failed; check logs for fallback to REST |
| "Failed to connect to Deepgram" | Invalid API key or network issue; REST fallback active |
| No transcription at all | Check backend logs for errors; verify microphone permissions |

---

## Cleanup After Testing

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres

# Clear browser storage
# DevTools > Application > Local Storage > Clear
```
