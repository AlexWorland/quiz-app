# Backend Unit Test Coverage Analysis

## Executive Summary

This document analyzes the backend Rust codebase to identify test coverage gaps and provides specific recommendations for tests that should be added.

## Current Test Coverage Status

### Well-Tested Areas ✅
- **Models**: User, Event, Session, Question models have basic tests
- **JWT**: Token generation and validation
- **Crypto**: Encryption/decryption functions
- **Scoring**: Speed-based score calculation
- **Config**: Configuration loading and validation
- **Error handling**: AppError types and conversions
- **Basic API**: Health check, register, login endpoints

### Coverage Gaps Identified ⚠️

## Detailed Coverage Gap Analysis

### 1. Route Handlers - Quiz Routes (`routes/quiz.rs`)

**Current Coverage**: Minimal - only basic API integration tests exist

**Missing Tests**:

#### 1.1 Event Management
- [ ] `list_quizzes` - Test filtering by host, empty results, multiple events
- [ ] `create_quiz` - Test all default values, validation of question_gen_interval clamping (10-300), mode defaults
- [ ] `get_quiz` - Test not found case, unauthorized access
- [ ] `update_quiz` - Test partial updates, ownership verification, invalid fields
- [ ] `delete_quiz` - Test cascade deletion, ownership verification, not found

#### 1.2 Segment Management
- [ ] `add_question` (add_segment) - Test order_index calculation, presenter assignment, ownership
- [ ] `update_question` (update_segment) - Test partial updates, status transitions
- [ ] `delete_question` (delete_segment) - Test cascade effects, ownership

#### 1.3 Event Access
- [ ] `get_event_by_code` - Test case-insensitive code matching, not found
- [ ] `get_event_with_segments` - Test segment ordering, empty segments
- [ ] `get_segment` - Test not found, unauthorized access

#### 1.4 Recording Control
- [ ] `start_recording` - Test authorization (host/presenter), state transitions, concurrent starts
- [ ] `pause_recording` - Test state validation, authorization
- [ ] `resume_recording` - Test state validation, authorization, resume state tracking
- [ ] `stop_recording` - Test finalization, state transitions
- [ ] `restart_recording` - Test reset logic, state cleanup

#### 1.5 Question Management
- [ ] `get_segment_questions` - Test ordering, empty results, filtering
- [ ] `create_question_for_segment` - Test validation, fake answer generation, authorization
- [ ] `update_question_by_id` - Test partial updates, answer validation
- [ ] `delete_question_by_id` - Test cascade effects, authorization
- [ ] `bulk_import_questions` - Test validation, error handling, partial failures

#### 1.6 Leaderboards
- [ ] `get_master_leaderboard` - Test aggregation across segments, tie-breaking, empty results
- [ ] `get_segment_leaderboard` - Test per-segment scores, ordering, empty segments

#### 1.7 Canvas Operations
- [ ] `get_canvas_strokes` - Test pagination, empty canvas, ordering
- [ ] `clear_canvas` - Test authorization, state cleanup

### 2. Route Handlers - Auth Routes (`routes/auth.rs`)

**Current Coverage**: Partial - basic register/login tested

**Missing Tests**:

- [ ] `register` - Test username validation (min 3 chars), password validation, duplicate username, email generation, avatar handling
- [ ] `login` - Test invalid password, non-existent user, password hash verification edge cases
- [ ] `me` - Test authenticated access, user not found after deletion
- [ ] `update_profile` - Test username uniqueness check, validation (3-50 chars), avatar URL length (500 char limit), avatar_type validation (emoji/preset/custom), partial updates

### 3. Route Handlers - Settings Routes (`routes/settings.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `get_ai_settings` - Test user-specific settings, config fallback, key masking
- [ ] `update_ai_settings` - Test encryption of API keys, upsert logic, provider validation
- [ ] `test_ai_connection` - Test all providers (Claude, OpenAI, Ollama), STT providers (Deepgram, Whisper, AssemblyAI), error handling, key decryption, fallback to config keys

### 4. Route Handlers - Upload Routes (`routes/upload.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `upload_avatar` - Test file validation, unique filename generation, S3 upload success/failure, multipart parsing, missing file error, file extension handling

### 5. Route Handlers - Session Routes (`routes/session.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `create_session` - Test presenter role requirement, quiz ownership verification, join code uniqueness (10 attempts), code generation
- [ ] `get_session` - Test case-insensitive code, not found, participant list ordering
- [ ] `join_session` - Test duplicate join prevention, finished session rejection, participant addition

### 6. Route Handlers - WebSocket Routes (`routes/ws.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `ws_handler` - Test WebSocket upgrade, event_id extraction, connection info logging
- [ ] `audio_ws_handler` - Test WebSocket upgrade, segment_id extraction, connection info logging

### 7. WebSocket Handler (`ws/handler.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `handle_ws_connection` - Test connection lifecycle, message parsing, error handling, disconnection cleanup
- [ ] `handle_audio_connection` - Test audio chunk handling, transcription flow, error recovery
- [ ] Message handlers:
  - [ ] `join` - Test participant addition, duplicate joins, authorization
  - [ ] `answer` - Test answer recording, validation, timing, scoring
  - [ ] `start_game` - Test authorization, state transitions, question loading
  - [ ] `next_question` - Test question progression, phase transitions
  - [ ] `reveal_answer` - Test authorization, answer distribution
  - [ ] `show_leaderboard` - Test score calculation, ordering
  - [ ] `end_game` - Test finalization, cleanup
  - [ ] `pass_presenter` - Test presenter transfer, authorization

### 8. WebSocket Hub (`ws/hub.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `get_or_create_event_session` - Test session creation, existing session retrieval
- [ ] `add_participant` - Test participant tracking, duplicate handling
- [ ] `remove_participant` - Test cleanup, answer removal
- [ ] `get_game_state` - Test state retrieval, cloning
- [ ] `update_game_state` - Test state mutations, concurrency
- [ ] `record_answer` - Test answer storage, overwrites
- [ ] `clear_answers` - Test cleanup between questions
- [ ] `set_quiz_phase` - Test phase transitions
- [ ] `increment_participant_count` / `decrement_participant_count` - Test counting logic
- [ ] `broadcast_to_event` - Test message delivery, error handling
- [ ] Legacy session methods (backward compatibility)

### 9. Services - AI Service (`services/ai.rs`)

**Current Coverage**: Partial - question generation has some tests

**Missing Tests**:

- [ ] `ClaudeProvider`:
  - [ ] `generate_question` - Test prompt construction, response parsing, error handling
  - [ ] `generate_fake_answers` - Test answer generation, count validation
  - [ ] API error handling (rate limits, invalid keys, network errors)
  
- [ ] `OpenAIProvider`:
  - [ ] `generate_question` - Test prompt construction, response parsing
  - [ ] `generate_fake_answers` - Test answer generation
  - [ ] API error handling
  
- [ ] `OllamaProvider`:
  - [ ] `generate_question` - Test local LLM integration, model selection
  - [ ] `generate_fake_answers` - Test answer generation
  - [ ] Connection error handling

### 10. Services - Transcription Service (`services/transcription.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `DeepgramProvider`:
  - [ ] `transcribe` - Test audio format handling, response parsing
  - [ ] Streaming client - Test WebSocket connection, chunk handling, reconnection
  - [ ] Error handling (invalid audio, API errors)
  
- [ ] `WhisperProvider`:
  - [ ] `transcribe` - Test OpenAI Whisper API integration
  - [ ] Error handling
  
- [ ] `AssemblyAIProvider`:
  - [ ] `transcribe` - Test polling mechanism, status checking
  - [ ] Streaming client - Test WebSocket connection
  - [ ] Error handling

### 11. Services - Question Generation (`services/question_gen.rs`)

**Current Coverage**: Partial

**Missing Tests**:

- [ ] Quality assessment logic
- [ ] Question generation interval handling
- [ ] Transcript processing
- [ ] Error recovery

### 12. Library Functions (`lib.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `build_cors_layer`:
  - [ ] Production mode with configured origins
  - [ ] Production mode without origins (fallback to Any)
  - [ ] Development mode (Any origin)
  - [ ] Origin parsing failures
  - [ ] Method and header configuration

### 13. Database Utilities (`db.rs`)

**Current Coverage**: None

**Missing Tests**:

- [ ] `health_check` - Test successful check, connection failure, timeout

### 14. Auth Middleware (`auth/middleware.rs`)

**Current Coverage**: Partial - unit tests for AuthUser conversion exist

**Missing Tests**:

- [ ] `auth_middleware`:
  - [ ] Missing Authorization header
  - [ ] Invalid Bearer token format
  - [ ] Invalid/expired JWT token
  - [ ] Successful authentication
  - [ ] Request extension population
  
- [ ] `presenter_only`:
  - [ ] Missing AuthUser extension
  - [ ] Non-presenter role rejection
  - [ ] Presenter role acceptance

## Priority Recommendations

### High Priority (Critical Business Logic)
1. **Quiz Route Handlers** - Core functionality for event/segment/question management
2. **WebSocket Handler** - Real-time game logic, participant management
3. **Auth Middleware** - Security-critical authentication flow
4. **Settings Routes** - API key encryption/decryption, provider testing

### Medium Priority (Important Features)
5. **Recording Control Routes** - State management, authorization
6. **AI Service** - Error handling, provider-specific logic
7. **Transcription Service** - Audio processing, streaming
8. **Upload Routes** - File handling, S3 integration

### Low Priority (Edge Cases & Utilities)
9. **CORS Configuration** - Edge cases in origin parsing
10. **Database Health Check** - Simple utility function
11. **Legacy Session Routes** - Backward compatibility

## Test Implementation Strategy

### 1. Integration Tests (API Routes)
- Use `axum-test` for HTTP endpoint testing
- Test with real database (test_utils::setup_test_db)
- Mock external services (S3, AI providers) where possible
- Test authentication flows with real JWT tokens

### 2. Unit Tests (Services & Utilities)
- Mock external API calls using `mockito` or similar
- Test error handling paths
- Test edge cases and boundary conditions

### 3. WebSocket Tests
- Use `tokio-tungstenite` test utilities
- Test message serialization/deserialization
- Test connection lifecycle
- Test concurrent connections

### 4. Test Organization
- Group related tests in the same file
- Use helper functions for common setup (test users, events, etc.)
- Create test fixtures for complex scenarios

## Example Test Structure

```rust
// tests/quiz_routes_test.rs
#[tokio::test]
async fn test_create_quiz_with_defaults() {
    // Setup
    let pool = test_utils::setup_test_db().await;
    let (user, token) = test_utils::create_test_user(&pool).await;
    
    // Test
    let response = server
        .post("/api/quizzes")
        .add_header("Authorization", format!("Bearer {}", token))
        .json(&json!({"title": "Test Event"}))
        .await;
    
    // Assertions
    assert_eq!(response.status_code(), 200);
    let event: EventResponse = response.json();
    assert_eq!(event.mode, "listen_only");
    assert_eq!(event.num_fake_answers, 3);
    assert_eq!(event.question_gen_interval_seconds, 30);
}

#[tokio::test]
async fn test_create_quiz_with_custom_interval_clamped() {
    // Test that question_gen_interval is clamped to 10-300
    // ...
}
```

## Metrics to Track

- **Line Coverage**: Target 80%+ for critical paths
- **Branch Coverage**: Target 70%+ for decision points
- **Function Coverage**: Target 90%+ for public APIs
- **Error Path Coverage**: All error handling paths should be tested

## Next Steps

1. Start with High Priority items
2. Add tests incrementally with each feature change
3. Run coverage reports regularly to track progress
4. Focus on error paths and edge cases
5. Ensure all authentication/authorization paths are tested
