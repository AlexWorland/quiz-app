# Traditional Mode Testing Guide

## Overview
This guide provides step-by-step instructions for testing the newly implemented Traditional Mode feature.

## Prerequisites

### 1. Start Services

**Backend:**
```bash
cd backend
cargo run
```

**Frontend:**
```bash
cd frontend
npm run dev
```

**Database & Dependencies:**
```bash
docker-compose up -d postgres minio minio-init
```

### 2. Verify Environment Variables
Ensure `.env` has:
- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` - JWT signing key
- `ENCRYPTION_KEY` - API key encryption
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` - For fake answer generation

---

## Test Scenarios

### Scenario 1: Create Traditional Mode Event

**Steps:**
1. Navigate to http://localhost:5173
2. Login or register a new account
3. Click "New Event" button
4. Fill in event details:
   - Title: "Traditional Mode Test"
   - Description: "Testing pre-written questions"
5. Select **"Traditional"** mode (not "Listen Only")
6. Click "Create Event"

**Expected Results:**
- ✓ Event created successfully
- ✓ Redirected to event management page
- ✓ Event card shows "Traditional Mode Test" title
- ✓ No recording controls visible (Traditional Mode doesn't need recording)

---

### Scenario 2: Add Questions Manually

**Steps:**
1. Click "Manage" on the Traditional Mode event
2. Go to the event host page
3. Click "Add Questions" tab
4. Fill in the form:
   - Question: "What is the capital of France?"
   - Correct Answer: "Paris"
5. Click "Add Question"

**Expected Results:**
- ✓ Form submits successfully
- ✓ Form clears after submission
- ✓ Switch to "Question List" tab to see the added question
- ✓ Question appears with text and correct answer

**Repeat for More Questions:**
- Question: "What is 2 + 2?"
  - Answer: "4"
- Question: "What color is the sky?"
  - Answer: "Blue"

---

### Scenario 3: Bulk Import Questions (CSV)

**Steps:**
1. Create a CSV file `questions.csv`:
```csv
question_text,correct_answer
What is the largest planet?,Jupiter
What is H2O?,Water
Who wrote Romeo and Juliet?,Shakespeare
```

2. In EventHost page, click "Bulk Import" tab
3. Click "CSV Upload" sub-tab
4. Click file input and select `questions.csv`
5. Preview table should appear showing 3 questions
6. Click "Import Questions" button

**Expected Results:**
- ✓ CSV parses correctly
- ✓ Preview table shows all 3 questions with correct data
- ✓ Import progress: "3 of 3 imported, 0 failed"
- ✓ Success message appears
- ✓ Switch to "Question List" tab to see all 6 questions total (3 manual + 3 CSV)

---

### Scenario 4: Bulk Import Questions (JSON)

**Steps:**
1. Click "JSON Paste" sub-tab
2. Paste the following JSON:
```json
{
  "questions": [
    {
      "question_text": "What is the speed of light?",
      "correct_answer": "299,792,458 m/s"
    },
    {
      "question_text": "What is the smallest prime number?",
      "correct_answer": "2"
    }
  ]
}
```
3. Click "Validate JSON" button
4. Preview table appears
5. Click "Import Questions" button

**Expected Results:**
- ✓ JSON validates successfully
- ✓ Preview shows 2 questions
- ✓ Import progress: "2 of 2 imported, 0 failed"
- ✓ Question list now shows 8 total questions

---

### Scenario 5: Edit and Delete Questions

**Steps:**
1. Go to "Question List" tab
2. Click "Edit" on any question
3. Modify the question text
4. Save changes
5. Click "Delete" on another question
6. Confirm deletion

**Expected Results:**
- ✓ Edit dialog opens with current question data
- ✓ Changes save successfully
- ✓ Edited question updates in the list
- ✓ Delete confirmation prompt appears
- ✓ Question removed from list after confirmation

---

### Scenario 6: Start Quiz and Generate Fake Answers

**Steps:**
1. Open the event as a participant:
   - Copy the join code from the event card
   - Open new browser tab/window
   - Navigate to join page and enter the code
2. As host, click "Start Quiz" button
3. First question appears with multiple choice answers

**Expected Results:**
- ✓ Quiz starts successfully
- ✓ First question displays correct question text
- ✓ 4 answer options appear (1 correct + 3 AI-generated fake answers)
- ✓ Answers are shuffled (correct answer not always in same position)
- ✓ Fake answers are plausible and related to the question
- ✓ Timer starts counting down

**Validation:**
- Check browser DevTools Network tab for:
  - WebSocket connection to `/api/ws/event/:event_id`
  - `GameStarted` message
  - `Question` message with shuffled answers

**Backend Logs Should Show:**
```
Generating fake answers for question: "What is the capital of France?"
AI provider: Claude/OpenAI/Ollama
Generated 3 fake answers
Stored answers in session_answers table
Broadcasting question to participants
```

---

### Scenario 7: Participant Answers Questions

**Steps:**
1. As participant, click an answer
2. Answer is submitted
3. Host advances to next question
4. Participant sees next question
5. Repeat until all questions answered

**Expected Results:**
- ✓ Answer selection highlights
- ✓ "Correct!" or "Incorrect" feedback shows
- ✓ Score updates on leaderboard
- ✓ Next question loads with new fake answers
- ✓ Leaderboard shows participant ranking

---

### Scenario 8: Compare with Listen-Only Mode

**Steps:**
1. Create a new event with "Listen Only" mode
2. Notice the different UI:
   - Recording controls present
   - No "Add Questions" tab
   - Transcription display
   - Questions generated from audio

**Expected Results:**
- ✓ Listen-Only mode still works as before
- ✓ Recording controls are visible
- ✓ No manual question creation UI
- ✓ Traditional Mode and Listen-Only Mode are independent

---

## Error Scenarios to Test

### Invalid CSV Format
1. Upload CSV with wrong headers
2. Upload CSV with missing columns
3. Upload empty CSV

**Expected:** Error messages with clear explanations

### Invalid JSON Format
1. Paste malformed JSON
2. Paste JSON with missing required fields
3. Paste empty JSON

**Expected:** Validation errors with line numbers

### Network Failures
1. Disconnect network during question import
2. Stop backend server during quiz

**Expected:** User-friendly error messages, no crashes

### Authorization
1. Try to add questions to another user's event
2. Try to start quiz on event you don't own

**Expected:** 403 Forbidden errors

---

## Database Verification

### Check Questions Table
```sql
SELECT id, question_text, correct_answer, is_ai_generated
FROM questions
WHERE segment_id = '<segment-id>'
ORDER BY order_index;
```

**Expected:**
- All manually added questions have `is_ai_generated = false`
- Questions have sequential `order_index` values

### Check Session Answers Table
```sql
SELECT question_id, answers
FROM session_answers
WHERE question_id IN (
  SELECT id FROM questions WHERE segment_id = '<segment-id>'
);
```

**Expected:**
- One row per question after quiz starts
- `answers` JSONB contains 4 items (1 correct + 3 fake)
- Each answer has `text`, `is_correct`, `display_order` fields

---

## Performance Checks

### Fake Answer Generation
- Time from "Start Quiz" to first question should be < 3 seconds
- AI API call should complete within timeout
- If AI fails, quiz should still work with only correct answer

### Bulk Import
- 100 questions via CSV should import in < 10 seconds
- UI should remain responsive during import
- Progress indicator should update smoothly

---

## Cleanup After Testing

```bash
# Reset database
docker-compose down -v
docker-compose up -d postgres minio minio-init

# Clear browser local storage
# Open DevTools > Application > Local Storage > Clear
```

---

## Known Limitations

1. **No Streaming Transcription** - Phase 2 enhancement
2. **Heuristic Quality Scoring** - AI-based scoring in Phase 3
3. **No Question Templates** - Phase 4 enhancement
4. **CSV Parser** - Uses papaparse library (client-side only)

---

## Success Criteria

Traditional Mode is working correctly if:
- ✓ Can create Traditional Mode events
- ✓ Can add questions manually (one at a time)
- ✓ Can bulk import questions (CSV and JSON)
- ✓ Can edit and delete questions
- ✓ Quiz starts and displays questions correctly
- ✓ AI generates 3 plausible fake answers per question
- ✓ Answers are shuffled each time
- ✓ Participants can answer and see scores
- ✓ Leaderboards update correctly
- ✓ Listen-Only mode still works independently

---

## Troubleshooting

### "Failed to generate fake answers"
- Check AI provider API key is set in `.env`
- Check backend logs for AI API errors
- Verify network connectivity to AI provider
- Fallback: Quiz will show only correct answer

### Questions don't appear in list
- Check browser DevTools Console for errors
- Verify API endpoint returns 200 status
- Check segment ID matches current segment
- Refresh the page

### CSV import fails
- Ensure CSV has headers: `question_text`, `correct_answer`
- Check for special characters or encoding issues
- Verify file is valid UTF-8
- Try JSON import instead

### Type errors in frontend
- Run `npm run type-check` to see all errors
- Pre-existing errors in tests/hooks are unrelated
- New component errors should be reported

---

## Reporting Issues

If you find bugs during testing:
1. Note the exact steps to reproduce
2. Capture browser DevTools Console output
3. Check backend logs for errors
4. Note which scenario from this guide failed
5. Document expected vs actual behavior
