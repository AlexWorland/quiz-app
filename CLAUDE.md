# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A real-time multiplayer quiz application for multi-presenter events with live audio transcription and AI-powered question generation. The application supports two modes:

1. **Traditional Mode**: Pre-written questions with AI-generated fake answers
2. **Listen Only Mode**: AI generates questions entirely from live audio transcription

The architecture uses a **Rust backend (Axum)** with WebSocket support for real-time updates, a **React frontend** with Tailwind CSS, and **PostgreSQL** for persistence.

## Build & Development Commands

### Backend (Rust)

```bash
# Build the backend
cd backend && cargo build

# Run development server (requires Docker for dependencies)
docker-compose up -d postgres minio minio-init
cargo run

# Run tests
cargo test

# Run specific test
cargo test test_name

# Check code without building
cargo check

# Format code
cargo fmt

# Lint code
cargo clippy
```

### Frontend (React/TypeScript)

```bash
# Install dependencies
npm install

# Start development server (with HMR)
npm run dev

# Build for production
npm run build

# Type-check without building
npm run type-check

# Lint code
npm run lint

# Preview production build
npm run preview
```

### Docker & Services

```bash
# Start all services (database, MinIO, backend, frontend, Ollama)
docker-compose up -d

# Start with local LLM support (Ollama)
docker-compose --profile local-llm up -d

# View logs
docker-compose logs -f <service-name>

# Stop all services
docker-compose down

# Reset volumes (clean database)
docker-compose down -v
```

## Architecture Overview

### Backend Structure (Rust/Axum)

**Key modules** in `backend/src/`:
- **`main.rs`**: Application entry point, router setup, initialization of database, S3 client, WebSocket hub
- **`models/`**: Domain models (User, Event, Segment, Question, Session)
- **`routes/`**: HTTP endpoint handlers (auth, quiz, events, canvas, settings)
- **`services/`**: Business logic (AI integration, scoring, transcription, question generation, encryption)
- **`ws/`**: WebSocket layer
  - `hub.rs`: Central broker managing event sessions and game state
  - `handler.rs`: WebSocket connection handlers
  - `messages.rs`: Message type definitions
- **`auth/`**: JWT token handling and middleware
- **`error.rs`**: Custom error types and HTTP error responses

**AppState** (shared across all handlers):
- `db`: PostgreSQL connection pool (sqlx)
- `config`: Application configuration from environment
- `hub`: WebSocket hub for managing real-time connections
- `s3_client`: MinIO client for avatar storage

**WebSocket Flow**:
1. Clients connect to `/api/ws/event/:event_id` or `/api/ws/audio/:segment_id`
2. Hub maintains broadcast channels per event
3. Message handling routes through `ws/handler.rs`
4. Game state updates broadcast to all connected clients

### Frontend Structure (React/TypeScript)

**Key modules** in `frontend/src/`:
- **`App.tsx`**: Router configuration and protected routes
- **`store/authStore.ts`**: Zustand state management for authentication
- **`pages/`**: Page-level components
  - `Home.tsx`: User dashboard
  - `EventHost.tsx`: Presenter view (controls, question management, recording)
  - `EventParticipant.tsx`: Participant view (answering questions, watching canvas)
  - `Events.tsx`: Browse/manage events
  - `Login.tsx`, `Register.tsx`: Authentication pages
- **`components/`**: Reusable UI components
  - `common/`: Button, Input, shared utilities
  - `auth/`: AvatarSelector for signup
  - `canvas/`: DrawingCanvas with color/brush controls
  - `quiz/`: QuestionDisplay, AnswerSelection, QuizResults
  - `leaderboard/`: Real-time score tracking
  - `recording/`: Audio recording and transcription UI
  - `questions/`: Question generation and editing UI
- **`api/`**: HTTP client and endpoint definitions
  - `client.ts`: Axios instance with auth interceptors
  - `endpoints.ts`: Type-safe API endpoint definitions
- **`components/ProtectedRoute.tsx`**: Route guard wrapper requiring authentication

**Custom Hooks** in `frontend/src/hooks/`:
- `useEventWebSocket.ts`: Main game/event WebSocket connection (participants, questions, answers, leaderboard)
- `useAudioWebSocket.ts`: Audio streaming for transcription (recording segments)
- `useCanvasWebSocket.ts`: Real-time drawing canvas synchronization
- `useOnlineStatus.ts`: Network connectivity detection

**State Management**:
- `authStore`: Handles login/registration, JWT persistence, user profile
- WebSocket hooks manage real-time connections for events, canvas, and audio

### Data Model

**Core Entities**:
- **User**: Authentication, profile, avatar
- **Event**: Multi-presenter quiz event with code for joining
- **Segment**: Part of an event with specific questions and recording
- **Question**: Quiz questions with multiple choice answers
- **Session**: Legacy game session (backward compatibility)

**WebSocket Message Types**:

*Game Messages* (client → server):
- `join`, `answer`, `start_game`, `next_question`, `reveal_answer`, `show_leaderboard`, `end_game`, `pass_presenter`

*Server Messages* (server → client):
- Quiz flow: `game_started`, `question`, `time_update`, `answer_received`, `reveal`, `phase_changed`, `all_answered`
- Participants: `connected`, `participant_joined`, `participant_left`
- Results: `leaderboard`, `scores_update`, `segment_complete`, `event_complete`
- Multi-presenter: `presenter_changed`
- Status: `processing_status`, `display_mode`, `error`

*Audio Messages*: `audio_chunk`, `audio_stop`, `transcript_update`, `question_generated`
*Canvas Messages*: `draw_stroke`, `clear_canvas`, `stroke_added`, `canvas_sync`

**Multi-Presenter Flow**:
- Events contain multiple Segments, each with a designated presenter
- `PassPresenter` message transfers control between presenters
- Segment completion triggers `segment_complete` with per-segment leaderboard
- Event completion aggregates all segment scores into final leaderboard

**Quiz Phases** (state machine):
`not_started` → `showing_question` → `revealing_answer` → `showing_leaderboard` → `between_questions` → (repeat or) `segment_complete` → `event_complete`

## Development Workflow

### Adding an API Endpoint

1. **Define the route** in `backend/src/main.rs` (add to Router)
2. **Create handler** in appropriate `backend/src/routes/` module
3. **Add database queries** using SQLx in the handler
4. **Add types** to `backend/src/models/` if needed
5. **Add frontend client** in `frontend/src/api/endpoints.ts`
6. **Type the response** in the endpoints file
7. **Use in React** with the typed API client

**Example**: Adding event creation endpoint requires:
- Route handler in `routes/quiz.rs`
- Event model type in `models/event.rs`
- Frontend API client in `api/endpoints.ts`
- React component calling the endpoint

### Adding WebSocket Message Type

1. **Define in `backend/src/ws/messages.rs`** with serde derive
2. **Handle in `backend/src/ws/handler.rs`** match statement
3. **Parse on frontend** and update UI state
4. **Broadcast to clients** if needed

### Database Migrations

1. **Create migration file**: `sqlx migrate add -r <name>` in backend/
2. **Write SQL** in `migrations/<timestamp>_<name>.up.sql`
3. **Add down migration** in `.down.sql` for reversibility
4. **Migrations auto-run** on backend startup

## Key Design Patterns

### Error Handling (Rust)

- Use `Result<T, AppError>` types for fallible operations
- Custom `AppError` enum in `error.rs` with HTTP response mapping
- Never use `unwrap()` in production code
- Proper error propagation with `?` operator

### Authentication (Frontend & Backend)

- **Backend**: JWT tokens signed with `JWT_SECRET`
- **Frontend**: Store token in localStorage via Zustand
- **Middleware**: `auth/middleware.rs` validates JWT on protected routes
- **Interceptor**: Axios adds `Authorization: Bearer <token>` header automatically

### Real-time Updates (WebSocket)

- **Hub pattern**: Central `Hub` holds broadcast channels per event
- **Subscription**: Each client subscribes to their event channel
- **Broadcasting**: Handler publishes to channel, all subscribers receive
- **Message types**: All messages are JSON-serialized and type-checked

### Configuration

- **Load from environment**: `config.rs` reads from `.env` or environment variables
- **Providers**: Support for Claude, OpenAI, Ollama (configurable via env)
- **S3/MinIO**: Endpoint and credentials from environment for avatar storage

## Testing

### Rust Tests

- Unit tests in same file with `#[cfg(test)]` modules
- Run all: `cargo test`
- Run specific: `cargo test test_name -- --nocapture`
- Focus on services and critical business logic

### Frontend Unit Tests (Vitest)

```bash
cd frontend           # Required - tests must run from frontend directory
npm test              # Run all unit tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

**Test files** in `__tests__/` directories:
- `store/__tests__/authStore.test.ts` - Auth state management
- `api/__tests__/client.test.ts` - API interceptors, 401 handling
- `components/__tests__/ProtectedRoute.test.tsx` - Route guards
- `components/quiz/__tests__/` - QuestionDisplay, AnswerSelection, QuizResults
- `components/common/__tests__/` - Button, Input components
- `components/auth/__tests__/AvatarSelector.test.tsx` - Avatar selection

### Frontend E2E Tests (Playwright)

```bash
cd frontend               # Required - tests must run from frontend directory
npm run test:e2e          # Run all E2E tests (headless)
npm run test:e2e:ui       # Open Playwright UI for debugging
npm run test:e2e:headed   # Run with visible browser
```

**Test files** in `e2e/`:
- `auth.spec.ts` - Login, registration, navigation
- `navigation.spec.ts` - Basic app navigation, 404 handling
- `event.spec.ts` - Event management (requires backend)
- `quiz.spec.ts` - Quiz participation (requires backend)
- `fixtures/auth.ts` - Authentication helpers

**Notes:**
- E2E tests auto-start the dev server
- Some tests skip if backend is unavailable
- Screenshots saved on failure in `test-results/`

## Important Files & Their Roles

| File | Purpose |
|------|---------|
| `backend/src/main.rs` | Server initialization, router configuration |
| `backend/src/ws/hub.rs` | WebSocket session management and broadcasting |
| `backend/src/auth/jwt.rs` | JWT token creation and validation |
| `backend/src/services/ai.rs` | AI provider abstraction (Claude/OpenAI/Ollama) |
| `frontend/src/store/authStore.ts` | Authentication state persistence |
| `frontend/src/api/endpoints.ts` | Type-safe API client definitions |
| `frontend/src/hooks/useEventWebSocket.ts` | Main quiz WebSocket connection and state |
| `docker-compose.yml` | Service orchestration and environment setup |

## Environment Variables

**Backend** (in `.env` or Docker):
- `RUST_ENV`: Environment mode (`development` or `production`, default: `development`)
- `DATABASE_URL`: PostgreSQL connection string (required)
- `JWT_SECRET`: Signing key for JWT tokens (required for production)
- `JWT_EXPIRY_HOURS`: Token expiration (default: 24)
- `ENCRYPTION_KEY`: 32-byte key for encrypting stored API keys (required for production)
- `CORS_ALLOWED_ORIGINS`: Comma-separated allowed origins (required for production)
- `DEFAULT_AI_PROVIDER`: `claude`, `openai`, or `ollama` (default: `claude`)
- `ANTHROPIC_API_KEY`: Claude API key (if using claude provider)
- `OPENAI_API_KEY`: OpenAI API key (if using openai provider)
- `OLLAMA_BASE_URL`: Ollama endpoint (default: `http://localhost:11434`)
- `DEEPGRAM_API_KEY` / `ASSEMBLYAI_API_KEY`: Speech-to-text providers
- `ENABLE_STREAMING_TRANSCRIPTION`: Enable real-time Deepgram WebSocket streaming (default: `false`)
- `MINIO_*`: MinIO credentials and bucket configuration
- `RUST_LOG`: Log level (default: `info`)

**Transcription Modes**:
- Streaming (`ENABLE_STREAMING_TRANSCRIPTION=true`): Real-time Deepgram WebSocket with sub-second latency
- REST (default): Polling-based transcription, more compatible but higher latency

**Production Mode** (`RUST_ENV=production`):
- Validates that `JWT_SECRET` is not the default value
- Validates that `ENCRYPTION_KEY` is not the default value
- Requires `CORS_ALLOWED_ORIGINS` to be set
- Restricts CORS to configured origins only

**Frontend** (Vite env):
- `VITE_API_URL`: Backend API base URL (default: `http://localhost:8080`)
- `VITE_WS_URL`: WebSocket endpoint (default: `ws://localhost:8080`)

## Debugging WebSocket Issues

Use the `/ws-debug <session-code>` command to test WebSocket connections and inspect game state. This will help identify:
- Connection issues
- Message delivery problems
- State synchronization bugs
- Participant tracking issues

## Performance Considerations

- **Database**: Connection pool set to max 10 connections
- **WebSocket**: Broadcast channel buffer size 100 messages
- **Frontend**: React Router lazy loading for pages
- **Assets**: Tailwind CSS purges unused styles in production
- **Compression**: Axum middleware enables HTTP compression

## Security Notes

- All database queries use parameterized queries (SQLx compile-time checking)
- API keys (Anthropic, OpenAI, Deepgram) encrypted before storage
- CORS configured to allow all origins (configure for production)
- JWT validates signature on protected routes
- Passwords hashed with argon2 before storage
- Avatar upload validated (size, format)

## Claude Code Slash Commands

This project provides custom slash commands in `.claude/commands/`:

| Command | Purpose |
|---------|---------|
| `/ws-debug <code>` | Test WebSocket connections and inspect game state |
| `/run-tests [backend\|frontend\|all]` | Run tests for backend and/or frontend |
| `/build-check [backend\|frontend\|docker]` | Verify builds succeed |
| `/ai-test [claude\|openai\|ollama]` | Test AI provider connections |
| `/db-migrate [create\|run\|revert]` | Manage database migrations |
| `/docker-up [service]` | Start Docker Compose services |
| `/git-status` | Show git status and recent changes |
| `/rust-review [focus]` | Review Rust code for security |
| `/react-review [component]` | Review React code for best practices |

## Architecture Diagrams

See `ARCHITECTURE.md` for detailed mermaid diagrams covering:
- System overview and component architecture
- WebSocket communication sequences
- Quiz session lifecycle state machine
- AI question generation flow
- Authentication flow
- Database entity relationships

## Common Issues & Solutions

**"Connection refused" to backend**: Ensure `docker-compose up` is running and backend is healthy
**"Migrations failed"**: Check DATABASE_URL and PostgreSQL is running
**Type errors after schema changes**: Run `cargo sqlx prepare` to refresh compile-time query checks
**WebSocket disconnects**: Check CORS, firewall, and network configuration
**Avatar upload fails**: Verify MinIO is running and bucket permissions are correct
