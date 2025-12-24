# Quiz App - Real-Time Multiplayer Quiz Platform

A real-time multiplayer quiz application for multi-presenter events with live audio transcription and AI-powered question generation.

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend Architecture](#backend-architecture)
- [WebSocket System](#websocket-system)
- [Database Schema](#database-schema)
- [Authentication Flow](#authentication-flow)
- [Quiz Lifecycle](#quiz-lifecycle)
- [Getting Started](#getting-started)
- [Testing](#testing)
- [API Reference](#api-reference)

---

## Overview

### Key Features

| Feature | Description | Key Files |
|---------|-------------|-----------|
| Multi-Presenter Events | Multiple presenters per event, each with own segment | `backend-python/app/models/segment.py` |
| Real-Time Quiz | WebSocket-powered live quiz with instant scoring | `backend-python/app/ws/game_handler.py` |
| AI Question Generation | Generate questions from audio transcription | `backend-python/app/services/ai.py` |
| Device Tracking | Prevent joining multiple active events | `backend-python/app/routes/join.py` |
| Resume Capability | Recover from accidental segment endings | `frontend/src/components/quiz/ResumeControls.tsx` |
| Join Locking | Control participant entry timing | `backend-python/app/routes/events.py` |
| Reconnection Handling | Graceful WebSocket reconnection | `frontend/src/hooks/useReconnection.ts` |

### Quiz Modes

```mermaid
graph LR
    subgraph "Normal Mode"
        A1[Host writes questions] --> A2[AI generates fake answers]
        A2 --> A3[Quiz runs with mixed answers]
    end

    subgraph "Listen Only Mode"
        B1[Presenter speaks] --> B2[Audio transcribed]
        B2 --> B3[AI generates questions]
        B3 --> B4[AI generates all answers]
    end
```

---

## Architecture

### System Overview

```mermaid
graph TB
    subgraph "Client Layer"
        Browser[Browser]
        Mobile[Mobile Browser]
    end

    subgraph "Frontend - React/TypeScript"
        direction TB
        Pages[Pages<br/><code>frontend/src/pages/</code>]
        Components[Components<br/><code>frontend/src/components/</code>]
        Hooks[Custom Hooks<br/><code>frontend/src/hooks/</code>]
        Store[Zustand Store<br/><code>frontend/src/store/</code>]
        API[API Client<br/><code>frontend/src/api/</code>]
    end

    subgraph "Backend - Python/FastAPI"
        direction TB
        Routes[REST Routes<br/><code>backend-python/app/routes/</code>]
        WS[WebSocket Hub<br/><code>backend-python/app/ws/</code>]
        Services[Services<br/><code>backend-python/app/services/</code>]
        Models[SQLAlchemy Models<br/><code>backend-python/app/models/</code>]
    end

    subgraph "Data Layer"
        PG[(PostgreSQL)]
        MinIO[(MinIO S3)]
    end

    subgraph "External APIs"
        Claude[Claude AI]
        OpenAI[OpenAI]
        Deepgram[Deepgram STT]
    end

    Browser --> Pages
    Mobile --> Pages
    Pages --> Components
    Pages --> Hooks
    Components --> Store
    Hooks --> API
    Hooks --> WS

    API --> Routes
    Routes --> Services
    Services --> Models
    Models --> PG
    Services --> MinIO
    Services --> Claude
    Services --> OpenAI
    Services --> Deepgram
```

### Request/Response Flow

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as API Routes
    participant S as Services
    participant DB as PostgreSQL
    participant WS as WebSocket Hub

    Note over U,WS: HTTP Request Flow
    U->>F: User Action
    F->>A: HTTP Request
    A->>S: Business Logic
    S->>DB: Query/Mutation
    DB-->>S: Result
    S-->>A: Response Data
    A-->>F: JSON Response
    F-->>U: UI Update

    Note over U,WS: WebSocket Flow
    U->>F: Quiz Action
    F->>WS: WS Message
    WS->>S: Process Action
    S->>DB: Update State
    WS-->>F: Broadcast to Room
    F-->>U: Real-time Update
```

---

## Frontend Architecture

### Directory Structure

```
frontend/src/
├── api/
│   ├── client.ts          # Axios instance with interceptors
│   └── endpoints.ts       # Type-safe API definitions
├── components/
│   ├── auth/              # AvatarSelector, login forms
│   ├── canvas/            # Drawing canvas for presentations
│   ├── common/            # Button, Input, Tooltip, StatusToast
│   ├── display/           # FinalResults, ProcessingScreen
│   ├── event/             # QRCodeDisplay, WebRTCNotice
│   ├── leaderboard/       # MasterLeaderboard, SegmentLeaderboard
│   ├── questions/         # QuestionList, GeneratedQuestionList
│   ├── quiz/              # QuestionDisplay, AnswerSelection, ResumeControls
│   └── recording/         # RecordingControls, TranscriptView
├── hooks/
│   ├── useEventWebSocket.ts    # Main quiz WebSocket
│   ├── useAudioWebSocket.ts    # Audio streaming for transcription
│   ├── useReconnection.ts      # Reconnection state management
│   └── useOnlineStatus.ts      # Network detection
├── pages/
│   ├── Home.tsx           # Dashboard
│   ├── Events.tsx         # Event list
│   ├── EventHost.tsx      # Presenter/host view
│   ├── EventParticipant.tsx   # Player view
│   ├── JoinEvent.tsx      # QR/code entry
│   └── Login.tsx          # Authentication
└── store/
    └── authStore.ts       # Zustand auth state
```

### Component Hierarchy

```mermaid
graph TB
    subgraph "App.tsx"
        Router[React Router]
    end

    subgraph "Pages"
        Home[Home.tsx]
        Events[Events.tsx]
        EventHost[EventHost.tsx]
        EventParticipant[EventParticipant.tsx]
        JoinEvent[JoinEvent.tsx]
    end

    subgraph "EventHost Components"
        PresenterControls[PresenterControls.tsx]
        QuizControls[Quiz Controls]
        RecordingControls[RecordingControls.tsx]
        QuestionManagement[Question Management]
        Leaderboards[Leaderboards]
    end

    subgraph "EventParticipant Components"
        QuestionDisplay[QuestionDisplay.tsx]
        AnswerSelection[AnswerSelection.tsx]
        QuizResults[QuizResults.tsx]
        ReconnectionStatus[ReconnectionStatus.tsx]
    end

    subgraph "Shared Hooks"
        useEventWS[useEventWebSocket]
        useReconn[useReconnection]
    end

    Router --> Home
    Router --> Events
    Router --> EventHost
    Router --> EventParticipant
    Router --> JoinEvent

    EventHost --> PresenterControls
    EventHost --> QuizControls
    EventHost --> RecordingControls
    EventHost --> QuestionManagement
    EventHost --> Leaderboards
    EventHost --> useEventWS

    EventParticipant --> QuestionDisplay
    EventParticipant --> AnswerSelection
    EventParticipant --> QuizResults
    EventParticipant --> ReconnectionStatus
    EventParticipant --> useEventWS
    EventParticipant --> useReconn
```

### State Management

```mermaid
graph LR
    subgraph "Zustand Store (authStore.ts)"
        AuthState[Auth State]
        User[user: User | null]
        Token[token: string | null]
        DeviceId[deviceId: string]
        SessionToken[sessionToken: string]
    end

    subgraph "WebSocket State (useEventWebSocket)"
        Connected[isConnected]
        Participants[participants[]]
        Questions[questions[]]
        CurrentQ[currentQuestion]
        Phase[quizPhase]
        Scores[leaderboard[]]
    end

    subgraph "Local Component State"
        SelectedAnswer[selectedAnswer]
        TimeRemaining[timeRemaining]
        ShowResults[showResults]
    end

    AuthState --> User
    AuthState --> Token
    AuthState --> DeviceId
    AuthState --> SessionToken
```

### Key Frontend Files

| File | Purpose | Lines |
|------|---------|-------|
| `src/hooks/useEventWebSocket.ts` | Main quiz WebSocket connection, message handling | ~400 |
| `src/hooks/useReconnection.ts` | Reconnection logic with exponential backoff | ~150 |
| `src/pages/EventHost.tsx` | Presenter view with all controls | ~600 |
| `src/pages/EventParticipant.tsx` | Player view for answering | ~300 |
| `src/store/authStore.ts` | Zustand auth with persist middleware | ~100 |
| `src/components/quiz/ResumeControls.tsx` | Resume from accidental end | ~80 |

---

## Backend Architecture

### Directory Structure

```
backend-python/
├── app/
│   ├── main.py              # FastAPI app initialization
│   ├── config.py            # Environment configuration
│   ├── database.py          # SQLAlchemy async engine
│   ├── auth/
│   │   ├── jwt.py           # JWT token creation/validation
│   │   └── dependencies.py  # Auth dependency injection
│   ├── models/
│   │   ├── user.py          # User SQLAlchemy model
│   │   ├── event.py         # Event model with join_code
│   │   ├── segment.py       # Segment model with presenter
│   │   ├── question.py      # Question model
│   │   ├── participant.py   # EventParticipant model
│   │   └── join_attempt.py  # Device tracking model
│   ├── routes/
│   │   ├── auth.py          # /api/auth/* endpoints
│   │   ├── events.py        # /api/events/* endpoints
│   │   ├── quizzes.py       # /api/quizzes/* endpoints
│   │   ├── segments.py      # /api/segments/* endpoints
│   │   ├── join.py          # /api/events/join endpoint
│   │   └── health.py        # /api/health endpoint
│   ├── services/
│   │   ├── ai.py            # AI provider abstraction
│   │   ├── scoring.py       # Score calculation
│   │   └── transcription.py # Speech-to-text service
│   └── ws/
│       ├── hub.py           # WebSocket connection manager
│       ├── game_handler.py  # Quiz message handlers
│       ├── messages.py      # Message type definitions
│       └── heartbeat.py     # Connection heartbeat
├── migrations/              # Alembic migrations
└── tests/                   # Pytest test files
```

### Backend Module Relationships

```mermaid
graph TB
    subgraph "Entry Point"
        Main[main.py]
    end

    subgraph "Routes Layer"
        AuthRoutes[routes/auth.py]
        EventRoutes[routes/events.py]
        JoinRoutes[routes/join.py]
        SegmentRoutes[routes/segments.py]
    end

    subgraph "WebSocket Layer"
        Hub[ws/hub.py]
        GameHandler[ws/game_handler.py]
        Messages[ws/messages.py]
        Heartbeat[ws/heartbeat.py]
    end

    subgraph "Service Layer"
        AI[services/ai.py]
        Scoring[services/scoring.py]
        Transcription[services/transcription.py]
    end

    subgraph "Data Layer"
        Models[models/*.py]
        Database[database.py]
    end

    subgraph "Auth Layer"
        JWT[auth/jwt.py]
        Dependencies[auth/dependencies.py]
    end

    Main --> AuthRoutes
    Main --> EventRoutes
    Main --> JoinRoutes
    Main --> SegmentRoutes
    Main --> Hub

    AuthRoutes --> JWT
    EventRoutes --> Dependencies
    JoinRoutes --> Models
    SegmentRoutes --> Models

    Hub --> GameHandler
    GameHandler --> Messages
    GameHandler --> Scoring
    Hub --> Heartbeat

    GameHandler --> Models
    Scoring --> Models
    AI --> Models

    Models --> Database
```

### Key Backend Files

| File | Purpose | Key Functions |
|------|---------|---------------|
| `app/main.py` | FastAPI app setup, CORS, routes | `create_app()`, lifespan events |
| `app/ws/hub.py` | WebSocket room management | `Hub.connect()`, `Hub.broadcast()` |
| `app/ws/game_handler.py` | Quiz message processing | `handle_start_game()`, `handle_answer()` |
| `app/routes/join.py` | Join flow with device tracking | `join_event()`, device conflict check |
| `app/services/scoring.py` | Score calculation | `apply_score()`, `build_leaderboard()` |
| `app/services/ai.py` | AI provider abstraction | `generate_questions()`, `generate_fake_answers()` |

### Join Flow Implementation

```mermaid
sequenceDiagram
    participant C as Client
    participant J as join.py
    participant DB as Database
    participant H as Hub

    C->>J: POST /api/events/join
    Note over C,J: {code, display_name, device_fingerprint}

    J->>DB: Get event by join_code
    alt Event not found
        J-->>C: 404 Not Found
    end

    J->>DB: Check join_locked flag
    alt Join locked
        J-->>C: 403 Forbidden
    end

    J->>DB: Query device in other active events
    Note over J,DB: SELECT FROM event_participants<br/>WHERE device_id = ? AND event_id != ?<br/>AND event.status IN ('waiting', 'active')

    alt Device in another event
        J-->>C: 409 Conflict
        Note over C: "Device already in another active event"
    end

    J->>DB: Check existing participant (rejoin)
    alt Rejoining same event
        J->>DB: Update last_heartbeat
        J-->>C: 200 OK {isRejoining: true}
    else New participant
        J->>DB: Generate unique display_name
        J->>DB: Create JoinAttempt record
        J->>DB: Create EventParticipant
        J->>H: Broadcast participant_joined
        J-->>C: 200 OK {sessionToken, isRejoining: false}
    end
```

### Scoring System

Located in `backend-python/app/services/scoring.py`:

```mermaid
graph TB
    subgraph "Score Calculation"
        Answer[Answer Received]
        Check[Check Correctness]
        Time[Calculate Time Bonus]
        Apply[Apply to Participant]
    end

    subgraph "Leaderboard"
        Fetch[Fetch All Participants]
        Sort[Sort by Score, then Time]
        Rank[Assign Ranks]
        Broadcast[Broadcast to Room]
    end

    Answer --> Check
    Check -->|Correct| Time
    Check -->|Wrong| Apply
    Time --> Apply
    Apply --> Fetch
    Fetch --> Sort
    Sort --> Rank
    Rank --> Broadcast
```

**Scoring Formula:**
```
base_score = 1000 (if correct)
time_bonus = max(0, (time_limit - response_time) * 10)
total_score = base_score + time_bonus
```

---

## WebSocket System

### Connection Management

Located in `backend-python/app/ws/hub.py`:

```mermaid
graph TB
    subgraph "Hub (Singleton)"
        Rooms[rooms: Dict[event_id, Set[WebSocket]]]
        GameStates[game_states: Dict[event_id, GameState]]
    end

    subgraph "Connection Lifecycle"
        Connect[connect]
        Disconnect[disconnect]
        Broadcast[broadcast]
        SendTo[send_to_participant]
    end

    subgraph "Per-Connection"
        WS1[WebSocket 1]
        WS2[WebSocket 2]
        WS3[WebSocket 3]
    end

    Connect --> Rooms
    Disconnect --> Rooms
    Broadcast --> Rooms
    Rooms --> WS1
    Rooms --> WS2
    Rooms --> WS3
```

### Message Flow

Located in `backend-python/app/ws/game_handler.py`:

```mermaid
sequenceDiagram
    participant P as Participant
    participant WS as WebSocket
    participant H as Hub
    participant GH as GameHandler
    participant DB as Database

    P->>WS: Connect with session_token
    WS->>H: hub.connect(event_id, websocket)
    H->>H: Add to room
    H-->>P: {"type": "connected", "participants": [...]}

    P->>WS: {"type": "answer", "questionId": "...", "answer": "..."}
    WS->>GH: handle_answer(message, participant)
    GH->>DB: Check answer timeout
    GH->>DB: Record answer
    GH->>GH: Calculate score
    GH->>H: broadcast(event_id, answer_received)
    H-->>P: {"type": "answer_received"}
```

### Message Types

Defined in `backend-python/app/ws/messages.py`:

```mermaid
classDiagram
    class BaseMessage {
        +type: str
    }

    class JoinMessage {
        +type: "join"
        +sessionToken: str
    }

    class AnswerMessage {
        +type: "answer"
        +questionId: str
        +answer: str
    }

    class StartGameMessage {
        +type: "start_game"
        +segmentId: str
    }

    class QuestionMessage {
        +type: "question"
        +questionId: str
        +questionText: str
        +answers: List[str]
        +timeLimit: int
    }

    class LeaderboardMessage {
        +type: "leaderboard"
        +entries: List[LeaderboardEntry]
    }

    BaseMessage <|-- JoinMessage
    BaseMessage <|-- AnswerMessage
    BaseMessage <|-- StartGameMessage
    BaseMessage <|-- QuestionMessage
    BaseMessage <|-- LeaderboardMessage
```

### Heartbeat System

Located in `backend-python/app/ws/heartbeat.py`:

```mermaid
sequenceDiagram
    participant C as Client
    participant S as Server
    participant DB as Database

    loop Every 30 seconds
        S->>C: {"type": "ping"}
        C->>S: {"type": "pong"}
        S->>DB: Update last_heartbeat
    end

    Note over S: If no pong in 60s
    S->>S: Mark participant disconnected
    S->>S: Broadcast participant_left
```

---

## Database Schema

### Entity Relationship Diagram

```mermaid
erDiagram
    USERS ||--o{ EVENTS : hosts
    USERS ||--o{ SEGMENTS : presents
    EVENTS ||--o{ SEGMENTS : contains
    EVENTS ||--o{ EVENT_PARTICIPANTS : has
    EVENTS ||--o{ JOIN_ATTEMPTS : tracks
    SEGMENTS ||--o{ QUESTIONS : contains
    SEGMENTS ||--o{ SEGMENT_SCORES : records
    EVENT_PARTICIPANTS ||--o{ PARTICIPANT_ANSWERS : submits
    EVENT_PARTICIPANTS ||--o{ SEGMENT_SCORES : earns

    USERS {
        uuid id PK
        string username UK
        string display_name
        string password_hash
        string role
        string avatar_url
        string avatar_type
        timestamp created_at
        timestamp updated_at
    }

    EVENTS {
        uuid id PK
        uuid host_id FK
        string title
        string description
        string join_code UK
        string mode
        string status
        int num_fake_answers
        int time_per_question
        boolean join_locked
        timestamp join_locked_at
        string previous_status
        timestamp ended_at
        timestamp created_at
    }

    SEGMENTS {
        uuid id PK
        uuid event_id FK
        uuid presenter_user_id FK
        string presenter_name
        string title
        int order_index
        string status
        timestamp recording_started_at
        timestamp recording_ended_at
        timestamp quiz_started_at
        string previous_status
        timestamp ended_at
        timestamp created_at
    }

    EVENT_PARTICIPANTS {
        uuid id PK
        uuid event_id FK
        uuid user_id FK
        string display_name
        string avatar_url
        string avatar_type
        int total_score
        bigint total_response_time_ms
        uuid device_id
        string session_token UK
        boolean is_late_joiner
        timestamp join_timestamp
        timestamp last_heartbeat
        timestamp join_started_at
        string join_status
        timestamp joined_at
    }

    QUESTIONS {
        uuid id PK
        uuid segment_id FK
        string question_text
        string correct_answer
        json fake_answers
        int order_index
        string source
        timestamp created_at
    }

    JOIN_ATTEMPTS {
        uuid id PK
        uuid event_id FK
        uuid device_id
        timestamp started_at
        timestamp completed_at
        string status
        timestamp created_at
    }

    PARTICIPANT_ANSWERS {
        uuid id PK
        uuid participant_id FK
        uuid question_id FK
        string answer
        boolean is_correct
        int score
        int response_time_ms
        timestamp answered_at
    }

    SEGMENT_SCORES {
        uuid id PK
        uuid participant_id FK
        uuid segment_id FK
        int score
        int response_time_ms
        timestamp created_at
    }
```

### Status Enums

```mermaid
graph LR
    subgraph "Event Status"
        E1[waiting] --> E2[active]
        E2 --> E3[completed]
        E2 --> E4[cancelled]
    end

    subgraph "Segment Status"
        S1[pending] --> S2[recording]
        S2 --> S3[processing]
        S3 --> S4[quiz_ready]
        S4 --> S5[quizzing]
        S5 --> S6[completed]
    end

    subgraph "Join Status"
        J1[in_progress] --> J2[completed]
        J1 --> J3[failed]
    end
```

### Key Migrations

| Migration | Purpose | File |
|-----------|---------|------|
| `20241216000001_init.sql` | Initial schema | Base tables |
| `20251217195932_add_segment_presenter_user_id` | Link presenter to user | Segment-User FK |
| `20251219072001_qr_lock_state.sql` | Join locking | `join_locked` column |
| `20251219072552_device_session_identity.sql` | Device tracking | `device_id` column |
| `20251219072626_join_state_tracking.sql` | Join flow tracking | `join_attempts` table |
| `20251219072731_resume_state_tracking.sql` | Resume capability | `previous_status` column |

---

## Authentication Flow

### JWT Authentication

Located in `backend-python/app/auth/jwt.py`:

```mermaid
sequenceDiagram
    participant U as User
    participant F as Frontend
    participant A as Auth Route
    participant JWT as JWT Service
    participant DB as Database

    Note over U,DB: Registration
    U->>F: Submit registration form
    F->>A: POST /api/auth/register
    A->>DB: Check username unique
    A->>A: Hash password (argon2)
    A->>DB: Insert user
    A-->>F: 201 Created

    Note over U,DB: Login
    U->>F: Submit login form
    F->>A: POST /api/auth/login
    A->>DB: Find user by username
    A->>A: Verify password hash
    A->>JWT: Create token (user_id, exp)
    JWT-->>A: JWT string
    A-->>F: {token, user}

    Note over U,DB: Protected Request
    F->>A: GET /api/quizzes (Authorization: Bearer token)
    A->>JWT: Validate token
    JWT->>JWT: Check signature & expiry
    JWT-->>A: user_id
    A->>DB: Query user's events
    A-->>F: Event list
```

### Session Token (Participants)

```mermaid
sequenceDiagram
    participant P as Participant
    participant J as Join Route
    participant DB as Database
    participant WS as WebSocket

    P->>J: POST /api/events/join
    J->>J: Generate session_token (32 bytes)
    J->>DB: Store in event_participants
    J-->>P: {sessionToken, eventId}

    P->>WS: Connect with session_token
    WS->>DB: Validate session_token
    DB-->>WS: Participant record
    WS-->>P: Connected to event room
```

---

## Quiz Lifecycle

### Complete Quiz State Machine

```mermaid
stateDiagram-v2
    [*] --> EventCreated

    state "Event Level" as EventLevel {
        EventCreated --> EventWaiting: Host opens event
        EventWaiting --> EventActive: First segment starts
        EventActive --> EventComplete: All segments done
        EventActive --> EventActive: Switch segments
    }

    state "Segment Level" as SegmentLevel {
        SegmentPending --> Recording: Start recording
        Recording --> Processing: Stop recording
        Processing --> QuizReady: Questions generated
        QuizReady --> Quizzing: Start quiz
        Quizzing --> SegmentComplete: End segment
        SegmentComplete --> QuizReady: Resume (if previous_status set)
    }

    state "Question Level" as QuestionLevel {
        NotStarted --> ShowingQuestion: start_game / next_question
        ShowingQuestion --> RevealingAnswer: reveal / timeout
        RevealingAnswer --> ShowingLeaderboard: show_leaderboard
        ShowingLeaderboard --> ShowingQuestion: next_question
        ShowingLeaderboard --> SegmentComplete: end_segment
    }

    EventLevel --> SegmentLevel
    SegmentLevel --> QuestionLevel
```

### Quiz Round Flow

```mermaid
sequenceDiagram
    participant H as Host
    participant S as Server
    participant P as Participants

    H->>S: start_game
    S->>S: Set phase = showing_question
    S->>S: Start timer
    S-->>P: question {text, answers, timeLimit}
    S-->>H: question {text, answers, timeLimit}

    loop Until timeout or all answered
        P->>S: answer {questionId, answer}
        S->>S: Calculate score
        S-->>P: answer_received {correct, score}
        S-->>H: participant_answered {name, answered: true}
    end

    alt All answered early
        S->>S: Skip remaining time
    else Timeout
        S->>S: Mark unanswered as wrong
    end

    H->>S: reveal_answer
    S-->>P: reveal {correctAnswer, scores}
    S-->>H: reveal {correctAnswer, scores}

    H->>S: show_leaderboard
    S-->>P: leaderboard {entries}
    S-->>H: leaderboard {entries}

    alt More questions
        H->>S: next_question
        Note over S: Repeat flow
    else Last question
        H->>S: end_segment
        S-->>P: segment_complete {leaderboard}
    end
```

### Resume Flow

Located in `frontend/src/components/quiz/ResumeControls.tsx`:

```mermaid
sequenceDiagram
    participant H as Host
    participant F as Frontend
    participant A as API
    participant DB as Database

    Note over H,DB: Accidental End (presenter disconnects, etc.)
    A->>DB: Set segment.status = 'completed'
    A->>DB: Set segment.previous_status = 'quizzing'

    Note over H,DB: Host Returns
    H->>F: Load segment host page
    F->>A: GET /api/segments/{id}
    A-->>F: {status: 'completed', previous_status: 'quizzing'}

    F->>F: Show ResumeControls component
    Note over F: "Segment Ended Accidentally?"

    alt Resume Quiz
        H->>F: Click "Resume"
        F->>A: POST /api/segments/{id}/resume
        A->>DB: Set status = previous_status
        A->>DB: Clear previous_status
        A-->>F: Updated segment
        F->>F: Continue quiz from last state
    else Clear & Continue
        H->>F: Click "Clear & Continue"
        F->>A: POST /api/segments/{id}/clear-resume
        A->>DB: Clear previous_status only
        A-->>F: Updated segment
        F->>F: Show completed state
    end
```

---

## Getting Started

### Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Python | 3.11+ | Backend runtime |
| Node.js | 18+ | Frontend tooling |
| PostgreSQL | 15+ | Database |
| MinIO | Latest | Avatar storage (optional) |

### Local Development (Recommended)

```bash
# 1. Clone repository
git clone <repo-url>
cd quiz-app

# 2. Start PostgreSQL
brew services start postgresql@15

# 3. Start all services
./scripts/start-local-dev.sh

# Access points:
# Frontend: http://localhost:5173
# Backend:  http://localhost:8080
# API Docs: http://localhost:8080/docs
```

### Manual Setup

```bash
# Backend
cd backend-python
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
export DATABASE_URL="postgresql+asyncpg://quiz:quiz@localhost:5432/quiz"
alembic upgrade head
uvicorn app.main:app --reload --port 8080

# Frontend (new terminal)
cd frontend
npm install
VITE_API_URL=http://localhost:8080 npm run dev
```

### Docker Setup

```bash
# All services
docker-compose up -d

# With local LLM (Ollama)
docker-compose --profile local-llm up -d

# View logs
docker-compose logs -f backend
```

### Service Startup Flow

```mermaid
graph TB
    subgraph "start-local-dev.sh"
        CheckPG[Check PostgreSQL] --> EnsureDB[Ensure Database]
        EnsureDB --> SetupVenv[Setup Python venv]
        SetupVenv --> Migrate[Run Migrations]
        Migrate --> StartBackend[Start Backend]
        StartBackend --> WaitBackend[Wait for Health]
        WaitBackend --> StartFrontend[Start Frontend]
        StartFrontend --> WaitFrontend[Wait for Health]
        WaitFrontend --> Ready[Application Ready]
    end
```

---

## Testing

### Test Suite Overview

| Suite | Framework | Tests | Directory |
|-------|-----------|-------|-----------|
| Backend | pytest | 94 | `backend-python/tests/` |
| Frontend Unit | vitest | 756 | `frontend/src/**/__tests__/` |
| E2E | playwright | 49 | `frontend/e2e2/tests/` |
| **Total** | | **899** | |

### Running Tests

```bash
# All tests (auto-starts services)
./scripts/run-all-tests-local.sh

# All tests (services already running)
./scripts/run-all-tests-local.sh --no-setup

# Individual suites
./scripts/run-backend-tests-local.sh
./scripts/run-frontend-tests-local.sh
./scripts/run-e2e-tests-local.sh

# With options
./scripts/run-backend-tests-local.sh --coverage
./scripts/run-e2e-tests-local.sh --headed
./scripts/run-e2e-tests-local.sh --ui
```

### Test Architecture

```mermaid
graph TB
    subgraph "Backend Tests (pytest)"
        AuthTests[test_auth.py]
        EventTests[test_events.py]
        JoinTests[test_join.py]
        ScoringTests[test_scoring.py]
        ResumeTests[test_resume_functionality.py]
        WSTests[test_ws_host_controls.py]
    end

    subgraph "Frontend Unit Tests (vitest)"
        StoreTests[authStore.test.ts]
        HookTests[useReconnection.test.ts]
        ComponentTests[*.test.tsx]
        APITests[endpoints.test.ts]
    end

    subgraph "E2E Tests (playwright)"
        AuthE2E[auth.e2e2.spec.ts]
        UserStories[user-stories.e2e2.spec.ts]
        CompleteFeatures[complete-features.e2e2.spec.ts]
        UIPolish[ui-polish.e2e2.spec.ts]
    end

    AuthTests --> EventTests
    EventTests --> JoinTests
    StoreTests --> HookTests
    HookTests --> ComponentTests
    ComponentTests --> AuthE2E
    AuthE2E --> UserStories
```

### Key Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `backend-python/tests/test_join.py` | Device tracking, rejoin, locking | Join flow |
| `backend-python/tests/test_resume_functionality.py` | Resume/clear state | Recovery |
| `backend-python/tests/test_scoring.py` | Score calculation, leaderboard | Scoring |
| `frontend/src/hooks/__tests__/useReconnection.test.ts` | Reconnection logic | Network |
| `frontend/e2e2/tests/user-stories.e2e2.spec.ts` | Full user journeys | Integration |
| `frontend/e2e2/tests/complete-features.e2e2.spec.ts` | Feature coverage | Features |

---

## API Reference

### Authentication Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/auth/register` | POST | None | Register new user |
| `/api/auth/login` | POST | None | Login, returns JWT |
| `/api/auth/me` | GET | JWT | Get current user |
| `/api/auth/me` | PATCH | JWT | Update profile |

### Event Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/quizzes` | GET | JWT | List user's events |
| `/api/quizzes` | POST | JWT | Create event |
| `/api/quizzes/{id}` | GET | JWT | Get event details |
| `/api/quizzes/{id}` | PATCH | JWT | Update event |
| `/api/quizzes/{id}` | DELETE | JWT | Delete event |
| `/api/events/{id}/join/lock` | POST | JWT | Lock joining |
| `/api/events/{id}/join/unlock` | POST | JWT | Unlock joining |
| `/api/events/{id}/export` | GET | JWT | Export event data |

### Join Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/events/join` | POST | None | Join by code |
| `/api/events/join/{code}` | GET | None | Get event preview |

### Segment Endpoints

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/quizzes/{id}/questions` | POST | JWT | Create segment |
| `/api/segments/{id}` | GET | JWT | Get segment |
| `/api/segments/{id}` | PATCH | JWT | Update segment |
| `/api/segments/{id}/questions` | GET | JWT | List questions |
| `/api/segments/{id}/questions` | POST | JWT | Add question |
| `/api/segments/{id}/resume` | POST | JWT | Resume segment |
| `/api/segments/{id}/clear-resume` | POST | JWT | Clear resume state |

### WebSocket Endpoint

```
ws://localhost:8080/api/ws/event/{event_id}?token={session_token}
```

### Request/Response Examples

**Register:**
```json
POST /api/auth/register
{
  "username": "host1",
  "password": "SecurePass123!",
  "avatar_url": "😀",
  "avatar_type": "emoji"
}
```

**Join Event:**
```json
POST /api/events/join
{
  "code": "ABC123",
  "display_name": "Player1",
  "device_fingerprint": "uuid-v4",
  "avatar_url": "😎",
  "avatar_type": "emoji"
}

Response:
{
  "eventId": "uuid",
  "sessionToken": "base64-token",
  "displayName": "Player1",
  "isRejoining": false
}
```

---

## Environment Variables

### Backend (`backend-python/.env`)

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL async URL |
| `JWT_SECRET` | Prod | `dev-secret` | Token signing key |
| `JWT_EXPIRY_HOURS` | No | `24` | Token expiration |
| `CORS_ALLOWED_ORIGINS` | Prod | `*` | Allowed origins |
| `DEFAULT_AI_PROVIDER` | No | `claude` | AI service |
| `ANTHROPIC_API_KEY` | If claude | - | Claude API key |
| `OPENAI_API_KEY` | If openai | - | OpenAI API key |
| `DEEPGRAM_API_KEY` | If STT | - | Deepgram API key |
| `MINIO_ENDPOINT` | No | `localhost:9000` | S3 endpoint |
| `MINIO_ACCESS_KEY` | No | - | S3 access key |
| `MINIO_SECRET_KEY` | No | - | S3 secret key |

### Frontend (Vite env)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_API_URL` | `http://localhost:8080` | Backend URL |
| `VITE_WS_URL` | `ws://localhost:8080` | WebSocket URL |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| `Login failed: 401` | User not registered | Check registration succeeded |
| `409 Conflict on join` | Device in another event | End other event or use different device |
| `403 Forbidden on join` | Event locked | Unlock via host UI |
| `WebSocket disconnects` | Network/timeout | Check `useReconnection` hook |
| `Quiz stuck` | State machine issue | Check `previous_status` for resume |

### Debug Commands

```bash
# Check PostgreSQL
pg_isready -h localhost -p 5432

# Check backend health
curl http://localhost:8080/api/health

# Check frontend
curl http://localhost:5173

# View backend logs
docker-compose logs -f backend

# Database console
PGPASSWORD=quiz psql -h localhost -U quiz -d quiz
```

---

## License

MIT
