# Test Runner Scripts

This directory contains scripts for running tests with Docker and without Docker.

## Available Scripts

### Non-Docker Scripts (Recommended for Local Development)

These scripts run tests without Docker, requiring services to be installed and running locally.

#### Backend Tests

**`run-backend-tests-local.sh`** - Run backend unit and integration tests without Docker

**Usage:**
```bash
# Run all tests (unit + integration)
./scripts/run-backend-tests-local.sh

# Run only unit tests (no database required)
./scripts/run-backend-tests-local.sh --unit-only

# Run only integration tests (requires database)
./scripts/run-backend-tests-local.sh --integration-only

# Run specific test
./scripts/run-backend-tests-local.sh -- test_name

# Use custom test database
TEST_DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/run-backend-tests-local.sh
```

**Features:**
- Automatically checks PostgreSQL connection
- Creates test database if it doesn't exist
- Runs unit tests (no dependencies)
- Runs integration tests (with database)
- Colored output for better readability

#### Frontend Unit Tests

**`run-frontend-tests-local.sh`** - Run frontend unit tests without Docker

**Usage:**
```bash
# Run all unit tests
./scripts/run-frontend-tests-local.sh

# Run with coverage
./scripts/run-frontend-tests-local.sh --coverage

# Run in watch mode
./scripts/run-frontend-tests-local.sh --watch

# Run specific test file
./scripts/run-frontend-tests-local.sh -- src/store/__tests__/authStore.test.ts
```

**Features:**
- Checks Node.js and npm installation
- Installs dependencies if needed
- Runs Vitest unit tests
- Supports coverage and watch modes

#### Frontend E2E Tests

**`run-e2e-tests-local.sh`** - Run frontend E2E tests without Docker (requires services running)

**Usage:**
```bash
# Run all E2E tests (requires backend and frontend running)
./scripts/run-e2e-tests-local.sh

# Run specific test file
./scripts/run-e2e-tests-local.sh --file e2e/auth.spec.ts

# Run in headed mode (show browser)
./scripts/run-e2e-tests-local.sh --headed

# Run in UI mode (interactive)
./scripts/run-e2e-tests-local.sh --ui

# Skip service checks
./scripts/run-e2e-tests-local.sh --skip-checks
```

**Features:**
- Checks service availability (backend, frontend, PostgreSQL, MinIO)
- Installs Playwright browsers if needed
- Runs Playwright E2E tests
- Supports headed and UI modes

#### All Tests

**`run-all-tests-local.sh`** - Run all tests (backend unit, backend integration, frontend unit, frontend E2E)

**Usage:**
```bash
# Run all tests
./scripts/run-all-tests-local.sh

# Skip E2E tests
./scripts/run-all-tests-local.sh --skip-frontend-e2e

# Skip backend integration tests
./scripts/run-all-tests-local.sh --skip-backend-integration

# Skip multiple test suites
./scripts/run-all-tests-local.sh --skip-backend-integration --skip-frontend-e2e
```

**Features:**
- Runs all test suites in sequence
- Provides summary of all test results
- Can skip specific test suites
- Interactive prompt for E2E tests

### Docker Scripts (For CI/CD and Containerized Environments)

### Shell Script (Bash)

**`run-e2e-tests.sh`** - Cross-platform shell script for running E2E tests

**Usage:**
```bash
# Run all tests (starts services automatically)
./scripts/run-e2e-tests.sh

# Run specific test file
./scripts/run-e2e-tests.sh --file multi-presenter.spec.ts

# Run in headed mode (show browser)
./scripts/run-e2e-tests.sh --headed

# Run in UI mode (interactive)
./scripts/run-e2e-tests.sh --ui

# Skip service setup (assume services are already running)
./scripts/run-e2e-tests.sh --skip-setup

# Show help
./scripts/run-e2e-tests.sh --help
```

**Features:**
- Automatically checks and starts Docker services (PostgreSQL, MinIO)
- Starts backend server if not running
- Waits for services to be ready before running tests
- Provides colored output for better readability
- Handles cleanup on exit

### Node.js Script

**`run-e2e-tests.js`** - Node.js version with better cross-platform support

**Usage:**
```bash
# Run all tests
node scripts/run-e2e-tests.js

# Run specific test file
node scripts/run-e2e-tests.js --file multi-presenter.spec.ts

# Run in headed mode
node scripts/run-e2e-tests.js --headed

# Run in UI mode
node scripts/run-e2e-tests.js --ui

# Skip service setup
node scripts/run-e2e-tests.js --skip-setup

# Show help
node scripts/run-e2e-tests.js --help
```

**Features:**
- Same functionality as shell script
- Better Windows compatibility
- More detailed error messages
- Can be extended with additional features

## Prerequisites

### For Non-Docker Scripts

**Required:**
- **Rust/Cargo** - For backend compilation and tests
- **Node.js** (v18+) - For frontend and Playwright tests
- **PostgreSQL** (v15+) - For database and integration tests
- **MinIO** - For S3-compatible storage (optional, but recommended)

**Setup:**
1. Install Rust: https://rustup.rs/
2. Install Node.js: https://nodejs.org/
3. Install PostgreSQL: https://www.postgresql.org/download/
4. Install MinIO: https://min.io/download
5. Create databases: See `RUNNING_WITHOUT_DOCKER.md` for setup instructions

### For Docker Scripts

**Required:**
- **Docker** - For running PostgreSQL and MinIO services
- **Node.js** - For running frontend and Playwright tests
- **Rust/Cargo** - For running backend server (if not using Docker)

### Backend Test Script

**`run-backend-tests.sh`** - Reset the test database and run backend tests in Docker

**Usage:**
```bash
# Run all backend tests (resets quiz_test first)
./scripts/run-backend-tests.sh

# Run a specific test
./scripts/run-backend-tests.sh api_tests::test_create_event
```

### Optional
- **docker-compose** or **docker compose** - For managing Docker services

## Quick Start

### Non-Docker (Local Development)

1. **Make scripts executable** (Unix/Linux/Mac):
   ```bash
   chmod +x scripts/run-*-local.sh
   ```

2. **Set up services** (PostgreSQL, MinIO):
   - See `RUNNING_WITHOUT_DOCKER.md` for detailed setup instructions
   - Ensure PostgreSQL is running and databases are created
   - Start MinIO if needed

3. **Run tests**:
   ```bash
   # Run all tests
   ./scripts/run-all-tests-local.sh

   # Or run individually
   ./scripts/run-backend-tests-local.sh
   ./scripts/run-frontend-tests-local.sh
   ./scripts/run-e2e-tests-local.sh  # Requires services running
   ```

### Docker (CI/CD)

1. **Make scripts executable** (Unix/Linux/Mac):
   ```bash
   chmod +x scripts/run-e2e-tests.sh
   chmod +x scripts/run-e2e-tests.js
   ```

2. **Run tests**:
   ```bash
   # Using shell script
   ./scripts/run-e2e-tests.sh

   # Or using Node.js script
   node scripts/run-e2e-tests.js
   ```

3. **Access Test Runner UI** (development mode):
   - Start frontend: `cd frontend && npm run dev`
   - Navigate to: `http://localhost:5173/test-runner`

## Test Runner UI

The application includes a Test Runner UI page (development mode only) that provides:

- **Visual test execution** - Run tests from the browser
- **Real-time output** - See test output as it runs
- **Test results** - View passed/failed tests with details
- **Backend status** - Monitor backend availability
- **Test suite selection** - Choose which tests to run

**Access:** Navigate to `/test-runner` in development mode

**Note:** The UI is currently a mockup. In production, it would connect to a test runner API service.

## Manual Test Execution

### Without Docker

If you prefer to run tests manually without scripts:

1. **Start services**:
   ```bash
   # PostgreSQL (usually runs as service)
   # MinIO
   minio server ~/minio-data --console-address ":9001"
   ```

2. **Start backend**:
   ```bash
   cd backend
   cargo run
   ```

3. **Start frontend** (for E2E tests):
   ```bash
   cd frontend
   npm run dev
   ```

4. **Run tests** (in another terminal):
   ```bash
   # Backend tests
   cd backend
   cargo test --lib                    # Unit tests
   TEST_DATABASE_URL=... cargo test --test '*'  # Integration tests

   # Frontend tests
   cd frontend
   npm test                    # Unit tests
   npm run test:e2e            # E2E tests
   ```

### With Docker

1. **Start services**:
   ```bash
   docker-compose up -d postgres minio minio-init
   ```

2. **Start backend**:
   ```bash
   cd backend
   cargo run
   ```

3. **Run tests** (in another terminal):
   ```bash
   cd frontend
   npm run test:e2e
   ```

## Troubleshooting

### Backend not starting
- Check if port 8080 is available
- Verify Rust/Cargo is installed: `cargo --version`
- Check backend logs: `/tmp/quiz-backend.log` (shell script) or terminal output

### Docker services not starting
- Verify Docker is running: `docker ps`
- Check Docker Compose: `docker-compose ps`
- Try starting manually: `docker-compose up -d postgres minio minio-init`

### Tests timing out
- Ensure backend is accessible: `curl http://localhost:8080/api/health`
- Check frontend dev server is running (Playwright config starts it automatically)
- Increase timeout in `playwright.config.ts` if needed

### Permission denied (shell script)
- Make script executable: `chmod +x scripts/run-e2e-tests.sh`
- Or use Node.js version: `node scripts/run-e2e-tests.js`

## Integration with CI/CD

These scripts can be integrated into CI/CD pipelines:

```yaml
# Example GitHub Actions workflow
- name: Run E2E Tests
  run: |
    docker-compose up -d postgres minio minio-init
    cd backend && cargo run &
    sleep 10
    cd frontend && npm run test:e2e
```

Or use the scripts directly:

```yaml
- name: Run E2E Tests
  run: ./scripts/run-e2e-tests.sh --skip-setup
```

## Environment Variables

### Non-Docker Scripts

- `TEST_DATABASE_URL` - PostgreSQL connection string for test database
  - Default: `postgres://quiz:quiz@localhost:5432/quiz_test`
  - Used by: `run-backend-tests-local.sh`

- `BACKEND_URL` - Backend URL
  - Default: `http://localhost:8080`
  - Used by: `run-e2e-tests-local.sh`

- `FRONTEND_URL` - Frontend URL
  - Default: `http://localhost:5173`
  - Used by: `run-e2e-tests-local.sh`

### Docker Scripts

- `BACKEND_URL` - Backend URL (default: `http://localhost:8080`)
- `FRONTEND_URL` - Frontend URL (default: `http://localhost:5173`)
- `MAX_WAIT_TIME` - Maximum wait time for services (default: 120 seconds)

## Extending the Scripts

### Adding New Test Suites

Edit `frontend/src/pages/TestRunner.tsx` to add new test suites to the UI.

### Adding Service Checks

Add new service checks in the `checkDockerServices()` or `waitForService()` functions.

### Custom Test Commands

Modify the `runTests()` function to add custom test execution logic.
