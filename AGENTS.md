# AGENTS.md - Agent Guidelines for Presentation Quiz App

## Project Overview
Real-time multiplayer quiz application for multi-presenter events with live audio transcription and AI-powered question generation. Two modes: Traditional (pre-written + AI fake answers) and Listen Only (AI from live audio).

## Build/Lint/Test Commands

### Backend (Rust)
```bash
cd backend
cargo build                    # Build
cargo test                     # Run all tests
cargo test test_name           # Run single test
cargo check                    # Type check without build
cargo fmt                      # Format code
cargo clippy                   # Lint
```

### Frontend (React/TypeScript)
```bash
cd frontend
npm run build                  # Build
npm run type-check             # Type check without build
npm run lint                   # Lint
npm test                       # Run unit tests
npm run test:watch             # Watch mode
npm run test:e2e               # Run E2E tests
```

### Docker & Services
```bash
docker-compose up -d            # Start all services
docker-compose --profile local-llm up -d  # With Ollama
docker-compose down -v          # Stop and reset volumes
```

## Code Style Guidelines

### Rust
- Use Result<T, AppError> for error handling, never unwrap() in production
- Use SQLx compile-time checked queries with parameterized statements
- Follow async/await patterns with tokio, proper error propagation with ?
- Use Arc<Mutex<>> or channels for shared state management
- All database queries must use parameterized queries (SQLx)

### TypeScript/React
- Use TypeScript strict mode, avoid 'any' types
- Use functional components with hooks, Zustand for global state
- Type all API responses and WebSocket messages
- Follow React best practices for state management
- Use proper import organization: React → third-party → local

### General
- Include unit tests for new code, create tests if none exist
- Ensure proper error handling and HTTP status codes for API endpoints
- WebSocket messages must be typed and validated
- Follow project structure: backend/src/ for Rust, frontend/src/ for React

## Architecture Overview
**Backend**: Axum + PostgreSQL + WebSocket hub for real-time updates
**Frontend**: React + Tailwind + Zustand + custom WebSocket hooks
**Key modules**: models/, routes/, services/, ws/ (backend) | pages/, components/, hooks/, api/ (frontend)

## Environment Variables
Required: DATABASE_URL, JWT_SECRET, ENCRYPTION_KEY, CORS_ALLOWED_ORIGINS
Optional: ANTHROPIC_API_KEY, OPENAI_API_KEY, DEFAULT_AI_PROVIDER, MINIO_*