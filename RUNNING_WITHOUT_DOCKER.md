# Running the Application Without Docker

This guide provides instructions for running the frontend, backend, and all tests (unit, integration, and E2E) without Docker.

## Quick Reference

| Task | Command |
|------|---------|
| **Start Backend** | `cd backend && cargo run` |
| **Start Frontend** | `cd frontend && npm run dev` |
| **Backend Unit Tests** | `cd backend && cargo test --lib` or `./scripts/run-backend-tests-local.sh --unit-only` |
| **Backend Integration Tests** | `cd backend && TEST_DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz_test cargo test --test '*'` or `./scripts/run-backend-tests-local.sh --integration-only` |
| **Frontend Unit Tests** | `cd frontend && npm test` or `./scripts/run-frontend-tests-local.sh` |
| **Frontend E2E Tests** | `cd frontend && npm run test:e2e` or `./scripts/run-e2e-tests-local.sh` (requires services running) |
| **All Tests** | `./scripts/run-all-tests-local.sh` |
| **Run Migrations** | `cd backend && cargo sqlx migrate run` |
| **Create Test DB** | `psql -U quiz -d postgres -c "CREATE DATABASE quiz_test;"` |

## Prerequisites

### Required Software

1. **Rust** (latest stable version)
   ```bash
   # Install via rustup: https://rustup.rs/
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Node.js** (v18 or higher)
   ```bash
   # Install via nvm (recommended): https://github.com/nvm-sh/nvm
   nvm install 18
   nvm use 18
   
   # Or download from: https://nodejs.org/
   ```

3. **PostgreSQL** (v15 or higher)
   ```bash
   # macOS (Homebrew)
   brew install postgresql@15
   brew services start postgresql@15
   
   # Ubuntu/Debian
   sudo apt-get install postgresql-15
   sudo systemctl start postgresql
   
   # Windows: Download from https://www.postgresql.org/download/windows/
   ```

4. **MinIO** (S3-compatible object storage)
   ```bash
   # macOS (Homebrew)
   brew install minio/stable/minio
   
   # Linux (binary)
   wget https://dl.min.io/server/minio/release/linux-amd64/minio
   chmod +x minio
   sudo mv minio /usr/local/bin/
   
   # Or download from: https://min.io/download
   ```

5. **Playwright** (for E2E tests - installed via npm)
   ```bash
   # Will be installed automatically with npm install
   ```

### Database Setup

1. **Create PostgreSQL database and user:**
   ```bash
   # Connect to PostgreSQL
   psql postgres
   
   # Create database and user
   CREATE USER quiz WITH PASSWORD 'quiz';
   CREATE DATABASE quiz OWNER quiz;
   CREATE DATABASE quiz_test OWNER quiz;
   GRANT ALL PRIVILEGES ON DATABASE quiz TO quiz;
   GRANT ALL PRIVILEGES ON DATABASE quiz_test TO quiz;
   \q
   ```

2. **Verify connection:**
   ```bash
   psql -U quiz -d quiz -h localhost
   ```

### MinIO Setup

1. **Start MinIO server:**
   ```bash
   # Create data directory
   mkdir -p ~/minio-data
   
   # Start MinIO (default: localhost:9000)
   minio server ~/minio-data --console-address ":9001"
   ```

2. **Initialize bucket (in another terminal):**
   ```bash
   # Install MinIO client (mc)
   # macOS
   brew install minio/stable/mc
   
   # Linux
   wget https://dl.min.io/client/mc/release/linux-amd64/mc
   chmod +x mc
   sudo mv mc /usr/local/bin/
   
   # Configure and create bucket
   mc alias set myminio http://localhost:9000 minioadmin minioadmin
   mc mb myminio/avatars --ignore-existing
   mc anonymous set download myminio/avatars
   ```

## Environment Configuration

1. **Copy the example environment file:**
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env` with your local settings:**
   ```bash
   # Database (adjust if your PostgreSQL is on a different port/host)
   DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz
   
   # MinIO (defaults should work if MinIO is running locally)
   MINIO_ENDPOINT=localhost:9000
   MINIO_ACCESS_KEY=minioadmin
   MINIO_SECRET_KEY=minioadmin
   MINIO_BUCKET=avatars
   
   # JWT Secret (change in production!)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   ENCRYPTION_KEY=32-byte-secret-key-change-me!!!
   
   # AI Provider API Keys (optional for basic functionality)
   ANTHROPIC_API_KEY=sk-ant-your-key-here
   OPENAI_API_KEY=sk-your-key-here
   DEEPGRAM_API_KEY=your-deepgram-key-here
   
   # Backend port
   BACKEND_PORT=8080
   
   # Frontend (Vite)
   VITE_API_URL=http://localhost:8080
   VITE_WS_URL=ws://localhost:8080
   ```

## Running the Backend

1. **Navigate to backend directory:**
   ```bash
   cd backend
   ```

2. **Install dependencies (first time only):**
   ```bash
   # Dependencies are managed by Cargo, no separate install step needed
   ```

3. **Run database migrations:**
   ```bash
   # Ensure DATABASE_URL is set in .env or environment
   cargo sqlx migrate run
   ```

4. **Start the backend server:**
   ```bash
   # From backend directory
   cargo run
   
   # Or with custom port
   BACKEND_PORT=8080 cargo run
   ```

   The backend will be available at `http://localhost:8080`

5. **Verify backend is running:**
   ```bash
   curl http://localhost:8080/api/health
   ```

## Running the Frontend

1. **Navigate to frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies (first time only):**
   ```bash
   npm install
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```

   The frontend will be available at `http://localhost:5173`

4. **Build for production:**
   ```bash
   npm run build
   npm run preview  # Preview production build
   ```

## Running Tests

### Backend Tests

#### Unit Tests (No Database Required)

Unit tests don't require external dependencies:

```bash
cd backend

# Run all unit tests
cargo test --lib

# Run specific test module
cargo test --lib auth::jwt

# Run with output
cargo test --lib -- --nocapture

# Run specific test
cargo test --lib test_jwt_token_creation
```

#### Integration Tests (Database Required)

Integration tests require a PostgreSQL database:

1. **Ensure PostgreSQL is running and test database exists:**
   ```bash
   # Create test database if it doesn't exist
   psql -U quiz -d postgres -c "CREATE DATABASE quiz_test;"
   ```

2. **Set test database URL:**
   ```bash
   export TEST_DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz_test
   ```

3. **Run integration tests:**
   ```bash
   cd backend
   
   # Run all integration tests
   cargo test --test '*'
   
   # Run specific integration test file
   cargo test --test auth_routes_test
   
   # Run with output
   cargo test --test '*' -- --nocapture
   ```

4. **Run all tests (unit + integration):**
   ```bash
   cargo test
   ```

**Note:** Integration tests will automatically:
- Create the test database if it doesn't exist (via `test_utils.rs`)
- Run migrations before tests
- Use a separate test database to avoid affecting development data

### Frontend Tests

#### Unit Tests (Vitest)

Unit tests use jsdom and don't require the backend:

```bash
cd frontend

# Run all unit tests
npm test

# Run in watch mode
npm run test:watch

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- src/store/__tests__/authStore.test.ts

# Run tests matching a pattern
npm test -- -t "auth"
```

#### E2E Tests (Playwright)

E2E tests require the backend and frontend to be running:

1. **Start services manually:**
   ```bash
   # Terminal 1: Start PostgreSQL and MinIO
   # PostgreSQL should already be running
   # Start MinIO if not running:
   minio server ~/minio-data --console-address ":9001"
   
   # Terminal 2: Start backend
   cd backend
   cargo run
   
   # Terminal 3: Start frontend
   cd frontend
   npm run dev
   ```

2. **Run E2E tests:**
   ```bash
   cd frontend
   
   # Run all E2E tests
   npm run test:e2e
   
   # Run with UI mode (interactive)
   npm run test:e2e:ui
   
   # Run in headed mode (see browser)
   npm run test:e2e:headed
   
   # Run specific test file
   npm run test:e2e -- e2e/auth.spec.ts
   ```

3. **Install Playwright browsers (first time only):**
   ```bash
   cd frontend
   npx playwright install
   ```

**Note:** The Playwright config (`playwright.config.ts`) currently tries to auto-start Docker services. For non-Docker usage:
- The config will detect Docker is not available and show a warning (this is fine)
- Ensure all services (PostgreSQL, MinIO, backend, frontend) are running manually before tests
- Tests will proceed but may fail if services aren't ready

### Running All Tests

**Backend (unit + integration):**
```bash
cd backend
export TEST_DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz_test
cargo test
```

**Frontend (unit + E2E):**
```bash
cd frontend
npm test                    # Unit tests
npm run test:e2e            # E2E tests (requires services running)
```

## Verification Checklist

Before running the application, verify all services are properly configured:

```bash
# 1. PostgreSQL is running and accessible
psql -U quiz -d quiz -c "SELECT 1;" || echo "❌ PostgreSQL not accessible"

# 2. Test database exists
psql -U quiz -d quiz_test -c "SELECT 1;" || echo "❌ Test database missing (create with: CREATE DATABASE quiz_test;)"

# 3. MinIO is running
curl -f http://localhost:9000/minio/health/live || echo "❌ MinIO not running"

# 4. MinIO bucket exists
mc ls myminio/avatars || echo "❌ MinIO bucket missing (create with: mc mb myminio/avatars)"

# 5. Backend compiles
cd backend && cargo check || echo "❌ Backend has compilation errors"

# 6. Frontend dependencies installed
cd frontend && npm list --depth=0 > /dev/null 2>&1 || echo "❌ Frontend dependencies missing (run: npm install)"

# 7. Environment variables set
[ -f .env ] && echo "✅ .env file exists" || echo "⚠️  .env file missing (copy from .env.example)"
```

## Troubleshooting

### Backend Issues

**"Connection refused" to database:**
- Ensure PostgreSQL is running: `pg_isready` or `psql -U quiz -d quiz`
- Check `DATABASE_URL` in `.env` matches your PostgreSQL setup
- Verify database and user exist: `psql -U quiz -d quiz -c "SELECT 1;"`

**"Migration failed":**
- Ensure database exists and user has permissions
- Check `DATABASE_URL` is correct
- Try running migrations manually: `cargo sqlx migrate run`

**"Port already in use":**
- Change `BACKEND_PORT` in `.env` or use: `BACKEND_PORT=8081 cargo run`
- Find and kill process using port: `lsof -ti:8080 | xargs kill`

### Frontend Issues

**"Cannot connect to backend":**
- Ensure backend is running on the port specified in `VITE_API_URL`
- Check CORS settings if backend rejects requests
- Verify `VITE_API_URL` and `VITE_WS_URL` in `.env` or environment

**"Module not found" errors:**
- Run `npm install` to ensure all dependencies are installed
- Delete `node_modules` and `package-lock.json`, then `npm install`

### Test Issues

**Backend integration tests fail:**
- Ensure test database exists: `psql -U quiz -d postgres -c "CREATE DATABASE quiz_test;"`
- Set `TEST_DATABASE_URL` environment variable
- Check PostgreSQL is running and accessible

**Frontend E2E tests fail:**
- Ensure backend and frontend are running before tests
- Check Playwright browsers are installed: `npx playwright install`
- Verify services are accessible at expected URLs

**MinIO connection errors:**
- Ensure MinIO is running: `curl http://localhost:9000/minio/health/live`
- Check `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, and `MINIO_SECRET_KEY` in `.env`
- Verify bucket exists: `mc ls myminio/avatars`

## Development Workflow

### Typical Development Session

1. **Start services:**
   ```bash
   # Terminal 1: PostgreSQL (if not running as service)
   # Usually runs as background service, no action needed
   
   # Terminal 2: MinIO
   minio server ~/minio-data --console-address ":9001"
   
   # Terminal 3: Backend
   cd backend
   cargo run
   
   # Terminal 4: Frontend
   cd frontend
   npm run dev
   ```

2. **Make changes and test:**
   - Backend: Changes trigger recompilation (may take a few seconds)
   - Frontend: Changes trigger hot module reload (instant)

3. **Run tests as needed:**
   ```bash
   # Backend unit tests (fast, no dependencies)
   cd backend && cargo test --lib
   
   # Frontend unit tests (fast, no dependencies)
   cd frontend && npm test
   
   # Backend integration tests (requires database)
   cd backend && TEST_DATABASE_URL=postgres://quiz:quiz@localhost:5432/quiz_test cargo test --test '*'
   
   # Frontend E2E tests (requires all services)
   cd frontend && npm run test:e2e
   ```

## Differences from Docker Setup

When running without Docker:

1. **Ports:** Services run directly on host ports (no port mapping)
2. **Networking:** Use `localhost` instead of service names
3. **Database:** Must create databases and users manually
4. **MinIO:** Must start and configure manually
5. **Environment:** Variables read from `.env` file or shell environment
6. **Dependencies:** Must install Rust, Node.js, PostgreSQL, MinIO manually

## Optional: Local LLM (Ollama)

If you want to use Ollama for local AI instead of API providers:

1. **Install Ollama:**
   ```bash
   # macOS
   brew install ollama
   
   # Linux
   curl -fsSL https://ollama.com/install.sh | sh
   ```

2. **Start Ollama:**
   ```bash
   ollama serve
   ```

3. **Pull a model:**
   ```bash
   ollama pull llama2
   ```

4. **Configure in `.env`:**
   ```bash
   DEFAULT_AI_PROVIDER=ollama
   OLLAMA_BASE_URL=http://localhost:11434
   OLLAMA_MODEL=llama2
   ```

## Performance Tips

1. **Backend compilation:** First build takes time, subsequent builds are incremental
2. **Database connections:** Connection pool is limited to 10 (configurable in code)
3. **Frontend HMR:** Vite provides fast hot module replacement
4. **Test speed:** Unit tests are fast, integration/E2E tests are slower

## Security Notes

- Never commit `.env` file with real API keys
- Change default `JWT_SECRET` and `ENCRYPTION_KEY` in production
- Use strong passwords for PostgreSQL in production
- Configure CORS properly for production deployments

## Helper Scripts

The `scripts/` directory contains both Docker and non-Docker test scripts:

### Non-Docker Scripts (Recommended for Local Development)

- **`run-backend-tests-local.sh`** - Run backend unit and integration tests
  ```bash
  ./scripts/run-backend-tests-local.sh                    # All tests
  ./scripts/run-backend-tests-local.sh --unit-only       # Unit only
  ./scripts/run-backend-tests-local.sh --integration-only # Integration only
  ```

- **`run-frontend-tests-local.sh`** - Run frontend unit tests
  ```bash
  ./scripts/run-frontend-tests-local.sh           # All unit tests
  ./scripts/run-frontend-tests-local.sh --coverage # With coverage
  ./scripts/run-frontend-tests-local.sh --watch    # Watch mode
  ```

- **`run-e2e-tests-local.sh`** - Run frontend E2E tests (requires services running)
  ```bash
  ./scripts/run-e2e-tests-local.sh                    # All E2E tests
  ./scripts/run-e2e-tests-local.sh --file e2e/auth.spec.ts  # Specific file
  ./scripts/run-e2e-tests-local.sh --headed          # Show browser
  ```

- **`run-all-tests-local.sh`** - Run all tests (backend + frontend)
  ```bash
  ./scripts/run-all-tests-local.sh                    # All tests
  ./scripts/run-all-tests-local.sh --skip-frontend-e2e # Skip E2E
  ```

These scripts:
- Check prerequisites (Rust, Node.js, PostgreSQL, etc.)
- Set up test databases automatically
- Provide colored output and helpful error messages
- Support various options and flags

See `scripts/README.md` for detailed documentation on all scripts.

## Summary

This guide covers running the entire application stack without Docker:

✅ **Backend**: Rust/Axum server with PostgreSQL and MinIO  
✅ **Frontend**: React/Vite development server  
✅ **Unit Tests**: Fast tests without external dependencies  
✅ **Integration Tests**: Backend tests with database  
✅ **E2E Tests**: Full-stack tests with Playwright  

All services run directly on your host machine, making it easier to:
- Debug with native tools
- Use IDE integrations
- Profile performance
- Modify code without container rebuilds

For production deployments or CI/CD, Docker is still recommended for consistency and isolation.
