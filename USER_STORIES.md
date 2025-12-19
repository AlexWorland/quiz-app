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

---

## Quiz Flow (Aligned with QR Entry)

### User Story: Prevent Answering Before Join
**As** the system  
**I want to** ensure only users who successfully joined via QR can submit quiz answers.

### User Story: Join State Awareness
**As a** participant  
**I want to** see whether I am "joined," "waiting," or "active in quiz"  
**So that** I understand my current status.

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

---

## Summary

| Category | Story Count |
|----------|-------------|
| Session Entry (QR-Only) | 4 |
| Identity & Rejoining | 4 |
| Late Joiners | 3 |
| Presenter Controls (QR-Aware) | 3 |
| Quiz Flow (Aligned with QR Entry) | 2 |
| Scoring & Leaderboards | 3 |
| Presenter Rotation | 2 |
| Presenter Controls & Recovery | 3 |
| Reliability & Edge Cases | 3 |
| **Total** | **27** |

---

## Related Documentation

- `ARCHITECTURE.md` - System architecture overview
- `CLAUDE.md` - Development guide and patterns
- `MULTI_PRESENTER_IMPLEMENTATION.md` - Multi-presenter feature implementation
- `IMPLEMENTATION_GUIDE.md` - Detailed implementation steps

