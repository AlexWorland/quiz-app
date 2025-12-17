---
allowed-tools: Bash(sqlx:*), Bash(cargo sqlx:*)
argument-hint: [create|run|revert] [migration-name]
description: Manage database migrations with SQLx
---

# Database Migrations

Manage PostgreSQL database migrations for the quiz application.

## Current Migration Status
!`cd backend && cargo sqlx migrate info 2>&1`

## Commands

### Create a new migration
```bash
cd backend && cargo sqlx migrate add <migration_name>
```

### Run pending migrations
```bash
cd backend && cargo sqlx migrate run
```

### Revert last migration
```bash
cd backend && cargo sqlx migrate revert
```

## Migration Files Location
`backend/migrations/`

## Schema Overview
- `users` - User accounts (presenters and participants)
- `quizzes` - Quiz definitions
- `questions` - Quiz questions with correct answers
- `game_sessions` - Live game instances
- `session_answers` - Generated answers per session
- `session_participants` - Users in a game session
- `responses` - Individual question responses
- `user_ai_settings` - AI provider configuration per user
- `presentation_transcripts` - Audio transcription chunks

## Before Running Migrations
1. Ensure PostgreSQL is running: `docker compose up -d postgres`
2. Check DATABASE_URL in .env file
3. Backup data if running on production

## After Creating Migration
Edit the new `.sql` file in `backend/migrations/` with your schema changes.
