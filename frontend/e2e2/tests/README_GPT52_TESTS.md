# GPT-5.2 Batch Question Generation E2E2 Tests

## Overview

Comprehensive end-to-end tests for the GPT-5.2 batch question generation feature implemented in the quiz application.

## Test File

`gpt52-batch-generation.e2e2.spec.ts`

## Test Coverage

### 1. Event Creation with Custom Question Count
**Test**: `should create event with custom questions_to_generate setting`

**What it tests:**
- Creating a new event through the UI
- Setting custom `questions_to_generate` value (10) in the creation form
- Verifying the input accepts and displays the value correctly
- Confirming the event is created successfully

**User Flow:**
1. Navigate to events page
2. Click "New Event" or "Create Event" button
3. Fill in event details
4. Select "Listen Only" mode
5. Set questions_to_generate to 10
6. Submit form
7. Verify event appears in list

---

### 2. EventSettings Modal Functionality
**Test**: `should open EventSettings modal and update questions_to_generate`

**What it tests:**
- EventSettings component renders correctly
- Modal opens when button is clicked
- Current settings are displayed accurately
- Settings can be updated (changed to 12)
- Changes are persisted to the backend
- Modal closes after save

**User Flow:**
1. Navigate to host view for an event
2. Click "Event Settings" button
3. Verify modal shows current value (5)
4. Change to 12 questions
5. Click "Save Settings"
6. Verify via API that setting was updated

---

### 3. Input Validation
**Test**: `should validate questions_to_generate range (1-20)`

**What it tests:**
- Input field has proper min/max attributes
- Values below 1 are handled
- Values above 20 are handled
- Form validation prevents invalid values

**User Flow:**
1. Open event creation modal
2. Try to set value to 0 (should clamp to 1)
3. Try to set value to 25 (should clamp to 20)
4. Verify min="1" and max="20" attributes exist

---

### 4. Batch Question Generation via API
**Test**: `should generate correct number of questions via batch mode`

**What it tests:**
- Single-file transcription endpoint (`/transcribe`)
- Batch mode generates requested number of questions
- Questions have required fields (text, answer, fake_answers)
- Questions are marked as AI-generated

**User Flow:**
1. Create event with questions_to_generate=3
2. Upload audio file via API
3. Verify 3 questions are generated
4. Check all questions have proper structure

**Note:** This test requires real backend with OpenAI API key. It will gracefully skip if backend is not configured.

---

### 5. Chunked Upload with Batch Generation
**Test**: `should support chunked upload with batch generation`

**What it tests:**
- Chunked audio upload endpoint (`/audio-chunk`)
- Finalize endpoint (`/finalize-and-transcribe`)
- AudioCombiner integration
- Batch generation after combining chunks
- Correct number of questions based on event setting

**User Flow:**
1. Create event with questions_to_generate=7
2. Upload multiple audio chunks
3. Call finalize endpoint
4. Verify questions are generated
5. Check question count matches setting

**Note:** Requires backend with real audio processing.

---

### 6. Full Settings Display
**Test**: `should display EventSettings with all configuration options`

**What it tests:**
- All three settings are visible in modal:
  - Time Per Question
  - Questions to Generate
  - Number of Fake Answers
- All settings show correct current values
- All settings can be updated simultaneously
- Batch update persists correctly

**User Flow:**
1. Navigate to host view
2. Open EventSettings modal
3. Verify all 3 inputs show correct values
4. Update all 3 settings
5. Save and verify all changes persisted

---

### 7. Settings Persistence
**Test**: `should persist questions_to_generate across page reloads`

**What it tests:**
- Settings are stored in database, not just state
- Page reload fetches correct values
- Settings survive navigation
- EventSettings modal always shows latest values

**User Flow:**
1. Create event with questions_to_generate=15
2. Navigate to host view
3. Open settings modal, verify value=15
4. Close modal
5. Reload page
6. Reopen settings modal
7. Verify value is still 15

---

## Running the Tests

### Local Development (with backend running)
```bash
cd frontend
npm run test:e2e2:local:serve
```

### Run specific test
```bash
npm run test:e2e2:local:serve -- --grep "should create event with custom"
```

### Docker Mode
```bash
docker compose -f docker-compose.test.yml run --rm --build frontend-test npm run test:e2e2
```

## Test Dependencies

### Required Backend Endpoints
- `POST /api/quizzes` - Create event
- `POST /api/quizzes/{id}/questions` - Create segment
- `GET /api/quizzes/{id}` - Get event details
- `PUT /api/quizzes/{id}` - Update event settings
- `POST /api/segments/{id}/transcribe` - Single-file transcription
- `POST /api/segments/{id}/audio-chunk` - Upload audio chunk
- `POST /api/segments/{id}/finalize-and-transcribe` - Finalize chunked upload
- `GET /api/segments/{id}/questions` - Get generated questions

### Required Environment
- Backend server running on `http://localhost:8080`
- Frontend dev server on `http://localhost:4174` (or configured port)
- PostgreSQL database
- MinIO for file storage
- OpenAI API key (for real generation tests)

## Test Limitations

### What is NOT tested (requires real API keys):
- Actual GPT-5.2-thinking model invocation
- Real audio transcription via Whisper
- Question quality assessment
- Actual text content of generated questions

### What IS tested:
- UI components render correctly
- Form validation works
- API requests are made with correct data
- Database persistence
- Settings modal functionality
- Event creation flow
- Navigation and state management

## Known Issues

Some tests may fail gracefully if:
- Backend is not running
- OpenAI API key is not configured
- Audio transcription service is unavailable

These failures are expected and handled with try/catch blocks that log informative messages.

## Future Improvements

1. **Mock API Responses**: Add fixtures for successful transcription responses
2. **WebSocket Testing**: Test real-time updates during generation
3. **Flappy Bird Display**: Verify mini-game appears during generation
4. **Error Handling**: Test failure scenarios (bad audio, API errors)
5. **Performance**: Test with various transcript lengths
6. **Multi-segment**: Test settings apply across all segments

