# Backend Test Coverage Implementation Plan

## Overview

Add comprehensive test coverage to 2000+ LOC of untested Rust backend code across critical components. Phased approach prioritizes high-risk areas (WebSocket, question generation, AI services) following existing test patterns.

**Current Coverage:** ~20% (85 tests, mainly models/config)
**Target Coverage:** 70%+ (165+ tests total)
**Timeline:** 4 phases over 5-6 weeks

---

## Phase 1: Foundation - WebSocket Hub & Question Generation (CRITICAL)

**Priority:** Highest - Core real-time game logic
**Effort:** 25 tests, 1.5 weeks

### 1.1 WebSocket Hub Tests

**File:** `backend/src/ws/hub.rs` (inline `#[cfg(test)]` module)

**Test Categories (23 tests):**

1. **Session Management** (5 tests)
   - Create new event session with broadcast channel
   - Reuse existing session (multiple subscribers)
   - Multiple concurrent subscribers receive messages
   - Legacy session_code compatibility
   - Session cleanup

2. **Participant Management** (6 tests)
   - Add participant updates GameState
   - Remove participant clears answers
   - Increment/decrement participant count
   - Participant count never negative
   - Concurrent participant operations
   - Remove non-existent participant (no panic)

3. **Answer Recording** (4 tests)
   - Record answer stores correctly
   - Overwrite previous answer
   - Clear all answers
   - Concurrent answer recording (10 users)

4. **Game State Updates** (5 tests)
   - Update state via closure
   - Get state returns clone
   - Quiz phase transitions
   - Concurrent state updates (Arc/RwLock safety)
   - Get state for non-existent event returns None

5. **Broadcasting** (3 tests)
   - All subscribers receive broadcast
   - Broadcast to non-existent event (no panic)
   - Broadcast survives dropped receivers

**Key Pattern - Concurrent Test:**
```rust
#[tokio::test]
async fn test_concurrent_answer_recording() {
    let hub = Arc::new(Hub::new());
    let event_id = Uuid::new_v4();
    let _rx = hub.get_or_create_event_session(event_id).await;

    let mut handles = vec![];
    for i in 0..10 {
        let hub_clone = Arc::clone(&hub);
        let user_id = Uuid::new_v4();
        handles.push(tokio::spawn(async move {
            hub_clone.record_answer(event_id, user_id, format!("answer_{}", i)).await;
        }));
    }

    for handle in handles {
        handle.await.unwrap();
    }

    let state = hub.get_game_state(event_id).await.unwrap();
    assert_eq!(state.answers_received.len(), 10);
}
```

### 1.2 Question Generation Service Tests

**File:** `backend/src/services/question_gen.rs` (inline `#[cfg(test)]` module)

**Dependencies:** Mock AI provider implementation

**Mock AI Provider:**
```rust
#[cfg(test)]
struct MockAIProvider {
    should_generate: bool,
    quality_score: Option<QualityAssessment>,
}

#[async_trait::async_trait]
impl AIProvider for MockAIProvider {
    async fn generate_fake_answers(...) -> Result<Vec<String>> {
        Ok(vec!["fake1".to_string(), "fake2".to_string()])
    }

    async fn analyze_and_generate_question(...) -> Result<Option<GeneratedQuestion>> {
        if self.should_generate {
            Ok(Some(GeneratedQuestion { /* mock data */ }))
        } else {
            Ok(None)
        }
    }

    async fn evaluate_question_quality(...) -> Result<Option<QualityAssessment>> {
        Ok(self.quality_score.clone())
    }
}
```

**Test Categories (12 tests):**

1. **Quality Scoring Heuristics** (12 tests)
   - Good question length (10-100 chars) → +0.1 bonus
   - Too short (<10 chars) → -0.1 penalty
   - Too long (>150 chars) → -0.05 penalty
   - Empty answer → -0.1 penalty
   - Contains question word (what/who/when/where/why/how) → bonus
   - Ends with question mark → bonus
   - Answer similar to question text → -0.1 penalty
   - Answer found in transcript → bonus
   - Lowercase start → penalty
   - Score clamped to 0.0-1.0 range
   - Score blending: 30% heuristic + 70% AI
   - Fallback when AI unavailable → use heuristic only

**Critical Test Example:**
```rust
#[tokio::test]
async fn test_quality_score_blending_30_70_heuristic_ai() {
    let pool = test_utils::setup_test_db().await;
    let mock_ai = Box::new(MockAIProvider {
        should_generate: true,
        quality_score: Some(QualityAssessment {
            overall_score: 0.85,
            /* other fields */
        }),
    });

    let service = QuestionGenerationService::new(pool, mock_ai, true, 3);

    // Heuristic: 0.5, AI: 0.85
    // Expected: 0.3 * 0.5 + 0.7 * 0.85 = 0.745
}
```

**Deliverables:**
- ✅ 23 Hub unit tests passing
- ✅ 12 Question generation tests passing
- ✅ MockAIProvider implementation
- ✅ Zero race conditions in concurrent tests

---

## Phase 2: HTTP Routes - Quiz CRUD & Recording Lifecycle (HIGH)

**Priority:** High - Most frequently used endpoints
**Effort:** 20 tests, 1 week

### 2.1 Advanced Quiz Routes Tests

**File:** `backend/tests/quiz_routes_advanced_test.rs` (NEW FILE)
**Pattern:** Integration tests with `axum-test::TestServer`

**Test Categories (20 tests):**

1. **Canvas Operations** (4 tests)
   - Get canvas strokes (empty canvas)
   - Get canvas strokes ordered by created_at
   - Clear canvas ownership verification
   - Clear canvas successful deletion

2. **Leaderboard Operations** (5 tests)
   - Get master leaderboard (empty event)
   - Get master leaderboard ranking order
   - Get segment leaderboard (isolated scoring)
   - Leaderboard tie handling
   - Leaderboard for non-existent segment

3. **Recording Lifecycle** (6 tests)
   - Start recording (updates status + timestamp)
   - Pause/resume transitions
   - Stop recording sets quiz_ready
   - Restart recording clears data
   - Recording operations ownership verification
   - **Complete lifecycle flow (start → pause → resume → stop)**

4. **Question CRUD for Segments** (5 tests)
   - Create question sets order_index
   - Bulk import sequential indexing
   - Bulk import partial failure handling
   - Update question ownership check
   - Delete question cascade answers

**Complex Test Example:**
```rust
#[tokio::test]
async fn test_recording_lifecycle_complete_flow() {
    let state = create_test_app_state().await;
    let (user, token) = create_test_user_with_token(&state.db, &state.config, None).await;
    let event = create_test_event(&state.db, user.id, Some("Recording Test")).await;
    let segment = create_test_segment(&state.db, event.id, Some("Presenter"), None).await;

    let app = create_app(state.clone());
    let server = TestServer::new(app).unwrap();
    let auth = format!("Bearer {}", token);

    // 1. Start recording
    let resp = server.post(&format!("/api/segments/{}/recording/start", segment.id))
        .add_header("authorization", auth.clone())
        .await;
    assert_eq!(resp.status_code(), 200);
    assert_eq!(resp.json::<Value>()["status"], "recording");

    // 2. Pause → 3. Resume → 4. Stop (similar pattern)
}
```

### 2.2 Test Helpers Update

**File:** `backend/tests/test_helpers.rs` (UPDATE)

**New Helpers:**
```rust
pub async fn create_test_canvas_stroke_db(
    pool: &PgPool,
    event_id: Uuid,
    user_id: Uuid,
) -> Value;

pub async fn create_test_scores(
    pool: &PgPool,
    segment_id: Uuid,
    event_id: Uuid,
    user_scores: Vec<(Uuid, i32)>,
);

pub async fn wait_for_broadcast(
    rx: broadcast::Receiver<Value>,
    timeout_ms: u64,
) -> Option<Value>;
```

**Deliverables:**
- ✅ 20 route integration tests passing
- ✅ All CRUD operations tested
- ✅ Authorization checks verified
- ✅ Recording lifecycle fully tested

---

## Phase 3: AI Provider Implementations (MEDIUM)

**Priority:** Medium - External API dependencies
**Effort:** 15 tests, 1 week

### 3.1 Mock Strategy

**Add to Cargo.toml:**
```toml
[dev-dependencies]
wiremock = "0.5"
```

**File:** `backend/src/services/ai.rs` (inline `#[cfg(test)]` module)

**Mock HTTP Server Pattern:**
```rust
#[cfg(test)]
mod tests {
    use wiremock::{MockServer, Mock, ResponseTemplate};
    use wiremock::matchers::{method, path, header};

    async fn setup_mock_claude_server() -> MockServer {
        let mock_server = MockServer::start().await;

        Mock::given(method("POST"))
            .and(path("/v1/messages"))
            .and(header("x-api-key", "test-key"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "content": [{
                    "text": "Wrong answer 1\nWrong answer 2\nWrong answer 3"
                }]
            })))
            .mount(&mock_server)
            .await;

        mock_server
    }
}
```

**Test Categories (15 tests):**

1. **ClaudeProvider** (5 tests)
   - Generate fake answers success
   - Generate fake answers API error (non-200 status)
   - Analyze and generate question success
   - Analyze and generate question returns null
   - Evaluate question quality (optional)

2. **OpenAIProvider** (5 tests)
   - Generate fake answers success
   - Generate fake answers API error
   - Analyze with JSON mode
   - Short transcript (<50 chars) returns None
   - Evaluate quality with gpt-4o-mini

3. **OllamaProvider** (5 tests)
   - Generate fake answers success
   - Connection error handling (Ollama not running)
   - Custom model configuration
   - Response field parsing
   - Evaluate quality fallback

**Alternative (if wiremock too complex):**
- Use simple struct mocks without external HTTP
- Refactor AIProvider to accept HttpClient trait

**Deliverables:**
- ✅ 15 AI provider tests passing
- ✅ All 3 providers tested (Claude, OpenAI, Ollama)
- ✅ Mock HTTP server approach validated
- ✅ API error handling verified

---

## Phase 4: WebSocket Handler & Transcription (MEDIUM-LOW)

**Priority:** Medium-Low - Complex but stable
**Effort:** 20 tests, 1.5 weeks
**⚠️ Requires Refactoring**

### 4.1 WebSocket Handler Tests

**Challenge:** `handler.rs` is 1500 LOC monolithic function
**Solution:** Refactor to extract testable functions

**Refactoring Required:**
```rust
// Before: Monolithic handle_websocket function
async fn handle_websocket(/* args */) {
    match parsed_message {
        GameMessage::Join { ... } => { /* 50 lines */ }
        GameMessage::Answer { ... } => { /* 40 lines */ }
        // ... more cases
    }
}

// After: Extract message handlers
async fn handle_join_message(
    state: &AppState,
    event_id: Uuid,
    user_id: Uuid,
    username: String,
) -> Result<()> {
    // Extracted join logic (testable!)
}

async fn handle_answer_message(/* args */) -> Result<()> { }
async fn handle_start_game_message(/* args */) -> Result<()> { }
// ... etc
```

**File:** `backend/tests/ws_handler_test.rs` (NEW FILE)

**Test Categories (20 tests):**

1. **Message Routing** (8 tests)
   - Handle join adds participant
   - Handle answer records answer
   - Handle start game authorization
   - Handle next question phase transition
   - Handle reveal answer broadcasts scores
   - Handle show leaderboard calculates rankings
   - Handle pass presenter updates segment
   - Handle end game triggers completion

2. **Authorization** (4 tests)
   - is_segment_controller: event host can control
   - is_segment_controller: segment presenter can control
   - is_segment_controller: unauthorized user denied
   - Segment control messages reject non-controllers

3. **Score Calculation** (4 tests)
   - Calculate scores speed-based formula
   - Calculate scores correct vs incorrect
   - Calculate scores persist to database
   - Calculate scores aggregate to event total

4. **Answer Generation** (4 tests)
   - Get or generate answers uses cached
   - Get or generate answers calls AI provider
   - Get or generate answers shuffles answers
   - Get or generate answers uses user AI settings

### 4.2 Transcription Service Tests

**File:** `backend/src/services/transcription.rs` (inline `#[cfg(test)]` module)

**Mock Transcription Provider:**
```rust
#[cfg(test)]
struct MockTranscriptionProvider {
    transcript: String,
    should_fail: bool,
}

#[async_trait::async_trait]
impl TranscriptionProvider for MockTranscriptionProvider {
    async fn transcribe(&self, _audio: Vec<u8>) -> Result<String> {
        if self.should_fail {
            Err(AppError::Internal("Transcription failed".into()))
        } else {
            Ok(self.transcript.clone())
        }
    }
}
```

**Test Categories (10 tests):**

1. **WhisperProvider** (3 tests)
   - Multipart form encoding
   - Pseudo-streaming (falls back to transcribe)
   - API error handling

2. **DeepgramProvider** (4 tests)
   - REST API transcribe
   - Streaming with interim results
   - WebSocket client lifecycle
   - Message parsing

3. **AssemblyAIProvider** (3 tests)
   - Upload and transcribe
   - Streaming base64 encoding
   - Final vs partial message types

**Note:** WebSocket streaming tests may skip if API keys unavailable:
```rust
#[tokio::test]
async fn test_deepgram_streaming_real_connection() {
    if std::env::var("DEEPGRAM_API_KEY").is_err() {
        eprintln!("Skipping: DEEPGRAM_API_KEY not set");
        return;
    }
    // Test implementation
}
```

**Deliverables:**
- ✅ handler.rs refactored into testable functions
- ✅ 20 WebSocket handler tests passing
- ✅ 10 transcription tests passing
- ✅ Message routing verified

---

## Test Execution

### Run All Tests
```bash
cd /Users/alexworland/presentation
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test
```

### Run Specific Suites
```bash
# WebSocket hub tests
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test hub::tests

# Question generation tests
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test question_gen::tests

# Integration tests only
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test --test '*'

# With debug output
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test test_name -- --nocapture
```

---

## Success Criteria

### Phase 1 ✓
- 23 Hub tests passing
- 12 Question generation tests passing
- Zero race conditions
- Mock AI provider working

### Phase 2 ✓
- 20 route tests passing
- All CRUD operations covered
- Authorization verified
- Recording lifecycle tested

### Phase 3 ✓
- 15 AI provider tests passing
- All providers tested
- Mock HTTP validated
- Error handling verified

### Phase 4 ✓
- 20 handler tests passing (post-refactor)
- 10 transcription tests passing
- Message routing verified
- Score calculation tested

### Overall ✓
- Coverage: 20% → 70%+
- CI/CD pipeline passing
- No flaky tests (10 consecutive runs)
- Documentation updated

---

## Critical Files

### Phase 1 (Start Here)
- `backend/src/ws/hub.rs` - Add inline tests (23)
- `backend/src/services/question_gen.rs` - Add inline tests (12) + MockAIProvider
- `backend/tests/test_helpers.rs` - Add helper functions

### Phase 2
- `backend/tests/quiz_routes_advanced_test.rs` - NEW FILE (20 tests)
- `backend/tests/test_helpers.rs` - Update with canvas/score helpers

### Phase 3
- `backend/src/services/ai.rs` - Add inline tests (15)
- `backend/Cargo.toml` - Add `wiremock = "0.5"` to dev-dependencies

### Phase 4
- `backend/src/ws/handler.rs` - REFACTOR then test
- `backend/tests/ws_handler_test.rs` - NEW FILE (20 tests)
- `backend/src/services/transcription.rs` - Add inline tests (10)

---

## Timeline & Effort

| Phase | Tests | Duration | Risk |
|-------|-------|----------|------|
| Phase 1 | 35 tests | 1.5 weeks | Medium (concurrency) |
| Phase 2 | 20 tests | 1 week | Low (patterns exist) |
| Phase 3 | 15 tests | 1 week | Medium (HTTP mocking) |
| Phase 4 | 30 tests | 1.5 weeks | High (refactoring) |
| Buffer | - | 0.5 weeks | - |
| **Total** | **100 tests** | **5.5 weeks** | - |

---

## Risk Mitigation

1. **WebSocket Refactoring Risk**
   - Mitigation: Refactor incrementally, run existing tests after each change
   - Fallback: Defer Phase 4 if too risky

2. **Concurrent Test Flakiness**
   - Mitigation: Use deterministic UUIDs, tokio::test runtime, explicit barriers
   - Fallback: Reduce parallelism if needed

3. **Mock Complexity (wiremock)**
   - Mitigation: Start with simple mocks, upgrade only if needed
   - Fallback: Use struct mocks instead

4. **Database State Leakage**
   - Mitigation: Unique UUIDs per test, transaction rollback pattern
   - Fallback: Test database reset between runs
