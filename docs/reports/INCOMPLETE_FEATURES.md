# Incomplete Features & Known Limitations

**Last Updated:** 2024-12-17

This document tracks remaining incomplete features and known limitations.

---

## Known Limitations

### 1. Pseudo-Streaming Transcription
**Location:** `backend/src/services/transcription.rs`

OpenAI Whisper API doesn't support true WebSocket streaming. Transcription is done in chunks (pseudo-streaming) rather than real-time word-by-word.

**Impact:** Users won't get instantaneous transcription updates.

**Workaround:** The pseudo-streaming approach with 1-second chunks provides acceptable UX. True streaming would require Deepgram or AssemblyAI WebSocket APIs.

### 2. Test AI Connection Uses Minimal Audio
**Location:** `backend/src/routes/settings.rs`

The "Test Connection" feature for transcription providers is a connectivity test only. It verifies API reachability and authentication but does not test transcription quality.

---

## Open Issues

### 1. Audio Format User Notification
**Location:** `frontend/src/hooks/useAudioWebSocket.ts`
**Priority:** Low

Browser audio format detection exists (`getSupportedAudioMimeType()`) but there's no UI notification when falling back to a non-optimal format.

**Enhancement Needed:** Show warning when browser uses fallback format (e.g., WAV instead of WebM/Opus).

---

## Summary

| Type | Count |
|------|-------|
| Known Limitations | 2 |
| Open Issues | 1 |

For remaining feature work, see `REMAINING_WORK.md`.
