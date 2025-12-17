---
allowed-tools: Bash(docker:*), Bash(docker-compose:*)
argument-hint: [optional: service-name or --profile]
description: Start Docker Compose services for development
---

# Start Docker Services

Start the quiz application Docker services.

## Check Current Status
!`docker compose ps 2>&1`

## Available Services
- **postgres** - PostgreSQL database
- **minio** - S3-compatible object storage for avatars
- **backend** - Rust Axum API server
- **frontend** - React Vite dev server
- **ollama** (profile: local-llm) - Local LLM for AI features

## Commands
To start all services:
```bash
docker compose up -d
```

To start with local LLM support:
```bash
docker compose --profile local-llm up -d
```

To start specific service: $ARGUMENTS

## After Starting
1. Backend API available at: http://localhost:8080
2. Frontend available at: http://localhost:5173
3. MinIO console at: http://localhost:9001
4. PostgreSQL at: localhost:5432

## Troubleshooting
If services fail to start, check:
- Docker daemon is running
- Ports are not in use
- .env file exists with required variables
