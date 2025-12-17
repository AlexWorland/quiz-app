# Architecture Overview

This document provides high-level architectural diagrams for the Quiz App.

## System Overview

```mermaid
graph TB
    subgraph Clients
        Browser[Web Browser]
        Mobile[Mobile Browser]
    end

    subgraph Frontend["Frontend (React)"]
        UI[React UI]
        Store[Zustand Store]
        API[API Client]
        WS[WebSocket Client]
    end

    subgraph Backend["Backend (Rust/Axum)"]
        Router[HTTP Router]
        WSHub[WebSocket Hub]
        Auth[Auth Middleware]
        Services[Services Layer]
    end

    subgraph External["External Services"]
        AI[AI Providers]
        STT[STT Providers]
    end

    subgraph Storage
        PG[(PostgreSQL)]
        S3[(MinIO/S3)]
    end

    Browser --> UI
    Mobile --> UI
    UI --> Store
    Store --> API
    Store --> WS
    API --> Router
    WS --> WSHub
    Router --> Auth
    Auth --> Services
    Services --> PG
    Services --> S3
    Services --> AI
    Services --> STT
    WSHub --> Services
```

## Component Architecture

```mermaid
graph LR
    subgraph Frontend
        Pages[Pages]
        Components[Components]
        AuthStore[Auth Store]
        APIClient[API Client]
    end

    subgraph Backend
        subgraph Routes
            AuthRoutes[/auth]
            QuizRoutes[/quiz]
            EventRoutes[/events]
            SettingsRoutes[/settings]
        end

        subgraph Services
            AIService[AI Service]
            ScoringService[Scoring]
            TranscriptionService[Transcription]
            EncryptionService[Encryption]
        end

        subgraph WebSocket
            Hub[Hub]
            Handler[Handler]
            Messages[Messages]
        end

        subgraph Data
            Models[Models]
            Migrations[Migrations]
        end
    end

    Pages --> Components
    Components --> AuthStore
    Components --> APIClient
    APIClient --> AuthRoutes
    APIClient --> QuizRoutes
    APIClient --> EventRoutes
    APIClient --> SettingsRoutes
    Routes --> Services
    Hub --> Handler
    Handler --> Messages
    Services --> Models
```

## Data Flow

```mermaid
flowchart TD
    subgraph User Actions
        Join[Join Quiz]
        Answer[Submit Answer]
        Host[Host Event]
    end

    subgraph Frontend
        React[React Components]
        State[Zustand State]
    end

    subgraph Backend
        API[REST API]
        WS[WebSocket]
        Logic[Business Logic]
    end

    subgraph Persistence
        DB[(PostgreSQL)]
        Files[(MinIO)]
    end

    Join --> React
    Answer --> React
    Host --> React
    React --> State
    State -->|HTTP| API
    State -->|Real-time| WS
    API --> Logic
    WS --> Logic
    Logic --> DB
    Logic --> Files
    DB -->|Query Results| Logic
    Logic -->|Response| API
    Logic -->|Broadcast| WS
    WS -->|Updates| State
    API -->|Response| State
```

## WebSocket Communication

```mermaid
sequenceDiagram
    participant P as Participant
    participant H as Host
    participant WS as WebSocket Hub
    participant BE as Backend Services
    participant DB as Database

    H->>WS: Connect to event
    WS->>BE: Register host session
    P->>WS: Join event (code)
    WS->>BE: Validate & add participant
    BE->>DB: Store participant
    WS-->>H: Participant joined
    WS-->>P: Connection confirmed

    H->>WS: Start question
    WS->>BE: Activate question
    BE->>DB: Update state
    WS-->>P: Question broadcast
    WS-->>H: Question active

    P->>WS: Submit answer
    WS->>BE: Score answer
    BE->>DB: Store response
    WS-->>P: Answer result
    WS-->>H: Leaderboard update
```

## Quiz Session Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: Host creates event
    Created --> Lobby: Event opened
    Lobby --> Active: First question starts
    Active --> QuestionActive: Question displayed
    QuestionActive --> QuestionClosed: Timer expires
    QuestionClosed --> ShowResults: Display answers
    ShowResults --> QuestionActive: Next question
    ShowResults --> Completed: No more questions
    Completed --> [*]: Event ends

    Lobby --> Lobby: Participants join
    QuestionActive --> QuestionActive: Answers submitted
```

## AI Question Generation Flow

```mermaid
flowchart LR
    subgraph Input
        Audio[Live Audio]
        Text[Manual Text]
        Transcript[Transcript]
    end

    subgraph Processing
        STT[Speech-to-Text]
        AI[AI Provider]
    end

    subgraph Output
        Questions[Generated Questions]
        Answers[Fake Answers]
    end

    Audio --> STT
    STT --> Transcript
    Transcript --> AI
    Text --> AI
    AI --> Questions
    AI --> Answers
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Frontend
    participant BE as Backend
    participant DB as Database

    U->>FE: Enter credentials
    FE->>BE: POST /auth/login
    BE->>DB: Verify user
    DB-->>BE: User data
    BE->>BE: Generate JWT
    BE-->>FE: JWT token
    FE->>FE: Store in Zustand
    FE-->>U: Redirect to dashboard

    Note over FE,BE: Subsequent requests
    FE->>BE: Request + Authorization header
    BE->>BE: Validate JWT
    BE-->>FE: Protected resource
```

## Database Schema (Simplified)

```mermaid
erDiagram
    USER ||--o{ EVENT : hosts
    USER ||--o{ PARTICIPANT : joins_as
    EVENT ||--|{ SEGMENT : contains
    SEGMENT ||--|{ QUESTION : has
    QUESTION ||--|{ ANSWER : has
    PARTICIPANT ||--o{ RESPONSE : submits
    RESPONSE }o--|| QUESTION : answers

    USER {
        uuid id PK
        string email
        string password_hash
        string display_name
        string avatar_url
    }

    EVENT {
        uuid id PK
        uuid host_id FK
        string code
        string title
        string status
    }

    SEGMENT {
        uuid id PK
        uuid event_id FK
        string title
        int order_index
    }

    QUESTION {
        uuid id PK
        uuid segment_id FK
        string text
        int time_limit
        int points
    }

    ANSWER {
        uuid id PK
        uuid question_id FK
        string text
        boolean is_correct
    }

    PARTICIPANT {
        uuid id PK
        uuid user_id FK
        uuid event_id FK
        int score
    }

    RESPONSE {
        uuid id PK
        uuid participant_id FK
        uuid question_id FK
        uuid answer_id FK
        int response_time_ms
    }
```

## Deployment Architecture

```mermaid
graph TB
    subgraph Docker Compose
        subgraph Services
            FE[Frontend :5173]
            BE[Backend :8080]
        end

        subgraph Data Layer
            PG[PostgreSQL :5432]
            MINIO[MinIO :9000/:9001]
        end

        subgraph Optional
            OLLAMA[Ollama :11434]
        end
    end

    subgraph External APIs
        CLAUDE[Claude API]
        OPENAI[OpenAI API]
        DG[Deepgram API]
        AAI[AssemblyAI API]
    end

    FE --> BE
    BE --> PG
    BE --> MINIO
    BE -.-> OLLAMA
    BE -.-> CLAUDE
    BE -.-> OPENAI
    BE -.-> DG
    BE -.-> AAI
```
