# Jackbox-Style Architecture

This document describes the session-based participant model inspired by Jackbox Games.

---

## Overview

The quiz app uses a **hybrid authentication model**:
- **Hosts/Admins**: Account-based (username + password)
- **Participants**: Anonymous, device-based sessions (no account required)

---

## User Types

### 1. Admin/Host
- Has a persistent account (username + password)
- Can create and manage events
- Acts as game administrator
- Can override presenter selection at any time
- Has access to account settings page

### 2. Participant
- No account required
- Joins via QR code or join code
- Enters display name + selects avatar on join screen
- Device fingerprint ties them to the session for reconnection
- Identity only persists for the duration of ONE event

### 3. Presenter (Promoted Participant)
- A participant temporarily elevated to run their segment
- Can present, administer their segment's quiz, and pick the next presenter
- Demoted back to participant after their segment completes

---

## Join Flow (Participants)

```
1. Host displays QR code / join code on screen
2. Participant scans QR or navigates to app and enters code
3. Participant enters:
   - Display name (duplicates get numbers appended: "Alex", "Alex 2")
   - Avatar selection (emoji or preset)
4. Participant joins the event lobby
5. Device fingerprint stored for reconnection
```

---

## Event Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                         EVENT FLOW                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin creates event (requires account)                       │
│  2. Admin picks 1st presenter from joined participants           │
│  3. QR code / join code displayed for participants               │
│                                                                  │
│  ┌─────────── SEGMENT LOOP (repeat for each presenter) ────────┐│
│  │                                                              ││
│  │  a. Current presenter gives their presentation               ││
│  │  b. Current presenter administers their segment quiz         ││
│  │  c. Segment leaderboard displayed                            ││
│  │  d. Current presenter picks next presenter                   ││
│  │  e. Current presenter demoted to participant                 ││
│  │  f. Next presenter promoted                                  ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  4. After last segment: MEGA QUIZ (questions from all segments)  │
│  5. Final leaderboard displayed                                  │
│  6. Event data exported to file + database                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Presenter Promotion/Demotion

| Action | Who Can Do It | When |
|--------|---------------|------|
| Pick 1st presenter | Admin only | Before event starts |
| Pick next presenter | Current presenter | After their segment quiz completes |
| Override presenter choice | Admin only | Any time |
| Demote presenter | System (automatic) | After they pick next presenter |
| Promote to presenter | System (automatic) | When selected as next presenter |

---

## Username Handling (Jackbox-Style)

When a participant enters a name that already exists in the event:

```
"Alex" joins     → "Alex"
"Alex" joins     → "Alex 2"
"Alex" joins     → "Alex 3"
"Bob" joins      → "Bob"
"Alex 2" leaves  → (slot freed)
"Alex" joins     → "Alex 2" (reuses lowest available)
```

Participants can change their name at any time (same duplicate rules apply).

---

## Device Identity

- **Scope**: Single event only
- **Storage**: Browser localStorage or fingerprint
- **Purpose**: Reconnection after disconnect
- **Cleared**: When event ends or participant leaves voluntarily

### Reconnection Flow
```
1. Participant disconnects (network issue, refresh, etc.)
2. Participant returns to app with same device
3. System recognizes device fingerprint
4. Participant automatically rejoins as their previous identity
5. Score and state preserved
```

---

## Data Export (End of Event)

When an event completes, export to file:
- All quiz questions and correct answers
- All participant answers (per question, per segment)
- Segment leaderboards
- Final leaderboard
- Mega quiz results

Format: JSON or CSV (configurable)

---

## Account Creation Prompt

For non-authenticated users trying to create an event:

```
1. User clicks "Create Event" button (visible to all)
2. If not logged in:
   - Prompt: "Create an admin account to host events"
   - Options: [Create Account] [Login] [Cancel]
3. After account creation/login, proceed to event creation
```

---

## UI Screens

### For Participants (No Account)
- Join screen (code entry + name + avatar)
- Waiting lobby
- Quiz answering view
- Leaderboard view

### For Admins (With Account)
- Login / Register
- Account settings
- Event creation
- Event management (presenter controls, override)
- All participant views (when joining as participant)

---

## Key Differences from Current Implementation

| Aspect | Current | Jackbox-Style |
|--------|---------|---------------|
| Participant auth | Account required | Anonymous (name + device) |
| Identity persistence | Permanent account | Single event only |
| Username uniqueness | Must be unique | Duplicates allowed (numbered) |
| Avatar selection | During registration | During event join |
| Presenter selection | Pre-assigned segments | Dynamic (current picks next) |
| Segment transition | Manual | Automatic after quiz + selection |
| End-of-event | Just ends | Mega quiz + export |
