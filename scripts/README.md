# Test Runner Scripts

This directory contains scripts for running end-to-end tests with automatic service management.

## Available Scripts

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

### Required
- **Docker** - For running PostgreSQL and MinIO services
- **Node.js** - For running frontend and Playwright tests
- **Rust/Cargo** - For running backend server (if not using Docker)

### Optional
- **docker-compose** or **docker compose** - For managing Docker services

## Quick Start

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

If you prefer to run tests manually without the scripts:

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

The scripts respect these environment variables:

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

