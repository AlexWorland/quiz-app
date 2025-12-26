# User Stories - Live Audio Mode

This document contains user stories specifically for the live audio recording and AI question generation features that were not covered in the original USER_STORIES.md.

---

## Audio Recording & Permissions

### User Story: Microphone Permission Request
**As a** presenter  
**I want** clear instructions when the browser requests microphone permission  
**So that** I understand why I need to grant access and can proceed with recording.

### User Story: Microphone Permission Denied
**As a** presenter  
**I want** helpful error messages when microphone access is denied  
**So that** I know how to fix the issue in browser settings.

### User Story: Start Recording
**As a** presenter  
**I want to** click "Start Recording" to begin capturing my presentation  
**So that** the AI can generate questions from my content.

### User Story: Visual Recording Indicator
**As a** presenter  
**I want** a clear visual indicator (red dot, "LIVE" badge, timer) while recording  
**So that** I know the system is actively capturing my presentation.

### User Story: Recording Duration Display
**As a** presenter  
**I want to** see elapsed recording time  
**So that** I can gauge how long I've been presenting.

### User Story: Pause Recording
**As a** presenter  
**I want to** pause recording during breaks or interruptions  
**So that** irrelevant content isn't included in the transcript.

### User Story: Resume Recording
**As a** presenter  
**I want to** resume recording after a pause  
**So that** I can continue where I left off without starting over.

### User Story: Restart Recording
**As a** presenter  
**I want to** restart recording if I make mistakes early on  
**So that** I can get a clean take without bad content in the transcript.

### Edge Case: Recording Without Speech
**As** the system  
**I want to** detect when a recording contains no speech or very little audio  
**So that** I can warn the presenter before attempting transcription.

### Edge Case: Very Long Recording
**As a** presenter  
**I want** feedback if my recording exceeds recommended length (e.g., 10 minutes)  
**So that** I know to wrap up or split into multiple segments.

### Edge Case: Microphone Disconnected Mid-Recording
**As** the system  
**I want to** detect when the microphone disconnects during recording  
**So that** the presenter can be notified and can reconnect without losing their recording.

### Edge Case: Background Noise
**As a** presenter  
**I want** the system to handle background noise gracefully during transcription  
**So that** occasional interruptions don't ruin question generation.

---

## Quiz Generation Flow

### User Story: Generate Quiz Button
**As a** presenter  
**I want** a clear "Generate Quiz" button when I finish presenting  
**So that** I can trigger AI question generation from my recording.

### User Story: Helper Text for Generation
**As a** presenter  
**I want** clear instructions like "When finished presenting, press Generate Quiz"  
**So that** I know what to do next.

### User Story: Flappy Bird During Generation
**As a** participant  
**I want** to play Flappy Bird while the quiz is being generated  
**So that** the wait time is fun instead of boring.

### User Story: Presenter Plays Flappy Bird Too
**As a** presenter  
**I want** to play Flappy Bird along with participants during generation  
**So that** I'm engaged during the wait and can participate in the fun.

### User Story: Generation Progress Indication
**As a** presenter  
**I want** to see that quiz generation is in progress (not stuck)  
**So that** I know the system is working and how long to expect.

### User Story: Auto-Navigate When Ready
**As a** presenter  
**I want** the app to automatically navigate to the quiz when generation completes  
**So that** I don't have to manually click to start.

### User Story: Participant Auto-Navigate
**As a** participant  
**I want** my view to automatically switch to the quiz when it's ready  
**So that** I don't miss the start.

### Edge Case: Generation Takes Very Long
**As a** presenter  
**I want** feedback if generation is taking longer than expected (>60 seconds)  
**So that** I know whether to wait or report an issue.

### Edge Case: Generation Fails
**As a** presenter  
**I want** clear error messages when quiz generation fails  
**So that** I understand what went wrong and know my options.

### Edge Case: No Questions Generated
**As a** presenter  
**I want** options to retry, add questions manually, or skip to next presenter when no questions are generated  
**So that** the event can continue despite the failure.

### Edge Case: Very Few Questions Generated
**As a** presenter  
**I want** to know if only 1-2 questions were generated from my recording  
**So that** I can decide whether to retry with better content or proceed anyway.

---

## Transcription Quality

### User Story: Transcript Preview
**As a** presenter  
**I want to** see what was transcribed from my audio  
**So that** I can verify the system understood my presentation correctly.

### User Story: Short Recording Rejection
**As a** presenter  
**I want** clear feedback if my recording is too short (<50 words) to generate questions  
**So that** I know to record more content.

### User Story: Unclear Audio Warning
**As a** presenter  
**I want** warnings if the transcription confidence is low due to unclear audio  
**So that** I can re-record with better audio quality.

### Edge Case: Non-English Presentation
**As a** presenter  
**I want** the system to handle or gracefully reject non-English presentations  
**So that** I get clear feedback rather than poor transcription.

### Edge Case: Heavy Accent or Dialect
**As a** presenter  
**I want** the transcription to handle various accents reasonably well  
**So that** my content is understood regardless of my speech patterns.

### Edge Case: Technical Jargon
**As a** presenter  
**I want** the system to transcribe technical terms and acronyms accurately  
**So that** generated questions use correct terminology.

---

## Question Quality & Review

### User Story: Review Generated Questions
**As a** presenter  
**I want to** review AI-generated questions before starting the quiz  
**So that** I can verify they're accurate and relevant.

### User Story: Edit Generated Questions
**As a** presenter  
**I want to** edit question text or answers before the quiz  
**So that** I can fix inaccuracies or improve clarity.

### User Story: Delete Bad Questions
**As a** presenter  
**I want to** delete questions that are off-topic or incorrect  
**So that** only good questions are included in the quiz.

### User Story: Add Questions to Generated Set
**As a** presenter  
**I want to** manually add questions to supplement AI-generated ones  
**So that** I can ensure important topics are covered.

### User Story: Question Source Transparency
**As a** presenter  
**I want to** see which part of my transcript each question came from  
**So that** I can verify the question is based on something I actually said.

### User Story: Presenter Sees Correct Answer
**As a** presenter  
**I want** the correct answer highlighted during the quiz  
**So that** I know what participants should be answering and can explain if needed.

### Edge Case: Question References Content Not Presented
**As** the system  
**I want to** minimize hallucinated questions that reference content not in the transcript  
**So that** participants aren't confused by questions about things that weren't mentioned.

### Edge Case: Ambiguous Questions
**As a** presenter  
**I want** the system to avoid generating questions with ambiguous wording  
**So that** participants understand what's being asked.

### Edge Case: Too-Easy Questions
**As a** presenter  
**I want** to regenerate questions if they're all too obvious  
**So that** the quiz is engaging and challenging.

### Edge Case: Too-Hard Questions
**As a** presenter  
**I want** feedback if questions are too difficult based on transcript complexity  
**So that** I can adjust or provide hints.

---

## Error Handling & Retries

### User Story: Retry Question Generation
**As a** presenter  
**I want to** retry quiz generation if the first attempt fails  
**So that** I don't have to re-record my entire presentation.

### User Story: API Rate Limit Handling
**As a** presenter  
**I want** clear messaging when API rate limits are hit  
**So that** I know to wait before retrying.

### User Story: Network Failure During Upload
**As a** presenter  
**I want** the system to retry audio upload if network fails  
**So that** my recording isn't lost due to temporary connectivity issues.

### User Story: Partial Generation Success
**As a** presenter  
**I want** to see how many questions were successfully generated even if some failed  
**So that** I can decide whether to proceed with partial results.

### User Story: Switch to Manual Mode
**As a** presenter  
**I want** an option to switch to manual question entry if AI generation repeatedly fails  
**So that** the event can continue without dependency on AI.

### Edge Case: OpenAI API Down
**As a** presenter  
**I want** clear error messages when OpenAI services are unavailable  
**So that** I know it's not my fault and can try again later or switch to manual mode.

### Edge Case: Invalid API Key
**As** the system  
**I want** to detect invalid or expired OpenAI API keys on startup  
**So that** admins can fix configuration before events begin.

### Edge Case: Quota Exceeded
**As an** admin  
**I want** alerts when approaching OpenAI usage quota limits  
**So that** I can upgrade my plan before the service stops working.

---

## Presenter Experience

### User Story: Recording Instructions
**As a** first-time presenter  
**I want** clear onboarding instructions for the recording process  
**So that** I understand what to do and feel confident.

### User Story: Content Suggestions
**As a** presenter  
**I want** tips on what makes good AI-generated questions (facts, clear concepts, definitions)  
**So that** I structure my presentation to generate better questions.

### User Story: Recording Tips
**As a** presenter  
**I want** guidance on optimal recording practices (speak clearly, avoid filler words, etc.)  
**So that** I get better transcription results.

### User Story: Minimum Content Guidance
**As a** presenter  
**I want to** know the minimum presentation length needed for good questions (e.g., 2-3 minutes)  
**So that** I don't end recording too early.

### User Story: Expected Wait Time
**As a** presenter  
**I want to** know approximately how long quiz generation will take  
**So that** I can set expectations for participants.

### Edge Case: Presenter Forgets to Click Generate
**As** the system  
**I want** a reminder if recording has been stopped for >2 minutes without generating  
**So that** the presenter doesn't forget the next step.

---

## Participant Experience During Generation

### User Story: Clear Wait Message
**As a** participant  
**I want** a clear message like "Generating your quiz..." during the wait  
**So that** I know what's happening.

### User Story: Flappy Bird Instructions
**As a** participant  
**I want** simple instructions ("Click or press SPACE to flap")  
**So that** I can immediately start playing.

### User Story: Flappy Bird Game Over
**As a** participant  
**I want** to restart Flappy Bird after crashing  
**So that** I can keep playing if generation takes longer.

### User Story: Flappy Bird Score Display
**As a** participant  
**I want** to see my Flappy Bird score  
**So that** I can compete with myself and stay engaged.

### User Story: Generation Complete Notification
**As a** participant  
**I want** a smooth transition from Flappy Bird to the quiz  
**So that** I'm not confused when the screen suddenly changes.

### Edge Case: Generation Faster Than Expected
**As** the system  
**I want** Flappy Bird to remain visible for at least 3 seconds even if generation is very fast  
**So that** participants aren't jarred by instant transitions.

### Edge Case: Generation Takes Multiple Minutes
**As a** participant  
**I want** Flappy Bird to remain engaging even if generation takes 2-3 minutes  
**So that** I don't get bored waiting.

---

## Quality Assurance

### User Story: Question Relevance Validation
**As** the system  
**I want** to validate that generated questions are actually about the transcript content  
**So that** participants aren't asked random questions.

### User Story: Answer Correctness Validation
**As** the system  
**I want** to verify that the marked "correct answer" is actually correct based on the transcript  
**So that** participants get accurate feedback.

### User Story: Fake Answer Quality
**As** the system  
**I want** fake answers to be plausible but distinguishably wrong  
**So that** the quiz is challenging but fair.

### Edge Case: Duplicate Questions Generated
**As** the system  
**I want to** detect and remove duplicate questions in the same segment  
**So that** participants aren't asked the same thing twice.

### Edge Case: Questions from Different Segments
**As** the system  
**I want to** ensure segment questions are distinct from each other  
**So that** the mega quiz has variety.

---

## Audio Technical Requirements

### User Story: Browser Compatibility Check
**As a** presenter  
**I want** to be warned if my browser doesn't support audio recording  
**So that** I can switch browsers before starting.

### User Story: Audio Format Selection
**As** the system  
**I want to** automatically select the best audio format supported by the browser  
**So that** recordings work across different browsers.

### User Story: Audio File Size Limit
**As a** presenter  
**I want** warnings if my recording will produce a very large file  
**So that** I know upload might take time.

### Edge Case: Safari WebM Support
**As a** presenter on Safari  
**I want** the system to use a compatible audio format  
**So that** recording works even though Safari doesn't support WebM.

### Edge Case: Mobile Recording
**As a** presenter on mobile  
**I want** audio recording to work on phone browsers  
**So that** I can present from my mobile device.

---

## Cost & Performance

### User Story: Transcription Speed
**As a** presenter  
**I want** transcription to complete in under 10 seconds for typical presentations  
**So that** participants don't lose interest waiting.

### User Story: Question Generation Speed
**As a** presenter  
**I want** questions to generate in under 30 seconds total  
**So that** the flow remains smooth.

### User Story: Cost Transparency (Admin)
**As an** admin  
**I want** to understand the OpenAI API costs per event  
**So that** I can budget appropriately.

### Edge Case: Very Long Presentations
**As** the system  
**I want** to handle 10+ minute recordings without timing out  
**So that** detailed presentations are supported.

### Edge Case: Concurrent Generations
**As** the system  
**I want** to handle multiple presenters generating quizzes simultaneously  
**So that** parallel events don't slow each other down.

---

## Transcript Management

### User Story: View Transcript
**As a** presenter  
**I want** to see the full transcript after generation  
**So that** I can verify what the system heard.

### User Story: Transcript Stored in Database
**As** the system  
**I want to** save transcripts to the database  
**So that** they're available for review and question editing later.

### User Story: Transcript in Export
**As an** admin  
**I want** transcripts included in event export data  
**So that** I have a complete record of what was presented.

### Edge Case: Transcript Contains Profanity
**As** the system  
**I want** to handle transcripts with inappropriate language gracefully  
**So that** the quiz remains appropriate (or warn the presenter).

### Edge Case: Transcript Truncation
**As a** presenter  
**I want** to know if my transcript was too long and got truncated  
**So that** I understand why later content didn't generate questions.

---

## Multi-Presenter Coordination

### User Story: Sequential Recording
**As** the system  
**I want** only one presenter to record at a time  
**So that** audio doesn't mix and transcription remains accurate.

### User Story: Next Presenter Notification
**As** the next presenter  
**I want** a notification when it's my turn to present  
**So that** I'm ready to start my segment.

### User Story: Presenter Handoff with Recording
**As a** presenter  
**I want** to pass presenter role after my quiz completes  
**So that** the next person can record their presentation.

### Edge Case: Presenter Starts Recording Without Being Assigned
**As** the system  
**I want to** prevent non-presenters from starting recording  
**So that** only the assigned presenter can capture audio.

---

## Fallback & Flexibility

### User Story: Manual Question Override
**As a** presenter  
**I want** to add manual questions even in live mode  
**So that** I can supplement AI-generated questions with custom content.

### User Story: Skip Generation and Add Manually
**As a** presenter  
**I want** an option to skip AI generation entirely and add all questions manually  
**So that** I have control if AI isn't generating good questions.

### User Story: Regenerate Questions
**As a** presenter  
**I want** to regenerate questions from the same recording if I'm not satisfied  
**So that** I can get better results without re-presenting.

### Edge Case: Generation Produces Zero Questions
**As a** presenter  
**I want** clear options (retry, manual entry, skip segment) when no questions are generated  
**So that** I can recover from this situation.

---

## Answer Display for Presenter

### User Story: See Correct Answer During Quiz
**As a** presenter  
**I want** the correct answer highlighted in green during the quiz  
**So that** I can see what participants should be selecting.

### User Story: Correct Answer Marker
**As a** presenter  
**I want** a "✓ CORRECT" marker on the right answer  
**So that** it's immediately obvious which answer is correct.

### User Story: Presenter View Label
**As a** presenter  
**I want** text saying "Presenter view - Correct answer highlighted"  
**So that** I know this special view is only visible to me.

### Edge Case: Accidentally Revealing Answer
**As a** presenter  
**I want** assurance that my view is private and participants can't see the highlighting  
**So that** I don't accidentally give away answers.

---

## Wait Time Experience

### User Story: Entertaining Wait
**As a** participant  
**I want** something fun to do during the 10-30 second wait  
**So that** I'm not just staring at a loading spinner.

### User Story: Synchronized Game Start
**As a** participant  
**I want** Flappy Bird to appear for everyone at the same time  
**So that** we all start playing together.

### User Story: Synchronized Game End
**As a** participant  
**I want** Flappy Bird to disappear for everyone when the quiz is ready  
**So that** we all transition to the quiz together.

### Edge Case: Player Joins During Generation
**As a** late participant  
**I want** to see Flappy Bird if I join while a quiz is being generated  
**So that** I have the same experience as everyone else.

---

## Summary

| Category | Story Count |
|----------|-------------|
| Audio Recording & Permissions | 12 |
| Quiz Generation Flow | 9 |
| Transcription Quality | 6 |
| Question Quality & Review | 10 |
| Audio Technical Requirements | 5 |
| Cost & Performance | 5 |
| Transcript Management | 5 |
| Multi-Presenter Coordination | 4 |
| Fallback & Flexibility | 4 |
| Answer Display for Presenter | 4 |
| Wait Time Experience | 4 |
| **Total** | **68** |

---

## Implementation Status

### Fully Implemented ✅

- ✅ Microphone permission request
- ✅ Start recording button
- ✅ Visual recording indicator (LIVE badge, timer)
- ✅ Recording duration display
- ✅ Generate Quiz button with helper text
- ✅ Flappy Bird during generation (all participants + presenter)
- ✅ Auto-navigate when ready
- ✅ Short recording rejection (<50 words)
- ✅ No questions generated fallback options
- ✅ Presenter sees correct answer highlighted
- ✅ ✓ CORRECT marker display
- ✅ Presenter view label
- ✅ Synchronized Flappy Bird start/end
- ✅ Transcript stored in database
- ✅ Question source tracking
- ✅ Edit/delete generated questions
- ✅ Add manual questions to supplement AI
- ✅ Error messages for generation failures
- ✅ AI service unavailable fallback

### Partially Implemented ⚠️

- ⚠️ Pause/Resume recording (UI exists but not wired to new recording hook)
- ⚠️ Restart recording (UI exists but not fully functional in new flow)
- ⚠️ Transcript preview (stored but not displayed to presenter)
- ⚠️ Generation progress indication (Flappy Bird shows, but no % progress)
- ⚠️ Regenerate from same recording (would need to store audio)

### Not Implemented ❌

- ❌ Recording without speech detection
- ❌ Very long recording warnings
- ❌ Microphone disconnect detection
- ❌ Background noise handling feedback
- ❌ Non-English language handling
- ❌ Heavy accent warnings
- ❌ Transcript confidence scores
- ❌ Browser compatibility check (just fails if not supported)
- ❌ Audio format fallback for Safari
- ❌ Mobile recording optimization
- ❌ Cost transparency UI
- ❌ Concurrent generation limits
- ❌ Transcript contains profanity detection
- ❌ Duplicate question detection
- ❌ Question ambiguity scoring
- ❌ Too-easy/too-hard question feedback
- ❌ Flappy Bird high score persistence
- ❌ Late joiner sees Flappy Bird if joining during generation

---

## Recommendations

### High Priority (Party-Critical)

1. **Test with real content**: Record actual 2-3 minute presentations and verify question quality
2. **Add transcript preview**: Let presenter review what was heard before quiz starts
3. **Better error messages**: More specific feedback for different failure modes
4. **Mobile testing**: Verify recording works on iOS/Android browsers

### Medium Priority (Nice to Have)

1. **Pause/Resume wiring**: Connect pause/resume to new recording hook
2. **Regeneration**: Store audio blob to allow regenerating without re-recording
3. **Progress indicator**: Show "Transcribing... 50% complete" instead of just Flappy Bird
4. **Question review step**: Optional "review questions before starting quiz" screen

### Low Priority (Future Enhancements)

1. **Audio quality detection**: Warn if audio is very quiet or noisy
2. **Language detection**: Support multiple languages
3. **Cost tracking**: Dashboard showing API usage and costs
4. **Flappy Bird leaderboard**: Track high scores across events
5. **Question quality scoring UI**: Show AI confidence per question

---

## Gap Analysis

The original USER_STORIES.md covered **traditional quiz gameplay excellently** (85 stories), but was missing **the entire live audio workflow** (68 stories in this document).

**Combined Total: 153 user stories** for complete feature coverage.

**Current Implementation: ~90 stories fully implemented** (~59% of combined total)

The app is **party-ready for basic live audio use**, but has room for polish in:
- Error handling edge cases
- Quality feedback mechanisms
- Mobile/browser compatibility
- Cost transparency

---

## Related Documentation

- `USER_STORIES.md` - Original quiz gameplay stories (85 stories)
- `LIVE_AUDIO_IMPLEMENTATION_COMPLETE.md` - Implementation details
- `100_PERCENT_TESTS_PASSING.md` - Test validation

