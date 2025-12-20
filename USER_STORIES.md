# User Stories - Quiz App

This document contains user stories for the quiz application, organized by feature area.

---

## Session Entry (QR-Only)

### User Story: Join Session via QR Code
**As a** participant  
**I want to** scan a QR code to join the event  
**So that** I can enter the session without typing anything.

### User Story: Required QR Scan
**As** the system  
**I require** all users to join via QR code  
**So that** access is limited to people physically present.

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

### User Story: Name Selection After Scan
**As a** participant  
**I want to** choose my display name after scanning the QR code  
**So that** I am identifiable on leaderboards.

### User Story: Prevent Duplicate Players
**As** the system  
**I want to** prevent the same device from joining the session multiple times  
**So that** scores remain fair.

### User Story: Rejoin via QR
**As a** participant  
**I want to** re-scan the QR code after a disconnect  
**So that** I can rejoin with my existing score and role.

### User Story: Device Identity Binding
**As** the system  
**I want to** associate a QR join with a device/session token  
**So that** rejoining restores state automatically.

### Edge Case: Username Already Taken
**As a** participant  
**I want** clear feedback when my chosen display name is already taken by another participant  
**So that** I can choose a different name and still join quickly.

### Edge Case: Rejoin After Event Ended
**As a** participant  
**I want** a clear message when I try to rejoin an event that has already ended  
**So that** I understand why I can't reconnect and don't keep trying.

### Edge Case: Device Identity Changes Mid-Session
**As** the system  
**I want to** handle scenarios where a device's identity token becomes invalid mid-session (e.g., browser storage cleared)  
**So that** the participant can re-authenticate without losing their score.

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
**I want to** see a real-time list and count of participants who joined via QR  
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
**I want to** ensure only users who successfully joined via QR can submit quiz answers.

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
**I want** the leaderboard to include only players who joined via QR  
**So that** rankings are accurate.

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

### User Story: QR Remains Active Across Presenter Changes
**As** the system  
**I want** the QR code to remain valid when the presenter role is passed  
**So that** the session is continuous.

### User Story: Presenter Role Transfer Without Rejoin
**As a** participant  
**I want to** become the presenter without re-scanning the QR code  
**So that** role changes are seamless.

### Edge Case: Pass Presenter to Disconnected Participant
**As** the presenter  
**I want** feedback when I attempt to pass the presenter role to a participant who has disconnected  
**So that** I can choose an active participant instead.

### Edge Case: All Potential Presenters Disconnect
**As** the system  
**I want to** handle scenarios where all designated presenters disconnect mid-event  
**So that** the event can be paused or a recovery path is available.

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

### User Story: Handle Duplicate Join Attempts
**As a** participant
**I want** to be prevented from joining the same event multiple times from different devices
**So that** I don't create multiple entries and confuse the scoring system.

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

### User Story: Multiple Simultaneous Events
**As a** system
**I want** to prevent users from joining multiple events simultaneously
**So that** scoring and state management remain consistent.

### User Story: Invalid QR Code Scan
**As a** participant
**I want** clear error handling when scanning an invalid or corrupted QR code
**So that** I can try again or get the correct code from the host.

---

## Event Management

### User Story: Create Event as Host
**As a** host  
**I want to** startup the application and create an event  
**So that** others can join and participate in my quiz event.

### Edge Case: Create Event with Empty Title
**As** the system  
**I want to** prevent event creation with an empty or whitespace-only title  
**So that** all events have meaningful identifiers.

### Edge Case: Create Event While Another Event Active
**As a** host  
**I want** to be able to create a new event even if I have another active event  
**So that** I can prepare future events without ending current ones.

### Edge Case: Event Creation with Special Characters
**As a** host  
**I want** event titles to support emojis and special characters  
**So that** I can create engaging and expressive event names.

---

## Account Management

### User Story: Manage Account Settings
**As a** user  
**I want to** manage my account after creating an account and logging in  
**So that** I can change my username, change my emoji/avatar, and update my profile information.

### Edge Case: Change to Already Taken Username
**As a** user  
**I want** clear feedback when I try to change my username to one that's already taken  
**So that** I can choose a different username.

### Edge Case: Avatar Upload Exceeds Size Limit
**As a** user  
**I want** clear feedback when my custom avatar file is too large  
**So that** I know the maximum file size and can resize my image.

### Edge Case: Avatar Upload Invalid Format
**As a** user  
**I want** clear feedback when I upload an unsupported image format  
**So that** I know which formats are accepted (e.g., PNG, JPG, GIF).

### Edge Case: Profile Update While in Active Event
**As a** user  
**I want** my profile changes (username, avatar) to be reflected in the current event  
**So that** other participants see my updated identity.

---

## Summary

| Category | Story Count |
|----------|-------------|
| Session Entry (QR-Only) | 6 |
| Identity & Rejoining | 7 |
| Late Joiners | 5 |
| Presenter Controls (QR-Aware) | 5 |
| Quiz Flow (Aligned with QR Entry) | 4 |
| Scoring & Leaderboards | 5 |
| Presenter Rotation | 4 |
| Presenter Controls & Recovery | 5 |
| Reliability & Edge Cases | 12 |
| Event Management | 4 |
| Account Management | 5 |
| **Total** | **62** |

---

## Related Documentation

- `ARCHITECTURE.md` - System architecture overview
- `CLAUDE.md` - Development guide and patterns
- `MULTI_PRESENTER_IMPLEMENTATION.md` - Multi-presenter feature implementation
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation steps

