# Remaining Work - Quiz App

**Last Updated:** 2024-12-17

This document consolidates all genuinely incomplete features and enhancements. Items previously tracked in `IMPLEMENTATION_GUIDE.md` that were already implemented have been removed.

---

## Quick Wins (< 2 hours each)

### 1. Add LICENSE File
**Effort:** 15 minutes
**Priority:** Low

Create `LICENSE` file with MIT license (or preferred license).

### 2. Audio Format User Notification
**Location:** `frontend/src/hooks/useAudioWebSocket.ts`
**Effort:** 1-2 hours
**Priority:** Low

Add UI feedback when browser falls back to non-optimal audio format. Detection already exists in `getSupportedAudioMimeType()`.

---

## Medium Priority Features

### 3. Results Export Feature
**Effort:** 5-7 hours
**Priority:** Medium

**What's Missing:**
- Backend endpoint for exporting quiz results
- CSV/JSON generation
- Frontend download button

**Implementation:**
- Add `GET /events/:id/export?format=csv|json` endpoint
- Create `ExportButton` component in frontend

### 4. AI-Based Quality Scoring
**Effort:** 4-6 hours
**Priority:** Medium

**What's Missing:**
- Wire up existing `evaluate_question_quality()` trait method in AI providers
- Add `ENABLE_AI_QUALITY_SCORING` config option

**Infrastructure Exists:**
- `QualityAssessment` struct in `question_gen.rs`
- `evaluate_question_quality()` method signature in `AIProvider` trait
- Blending logic for heuristic + AI scores

---

## Low Priority Features

### 5. AssemblyAI WebSocket Streaming
**Effort:** 7-9 hours
**Priority:** Low

**What's Missing:**
- Integration of existing `AssemblyAIStreamingClient` into audio WebSocket handler
- Audio format conversion (browser WebM -> PCM 16kHz)

**Infrastructure Exists:**
- `AssemblyAIStreamingClient` fully implemented (lines 759-1011 in transcription.rs)
- WebSocket connection handling
- Transcript message parsing

### 6. Presenter Handoff Between Segments
**Effort:** 10-13 hours (revised down - more is implemented than previously thought)
**Priority:** Medium (elevated - key feature for multi-presenter events)

**See:** `MULTI_PRESENTER_IMPLEMENTATION.md` for detailed implementation guide.

**Already Implemented:**
- `presenter_user_id` column on segments table
- `PassPresenter` WebSocket message handler
- `PassPresenterButton` UI component
- `PresenterChanged` broadcast message
- Authorization check (`is_segment_controller()`)

**What's Missing:**
- UI integration of PassPresenterButton into EventHost
- Presenter indicators in UI
- Role switching navigation
- Event completion trigger logic

### 7. Event Templates and Question Banks
**Effort:** 14-17 hours
**Priority:** Low

**What's Missing:**
- Database tables: `event_templates`, `question_banks`, `bank_questions`
- CRUD API endpoints
- Frontend management UI
- Import/export functionality

### 8. Canvas Performance Optimization
**Effort:** 9-12 hours
**Priority:** Low

**What's Missing:**
- Stroke compression (Douglas-Peucker algorithm)
- Canvas snapshot feature (flatten strokes to image)
- OffscreenCanvas for background rendering
- Pagination for stroke history

**Basic Solution Exists:**
- `CANVAS_SYNC_LIMIT` config (default: 100 strokes)

---

## Production Hardening (Before Release)

| Task | Status |
|------|--------|
| Configure API keys | Required - no defaults |
| Change JWT_SECRET | Required for production |
| Change ENCRYPTION_KEY | Required for production |
| Set CORS_ALLOWED_ORIGINS | Required for production |
| Add rate limiting | Recommended |
| Add OpenTelemetry monitoring | Recommended |

---

## Summary

| Priority | Feature | Effort |
|----------|---------|--------|
| Low | License file | 15 min |
| Low | Audio format notification | 1-2h |
| Medium | Results export | 5-7h |
| Medium | AI quality scoring | 4-6h |
| Low | AssemblyAI streaming | 7-9h |
| Low | Presenter handoff | 12-14h |
| Low | Templates/question banks | 14-17h |
| Low | Canvas optimization | 9-12h |

**Total Remaining Effort:** ~55-70 hours

---

## Completed Features (Removed from Tracking)

The following were previously listed as incomplete but are now fully implemented:

- Frontend Testing (Vitest) - 22 test files
- Display Mode Components - All 5 components exist
- Backend Tests - Integration and unit tests exist
- Error Recovery/Retry Logic - `utils/retry.ts`, axios interceptors
- Online Status Hook - `useOnlineStatus.ts`
- WebSocket Hook Tests - Tests exist for both hooks
- Page Component Tests - EventHost and EventParticipant tests exist
