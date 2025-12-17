# Traditional Mode - Quick Testing Checklist

Use this checklist while testing. See `TESTING_TRADITIONAL_MODE.md` for detailed instructions.

## Pre-Flight
- [ ] Backend running (`cargo run` in backend/)
- [ ] Frontend running (`npm run dev` in frontend/)
- [ ] Database/MinIO running (`docker-compose up -d`)
- [ ] AI API key configured in `.env` (ANTHROPIC_API_KEY or OPENAI_API_KEY)

## Event Creation
- [ ] Can create event with "Traditional" mode selected
- [ ] Event appears in events list
- [ ] No recording UI visible (Traditional Mode doesn't record)

## Manual Question Entry
- [ ] "Add Questions" tab visible in EventHost
- [ ] Can enter question text and correct answer
- [ ] Form validates (both fields required)
- [ ] Form clears after successful submission
- [ ] Question appears in "Question List" tab

## CSV Bulk Import
- [ ] Can upload CSV file with headers: `question_text`, `correct_answer`
- [ ] Preview table displays parsed questions correctly
- [ ] Import progress shows: "X of Y imported, Z failed"
- [ ] Questions appear in question list after import
- [ ] Error handling for invalid CSV format

## JSON Bulk Import
- [ ] Can paste JSON in correct format
- [ ] "Validate JSON" button parses successfully
- [ ] Preview table shows questions
- [ ] Import works and questions added
- [ ] Error messages for malformed JSON

## Question Management
- [ ] Can edit existing questions
- [ ] Changes save successfully
- [ ] Can delete questions
- [ ] Confirmation dialog appears before delete

## Quiz Flow
- [ ] Can start quiz with pre-written questions
- [ ] First question displays immediately
- [ ] 4 answer options appear (1 correct + 3 fake)
- [ ] Fake answers are plausible and related
- [ ] Answers are shuffled (not always same order)
- [ ] Timer starts and counts down

## Participant Experience
- [ ] Can join quiz via join code
- [ ] Questions display correctly
- [ ] Can select and submit answers
- [ ] Feedback shows (Correct/Incorrect)
- [ ] Score updates on leaderboard
- [ ] Next question loads properly

## Backend Verification
- [ ] Backend logs show fake answer generation
- [ ] Check database: `questions` table has `is_ai_generated = false`
- [ ] Check database: `session_answers` table populated after quiz starts
- [ ] WebSocket messages visible in browser DevTools

## Edge Cases
- [ ] Empty CSV/JSON handled gracefully
- [ ] Malformed data shows clear error messages
- [ ] Network failures don't crash the app
- [ ] Can't add questions to other users' events (403 error)

## Compatibility
- [ ] Listen-Only mode still works independently
- [ ] Recording controls only show in Listen-Only mode
- [ ] Can switch between different event modes

## Success Criteria
All checkboxes above should be ✓ for Traditional Mode to be considered fully functional.

---

## Quick Test Data

### Sample CSV Content:
```csv
question_text,correct_answer
What is the capital of France?,Paris
What is 2 + 2?,4
What color is the sky?,Blue
```

### Sample JSON Content:
```json
{
  "questions": [
    {"question_text": "What is H2O?", "correct_answer": "Water"},
    {"question_text": "What is the largest planet?", "correct_answer": "Jupiter"}
  ]
}
```

---

## Report Issues
If any checkbox fails, refer to `TESTING_TRADITIONAL_MODE.md` for detailed troubleshooting steps.
