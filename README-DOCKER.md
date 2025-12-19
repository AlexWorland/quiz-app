# Docker Compose Setup

This project uses Docker Compose to manage all services for development and testing.

## Services

- **postgres**: PostgreSQL database (port 5432)
- **minio**: S3-compatible object storage for avatars (ports 9000, 9001)
- **backend**: Rust/Axum backend API (port 8081 on host, 8080 in container)
- **frontend**: React/Vite frontend (port 5173)
- **ollama**: Local LLM (optional, port 11434) - use `--profile local-llm`

## Quick Start

### Start all services:
```bash
docker compose up -d
```

### Start with local LLM support:
```bash
docker compose --profile local-llm up -d
```

### View logs:
```bash
docker compose logs -f [service-name]
# Example: docker compose logs -f backend
```

### Stop all services:
```bash
docker compose down
```

### Stop and remove volumes (clean database):
```bash
docker compose down -v
```

## Development Mode

The docker-compose setup uses development Dockerfiles (`Dockerfile.dev`) that:
- Mount source code as volumes for hot-reloading
- Run in development mode (not optimized builds)
- Include health checks for service dependencies

### Backend Development
- Source code mounted at `./backend`
- Runs `cargo run` (watches for changes)
- Compiles on first start (may take a few minutes)
- Health check: `http://localhost:8081/api/health`

### Frontend Development
- Source code mounted at `./frontend`
- Runs `npm run dev` (Vite dev server with HMR)
- Health check: `http://localhost:5173/`

## E2E Testing

Playwright tests automatically start all Docker services before running:
```bash
cd frontend
npm run test:e2e
```

The test configuration will:
1. Check if Docker services are running
2. Start all services if needed (`docker compose up -d`)
3. Wait for services to be healthy
4. Run tests against the running services

## Environment Variables

Create a `.env` file in the project root to override defaults:

```env
# Backend
JWT_SECRET=your-secret-key
ENCRYPTION_KEY=your-32-byte-encryption-key
DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz

# AI Providers
ANTHROPIC_API_KEY=your-key
OPENAI_API_KEY=your-key
DEEPGRAM_API_KEY=your-key

# Frontend
VITE_API_URL=http://localhost:8081
VITE_WS_URL=ws://localhost:8081
```

## Networking

- Services communicate internally via Docker network (`quiz-network`)
- Frontend Vite proxy routes `/api` requests to backend service
- External access via `localhost` ports (5173, 8080, 5432, 9000)

## Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker info

# Check service status
docker compose ps

# View logs
docker compose logs
```

### Backend compilation fails
- First build takes several minutes
- Check Docker has enough resources (CPU/memory)
- View backend logs: `docker compose logs -f backend`

### Port conflicts
- Stop any local services using ports 5173, 8081, 5432, 9000
- Or modify port mappings in `docker-compose.yml`
- Backend uses port 8081 on host (8080 inside container)

### Database migrations
- Migrations run automatically on backend startup
- To reset database: `docker compose down -v && docker compose up -d`

