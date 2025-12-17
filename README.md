# Quiz App

A real-time multiplayer quiz application for multi-presenter events with live audio transcription and AI-powered question generation.

## Features

### Core Quiz Features
- **Real-time Multiplayer**: WebSocket-based live quiz sessions with instant updates
- **Multi-Presenter Support**: Host events with multiple presenters and segments
- **AI Question Generation**: Generate quiz questions from content using Claude, OpenAI, or local Ollama
- **Live Audio Transcription**: Speech-to-text via Deepgram, AssemblyAI, or OpenAI Whisper
- **Two Quiz Modes**:
  - **Traditional Mode**: Pre-written questions with AI-generated fake answers
  - **Listen Only Mode**: AI generates questions entirely from live audio
- **Collaborative Canvas**: Real-time drawing capabilities for presenters
- **QR Code Join**: Easy participant joining via QR codes
- **Leaderboards**: Segment-level and master event leaderboards with live score tracking

### User & Settings
- **Avatar System**: Preset, emoji, or custom avatars stored in S3-compatible storage
- **User Settings**: Per-user AI provider and STT provider configuration
- **API Key Encryption**: Secure storage for user-provided API keys

### Bonus Features
- **Flappy Bird Mini-Game**: Bonus game mode for entertainment between quiz segments

## Development Status

### Fully Implemented
- [x] Listen Only Mode - AI question generation from live audio
- [x] **Traditional Mode** - Pre-written questions with AI-generated fake answers
  - Manual question creation (single and bulk import via CSV/JSON)
  - Automatic fake answer generation during quiz start
  - Full question management (CRUD operations)
  - Mode selection during event creation
- [x] Real-time WebSocket Support - Hub pattern with broadcast channels
- [x] AI Question Generation - Claude, OpenAI, Ollama providers with quality scoring
- [x] Collaborative Drawing Canvas - Real-time strokes with color/brush controls
- [x] QR Code Join - 6-character codes with QR generation
- [x] Leaderboards - Segment-level and master event leaderboards
- [x] Avatar System - Preset/emoji/custom with MinIO storage
- [x] Event/Segment Management - Full CRUD with recording lifecycle
- [x] User Settings - Per-user provider configuration
- [x] API Key Encryption - Secure credential storage
- [x] Flappy Bird Mini-Game - Bonus game mode
- [x] True Streaming Transcription - Deepgram WebSocket streaming
  - Real-time transcription with sub-second latency
  - Interim and final results support
  - Enabled via `ENABLE_STREAMING_TRANSCRIPTION` environment variable
  - Graceful fallback to REST mode if streaming unavailable
  - Backward compatible (defaults to REST mode)

### Partially Implemented / Known Limitations
- [ ] **AI-Based Quality Scoring** - Currently uses heuristic-based evaluation
  - Checks question/answer length, grammar, format
  - AI-powered quality assessment planned for future

### Future Enhancements
- [ ] Browser audio format validation (WebM/Opus compatibility)
- [ ] Canvas performance optimization for large stroke counts
- [ ] AssemblyAI WebSocket streaming (Deepgram streaming already implemented)
- [ ] AI-powered question quality evaluation
- [ ] Presenter handoff between segments
- [ ] Event templates and question banks

## Tech Stack

| Component | Technology |
|-----------|------------|
| Backend | Rust (Axum framework) |
| Frontend | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State Management | Zustand |
| Database | PostgreSQL 15 |
| Object Storage | MinIO (S3-compatible) |
| Real-time | WebSockets |
| AI Providers | Claude, OpenAI, Ollama |
| STT Providers | Deepgram, AssemblyAI, OpenAI Whisper |

## Prerequisites

- **Docker** and **Docker Compose** (recommended)
- Or for local development:
  - Rust 1.70+ with Cargo
  - Node.js 18+ with npm
  - PostgreSQL 15
  - MinIO (optional, for avatars)

## Quick Start (Docker)

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd quiz-app
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your API keys and configuration
   ```

3. **Start all services**:
   ```bash
   docker-compose up -d
   ```

4. **Access the application**:
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8080
   - MinIO Console: http://localhost:9001

5. **Stop services**:
   ```bash
   docker-compose down
   ```

### Using Local LLM (Ollama)

To use a local LLM instead of cloud providers:

```bash
docker-compose --profile local-llm up -d
```

This starts Ollama and pulls the llama2 model on first run.

## Local Development

### Backend

```bash
# Start dependencies
docker-compose up -d postgres minio minio-init

# Navigate to backend
cd backend

# Build
cargo build

# Run development server
cargo run

# Run tests
cargo test

# Lint
cargo clippy

# Format
cargo fmt
```

### Frontend

```bash
# Navigate to frontend
cd frontend

# Install dependencies
npm install

# Start development server (with HMR)
npm run dev

# Build for production
npm run build

# Type check
npm run type-check

# Lint
npm run lint
```

## Project Structure

```
quiz-app/
├── backend/
│   ├── src/
│   │   ├── main.rs          # Entry point, router setup
│   │   ├── models/          # Domain models (User, Event, Question)
│   │   ├── routes/          # HTTP handlers
│   │   ├── services/        # Business logic (AI, scoring, transcription)
│   │   ├── ws/              # WebSocket layer (hub, handlers, messages)
│   │   ├── auth/            # JWT handling
│   │   └── error.rs         # Error types
│   ├── migrations/          # SQLx database migrations
│   ├── Cargo.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── App.tsx          # Router configuration
│   │   ├── pages/           # Page components
│   │   ├── components/      # Reusable UI components
│   │   ├── store/           # Zustand state management
│   │   └── api/             # HTTP client
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── .env.example
└── CLAUDE.md                # AI assistant instructions
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure:

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://quiz:quiz@localhost:5432/quiz` |
| `JWT_SECRET` | JWT signing key (change in production) | - |
| `JWT_EXPIRY_HOURS` | Token expiration | `24` |
| `ENCRYPTION_KEY` | 32-byte key for API key encryption | - |
| `DEFAULT_AI_PROVIDER` | `claude`, `openai`, or `ollama` | `claude` |
| `ANTHROPIC_API_KEY` | Claude API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `OLLAMA_BASE_URL` | Ollama endpoint | `http://localhost:11434` |
| `DEFAULT_STT_PROVIDER` | `deepgram`, `assemblyai`, or `whisper` | `deepgram` |
| `DEEPGRAM_API_KEY` | Deepgram API key | - |
| `ASSEMBLYAI_API_KEY` | AssemblyAI API key | - |
| `MINIO_ENDPOINT` | MinIO/S3 endpoint | `localhost:9000` |
| `MINIO_ACCESS_KEY` | MinIO access key | `minioadmin` |
| `MINIO_SECRET_KEY` | MinIO secret key | `minioadmin` |
| `VITE_API_URL` | Backend API URL (frontend) | `http://localhost:8080` |
| `VITE_WS_URL` | WebSocket URL (frontend) | `ws://localhost:8080` |
| `RUST_LOG` | Log level | `info` |

## Database Migrations

Migrations run automatically on backend startup. To manage manually:

```bash
cd backend

# Create a new migration
sqlx migrate add -r <migration_name>

# Run migrations
sqlx migrate run

# Revert last migration
sqlx migrate revert
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and receive JWT

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `GET /api/events/:id` - Get event details

### Quiz
- `GET /api/quiz/:code` - Join quiz by code
- `POST /api/quiz/:id/answer` - Submit answer

### WebSocket
- `/api/ws/event/:event_id` - Event updates (participants, questions, canvas)
- `/api/ws/audio/:segment_id` - Audio streaming for transcription

## Docker Services

| Service | Port | Description |
|---------|------|-------------|
| `postgres` | 5432 | PostgreSQL database |
| `minio` | 9000, 9001 | S3-compatible storage (API, Console) |
| `backend` | 8080 | Rust API server |
| `frontend` | 5173 | React development server |
| `ollama` | 11434 | Local LLM (optional, `--profile local-llm`) |

## Useful Commands

```bash
# View logs
docker-compose logs -f backend

# Reset database
docker-compose down -v

# Rebuild specific service
docker-compose build backend

# Run backend tests
cd backend && cargo test

# Check frontend types
cd frontend && npm run type-check
```

## Security Notes

- Change `JWT_SECRET` and `ENCRYPTION_KEY` in production
- API keys are encrypted before database storage
- CORS is permissive by default (configure for production)
- Passwords are hashed with Argon2
- All database queries use parameterized statements (SQLx)

## Troubleshooting

**Connection refused to backend**: Ensure Docker services are running with `docker-compose up -d`

**Migration errors**: Verify `DATABASE_URL` and that PostgreSQL is healthy

**Type errors after schema changes**: Run `cargo sqlx prepare` to refresh compile-time checks

**WebSocket disconnects**: Check CORS settings and network configuration

**Avatar upload fails**: Verify MinIO is running and the `avatars` bucket exists

## License

[Add your license here]
