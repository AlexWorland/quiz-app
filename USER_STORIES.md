# User Stories - Quiz App

This document contains user stories for the quiz application, organized by feature area.

---

## Session Entry (QR-Only)

### User Story: Join Session via QR Code
**As a** participant  
**I want to** scan a QR code to join the event  
**So that** I can enter the session without typing anything.

### User Story: Primary QR Scan Entry
**As** the system
**I want** QR code scanning to be the primary join method with manual code as fallback
**So that** access is optimized for people physically present while remaining accessible.

### User Story: Display Join QR
**As** the presenter  
**I want** a large, high-contrast QR code displayed on the shared screen  
**So that** everyone in the room can scan it easily.

### User Story: Persistent QR
**As** a presenter  
**I want** the QR code to remain valid for the entire event  
**So that** late participants can still join.

### Edge Case: QR Code Display Failure
**As** the presenter  
**I want** a fallback option (e.g., manual join code) if the QR code fails to render on my screen  
**So that** participants can still join even if QR display is broken.

### Edge Case: Simultaneous QR Scans
**As** the system  
**I want to** handle multiple participants scanning the QR code at the exact same moment  
**So that** all scans are processed without errors or race conditions.

---

## Identity & Rejoining

### User Story: Enter Display Name on Join
**As a** participant
**I want to** enter my display name when joining an event
**So that** I am identifiable on leaderboards.

### User Story: Select Avatar on Join
**As a** participant
**I want to** select an avatar (emoji or preset) on the same screen where I enter my name
**So that** I have a visual identity in the event.

### User Story: Duplicate Name Handling
**As** the system
**I want to** append numbers to duplicate display names (e.g., "Alex", "Alex 2", "Alex 3")
**So that** multiple participants can use similar names without confusion.

### User Story: Change Display Name
**As a** participant
**I want to** change my display name at any time during the event
**So that** I can correct typos or update my identity.

### User Story: Prevent Duplicate Device Sessions
**As** the system
**I want to** prevent the same device from having multiple active sessions in one event
**So that** scores remain fair and each device has one identity per event.

### User Story: Rejoin via QR
**As a** participant  
**I want to** re-scan the QR code after a disconnect  
**So that** I can rejoin with my existing score and role.

### User Story: Device Identity Binding
**As** the system
**I want to** track participants by device ID (not username) throughout the event
**So that** score and state are preserved even if they change their display name.

### Edge Case: Same User Already in Event
**As a** participant
**I want** clear feedback when I try to join an event I'm already participating in
**So that** I understand I'm already connected and can return to my session.

### Edge Case: Rejoin After Event Ended
**As a** participant  
**I want** a clear message when I try to rejoin an event that has already ended  
**So that** I understand why I can't reconnect and don't keep trying.

### Edge Case: Device Identity Lost Mid-Session
**As** the system
**I want to** handle scenarios where a device's identity token becomes invalid mid-session (e.g., browser storage cleared)
**So that** the participant can re-enter their name and rejoin without losing their score.

---

## Late Joiners

### User Story: Late Join During Presentation
**As a** participant  
**I want to** scan the QR code and join even if a presentation segment has already started  
**So that** I can participate in future questions.

### User Story: Late Join During Quiz
**As** the system  
**I want** late joiners to wait until the next question before answering  
**So that** the quiz flow is not disrupted.

### User Story: Late Join Scoring Rules
**As a** participant  
**I want** unanswered earlier questions to score zero rather than disqualifying me  
**So that** joining late is still worthwhile.

### Edge Case: Late Join During Final Question
**As a** participant  
**I want** to join even if only the last question remains  
**So that** I can at least see the results and be included in future segments.

### Edge Case: Late Join During Leaderboard Display
**As a** participant  
**I want** to join during the leaderboard phase between questions  
**So that** I'm ready when the next question begins.

---

## Presenter Controls (QR-Aware)

### User Story: Lock QR Joining
**As** the presenter  
**I want to** temporarily lock QR joining  
**So that** no new participants can enter during sensitive moments.

### User Story: Unlock QR Joining
**As** the presenter  
**I want to** re-enable QR joining  
**So that** additional participants can enter.

### User Story: View Joined Participants
**As** the presenter
**I want to** see a real-time list and count of participants who have joined
**So that** I know when to start.

### Edge Case: Lock QR While Participant Mid-Scan
**As** the system  
**I want to** handle a participant who started scanning before lock but submits after lock  
**So that** their join attempt is handled gracefully (either allowed or shown a clear error).

### Edge Case: Presenter Forgets to Unlock QR
**As a** presenter  
**I want** a visual reminder when QR joining has been locked for an extended period  
**So that** I don't accidentally lock out late participants.

---

## Quiz Flow (Aligned with QR Entry)

### User Story: Prevent Answering Before Join
**As** the system
**I want to** ensure only users who successfully joined the event can submit quiz answers
**So that** only legitimate participants can affect the quiz results.

### User Story: Join State Awareness
**As a** participant  
**I want to** see whether I am "joined," "waiting," or "active in quiz"  
**So that** I understand my current status.

### Edge Case: Answer Submitted at Timeout Boundary
**As** the system  
**I want to** handle answers submitted exactly as the timer expires  
**So that** participants receive consistent and fair scoring regardless of network latency.

### Edge Case: Rapid Multiple Answer Submissions
**As** the system  
**I want to** accept only the first answer when a participant rapidly clicks multiple answers  
**So that** scoring is deterministic and abuse is prevented.

---

## Scoring & Leaderboards

### User Story: Leaderboard Includes Only Joined Players
**As a** participant
**I want** the leaderboard to include only players who successfully joined the event
**So that** rankings are accurate and limited to actual participants.

### User Story: Late Join Visibility
**As a** participant  
**I want** late joiners to be visually marked on the leaderboard  
**So that** score differences are understandable.

### User Story: Segment vs Event Scores
**As a** participant  
**I want** my segment score and total event score tracked separately even if I joined late.

### Edge Case: Tie Score Between Participants
**As a** participant  
**I want** tie-breaking rules to be clear and fair (e.g., faster response time wins)  
**So that** leaderboard rankings are unambiguous.

### Edge Case: All Participants Score Zero
**As** the presenter  
**I want** the leaderboard to display gracefully when all participants score zero  
**So that** the quiz can continue without errors or confusion.

---

## Presenter Rotation

### User Story: Admin Picks First Presenter
**As an** admin
**I want to** select the first presenter from the joined participants
**So that** the event can begin with the right person presenting.

### User Story: Presenter Picks Next Presenter
**As a** presenter
**I want to** select the next presenter after my segment quiz completes
**So that** the event flows naturally without admin intervention.

### User Story: Admin Override Presenter Selection
**As an** admin
**I want to** override presenter selection at any time
**So that** I can correct mistakes or handle unexpected situations.

### User Story: Automatic Presenter Promotion
**As** the system
**I want to** automatically promote the selected participant to presenter
**So that** they gain presenter controls for their segment.

### User Story: Automatic Presenter Demotion
**As** the system
**I want to** automatically demote the current presenter to participant after they select the next presenter
**So that** only one presenter is active at a time.

### User Story: QR Remains Active Across Presenter Changes
**As** the system
**I want** the QR code to remain valid when the presenter role is passed
**So that** the session is continuous and late joiners can still enter.

### User Story: Seamless Role Transition
**As a** participant being promoted to presenter
**I want** my view to automatically switch to presenter mode
**So that** the transition is smooth without re-scanning or refreshing.

### Edge Case: Pass Presenter to Disconnected Participant
**As a** presenter
**I want** feedback when I attempt to pass the presenter role to a participant who has disconnected
**So that** I can choose an active participant instead.

### Edge Case: All Participants Disconnect Before Selection
**As** the system
**I want to** handle scenarios where all participants disconnect before the next presenter can be selected
**So that** the event can be paused until participants rejoin.

### Edge Case: Presenter Disconnects Before Selecting Next
**As** the system
**I want to** allow the admin to select the next presenter if the current presenter disconnects
**So that** the event can continue.

---

## Presenter Controls & Recovery

### User Story: Resume Accidentally Ended Segment
**As** the presenter
**I want to** resume a segment that I accidentally ended
**So that** I don't lose participant progress or need to start over.

### User Story: Resume Accidentally Ended Event
**As** the presenter
**I want to** resume an event that I accidentally ended
**So that** the entire event flow isn't disrupted.

### User Story: Clear Resume State
**As** the presenter
**I want to** clear the resume state and proceed normally
**So that** I can intentionally move forward if a resume was accidental.

### Edge Case: Resume After All Participants Left
**As** the presenter  
**I want** feedback when I resume an event or segment but all participants have disconnected  
**So that** I know to wait for re-joins before continuing.

### Edge Case: Multiple Rapid Resume Attempts
**As** the system
**I want to** handle multiple resume button clicks in quick succession
**So that** the event state doesn't become corrupted or inconsistent.

---

## Segment Flow & Leaderboards

### User Story: Segment Quiz After Presentation
**As a** presenter
**I want** the quiz for my segment to start after I finish presenting
**So that** participants answer questions while the content is fresh.

### User Story: Segment Leaderboard Display
**As** the system
**I want to** display the segment leaderboard after each segment quiz completes
**So that** participants see their progress before the next presenter takes over.

### User Story: Presenter Selection After Leaderboard
**As a** presenter
**I want to** select the next presenter only after the segment leaderboard is shown
**So that** participants have time to see their scores.

### Edge Case: No Questions Generated for Segment
**As** the system
**I want to** handle segments where no quiz questions were generated
**So that** the event can continue to the next presenter without errors.

---

## Mega Quiz & Event Completion

### User Story: Mega Quiz After Last Segment
**As** the system
**I want to** trigger a mega quiz after the last presenter's segment completes
**So that** participants are tested on content from all presentations.

### User Story: Mega Quiz Questions from All Segments
**As** the system
**I want** the mega quiz to include questions generated from every segment
**So that** the final quiz covers the entire event.

### User Story: Final Leaderboard Display
**As** the system
**I want to** display the final cumulative leaderboard after the mega quiz
**So that** participants see their overall performance across all segments.

### Edge Case: Mega Quiz with Only One Segment
**As** the system
**I want to** handle events with only one presenter gracefully
**So that** the mega quiz works even with limited content.

### Edge Case: Participants Leave Before Mega Quiz
**As** the system
**I want to** include all participants in the final leaderboard even if they left before the mega quiz
**So that** their earlier segment scores are still counted.

---

## Data Export & Persistence

### User Story: Event Data Persistence
**As** the system
**I want to** save all event data to the database after completion
**So that** event history is preserved.

### User Story: Export Event Results to File
**As an** admin
**I want** the system to export quiz results to a file when the event ends
**So that** I have a record of questions, answers, and leaderboards.

### User Story: Export Format Options
**As an** admin
**I want to** choose export format (JSON or CSV)
**So that** I can use the data in my preferred tools.

### User Story: Export Includes All Data
**As an** admin
**I want** the export to include all quiz questions, correct answers, participant answers, and leaderboards
**So that** I have complete event documentation.

### Edge Case: Export Fails Mid-Process
**As** the system
**I want to** retry failed exports and notify the admin
**So that** data is not lost due to temporary failures.

---

## Reliability & Edge Cases

### User Story: Camera Permission Failure
**As a** participant  
**I want** clear instructions if camera permissions block QR scanning  
**So that** I can resolve the issue.

### User Story: Invalid or Expired QR
**As a** participant  
**I want** a clear error if I scan an invalid or expired QR code  
**So that** I know what went wrong.

### User Story: Network Loss After Join
**As a** participant
**I want** temporary network loss to not remove me from the session
**So that** my score is preserved.

### User Story: Handle Duplicate Device Join Attempts
**As a** participant
**I want** clear feedback when I try to join an event from a device that's already connected
**So that** I understand my session is already active on this device.

### User Story: Invalid Event Code Handling
**As a** participant
**I want** clear feedback when I enter an invalid or non-existent event code
**So that** I know the code is wrong and can try again or ask the host for the correct code.

### User Story: Presenter Disconnection Recovery
**As a** presenter
**I want** the system to handle my unexpected disconnection gracefully
**So that** participants aren't stuck waiting and the event can continue or be resumed.

### User Story: Late Answer Submission
**As a** participant
**I want** to see what happens when I try to submit an answer after the time limit has expired
**So that** I understand the scoring rules and don't feel cheated.

### User Story: WebRTC Camera Not Supported
**As a** participant
**I want** alternative joining methods when my device doesn't support camera access for QR scanning
**So that** I can still participate in events.

### User Story: AI Service Unavailable
**As a** presenter
**I want** fallback options when AI services are down during question generation
**So that** I can still create questions manually and continue with the event.

### User Story: Browser Tab Closed During Quiz
**As a** participant
**I want** my session to be recoverable if I accidentally close my browser tab during a quiz
**So that** I don't lose my progress and scores.

### User Story: Single Device Single Event
**As** the system
**I want** each device to only participate in one event at a time
**So that** participants focus on their current event and device identity remains clear.

### User Story: Invalid QR Code Scan
**As a** participant
**I want** clear error handling when scanning an invalid or corrupted QR code
**So that** I can try again or get the correct code from the host.

---

## Event Management

### User Story: Create Event Button Visible to All
**As a** visitor
**I want to** see the "Create Event" button even if I'm not logged in
**So that** I know hosting events is possible.

### User Story: Account Required for Event Creation
**As** the system
**I want to** prompt visitors to create an admin account or log in when they try to create an event
**So that** events have an accountable owner.

### User Story: Create Event as Admin
**As an** admin
**I want to** create an event after logging in
**So that** others can join and participate in my quiz event.

### Edge Case: Create Event with Empty Title
**As** the system
**I want to** prevent event creation with an empty or whitespace-only title
**So that** all events have meaningful identifiers.

### Edge Case: Create Event While Another Event Active
**As an** admin
**I want** to be able to create a new event even if I have another active event
**So that** I can prepare future events without ending current ones.

### Edge Case: Event Creation with Special Characters
**As an** admin
**I want** event titles to support emojis and special characters
**So that** I can create engaging and expressive event names.

---

## Account Management (Admins Only)

### User Story: Manage Admin Account Settings
**As an** admin
**I want to** manage my account settings after logging in
**So that** I can update my username and profile information.

### Edge Case: Change to Already Taken Admin Username
**As an** admin
**I want** clear feedback when I try to change my username to one already taken by another admin
**So that** I can choose a different username.

### Edge Case: Admin Joins as Anonymous Participant
**As an** admin
**I want to** be able to join other admins' events as an anonymous participant
**So that** I can experience events without my admin identity.

---

## Summary

| Category | Story Count |
|----------|-------------|
| Session Entry (QR-Only) | 6 |
| Identity & Rejoining | 10 |
| Late Joiners | 5 |
| Presenter Controls (QR-Aware) | 5 |
| Quiz Flow (Aligned with QR Entry) | 4 |
| Scoring & Leaderboards | 5 |
| Presenter Rotation | 11 |
| Presenter Controls & Recovery | 5 |
| Segment Flow & Leaderboards | 4 |
| Mega Quiz & Event Completion | 5 |
| Data Export & Persistence | 5 |
| Reliability & Edge Cases | 11 |
| Event Management | 6 |
| Account Management (Admins Only) | 3 |
| **Total** | **85** |

---

## Related Documentation

- `ARCHITECTURE.md` - System architecture overview
- `CLAUDE.md` - Development guide and patterns
- `JACKBOX_STYLE_ARCHITECTURE.md` - Jackbox-style session model
- `MULTI_PRESENTER_IMPLEMENTATION.md` - Multi-presenter feature implementation
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation steps

