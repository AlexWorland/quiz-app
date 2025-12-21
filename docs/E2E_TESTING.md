# E2E Testing Guide

This guide covers running end-to-end tests for the quiz application.

## Quick Start

### Automated Testing (Recommended)

The easiest way to run E2E tests is with the automated script that handles everything:

```bash
# Run all E2E tests (starts services, runs tests, cleans up)
./scripts/run-e2e-tests-automated.sh
```

This script will:
1. Start the backend server
2. Start the frontend dev server
3. Wait for both services to be ready
4. Run all E2E tests
5. Automatically stop services and clean up

### Manual Testing

If you prefer manual control over services:

**Terminal 1 - Backend:**
```bash
cd backend
cargo run
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

**Terminal 3 - E2E Tests:**
```bash
./scripts/run-e2e-tests-local.sh
```

## Script Options

### Automated Script (`run-e2e-tests-automated.sh`)

```bash
# Run with all defaults
./scripts/run-e2e-tests-automated.sh

# Use existing backend (don't start a new one)
./scripts/run-e2e-tests-automated.sh --skip-backend

# Use existing frontend (don't start a new one)
./scripts/run-e2e-tests-automated.sh --skip-frontend

# Keep services running after tests complete
./scripts/run-e2e-tests-automated.sh --keep-running

# Show help
./scripts/run-e2e-tests-automated.sh --help
```

**Logs are written to:**
- Backend: `/tmp/backend-e2e.log`
- Frontend: `/tmp/frontend-e2e.log`

### Manual Script (`run-e2e-tests-local.sh`)

```bash
# Run all E2E tests
./scripts/run-e2e-tests-local.sh

# Run specific test file
./scripts/run-e2e-tests-local.sh --file e2e/auth.spec.ts

# Run with visible browser (headed mode)
./scripts/run-e2e-tests-local.sh --headed

# Run in interactive UI mode
./scripts/run-e2e-tests-local.sh --ui

# Skip service checks (assumes services are running)
./scripts/run-e2e-tests-local.sh --skip-checks
```

## Environment Variables

Both scripts support these environment variables for custom port configuration:

```bash
# Custom backend port (if 8080 is already in use)
BACKEND_URL=http://localhost:3000 ./scripts/run-e2e-tests-automated.sh

# Custom frontend port
FRONTEND_URL=http://localhost:3001 ./scripts/run-e2e-tests-automated.sh

# Custom API URL for tests (automatically derived from BACKEND_URL if not set)
VITE_API_URL=http://localhost:3000/api ./scripts/run-e2e-tests-automated.sh

# Combine multiple environment variables
BACKEND_URL=http://localhost:3000 FRONTEND_URL=http://localhost:3001 ./scripts/run-e2e-tests-automated.sh
```

### Default Ports

- Backend: `8080`
- Frontend: `5173`
- API: `<BACKEND_URL>/api`

## Test Coverage

The E2E test suite covers:

| Test Suite | File | Coverage |
|-----------|------|----------|
| **Authentication** | `frontend/e2e/auth.spec.ts` | Login, registration, logout, navigation |
| **Navigation** | `frontend/e2e/navigation.spec.ts` | Basic navigation, 404 handling |
| **Event Management** | `frontend/e2e/event.spec.ts` | Event creation, browsing, management |
| **Quiz Participation** | `frontend/e2e/quiz.spec.ts` | Quiz participation flows |

## Prerequisites

### Required
- ✅ Node.js and npm installed
- ✅ Rust and Cargo installed
- ✅ PostgreSQL running with `quiz` database
- ✅ Playwright browsers installed

### Optional
- MinIO running (for avatar upload tests)

### Installing Playwright Browsers

If Playwright browsers aren't installed:

```bash
cd frontend
npx playwright install --with-deps chromium
```

## Troubleshooting

### Port Already in Use

If you see "address already in use" errors:

```bash
# Check what's using the ports
lsof -ti:8080  # Backend
lsof -ti:5173  # Frontend

# Kill processes on those ports
lsof -ti:8080 | xargs kill -9
lsof -ti:5173 | xargs kill -9
```

### Backend Won't Start

Check the logs:
```bash
tail -f /tmp/backend-e2e.log
```

Common issues:
- Database not running
- Missing `.env` file (should be created automatically by startup scripts)
- Port 8080 already in use

### Frontend Won't Start

Check the logs:
```bash
tail -f /tmp/frontend-e2e.log
```

Common issues:
- Dependencies not installed (`npm install`)
- Port 5173 already in use

### Tests Fail to Connect

Verify services are accessible:
```bash
# Check backend
curl http://localhost:8080/api/health

# Check frontend
curl http://localhost:5173
```

### Playwright Browser Issues

Reinstall browsers:
```bash
cd frontend
npx playwright install --force --with-deps chromium
```

## Continuous Integration

For CI/CD pipelines, use Docker mode:

```bash
# Run tests in Docker (includes all dependencies)
docker-compose -f docker-compose.test.yml run --rm frontend-test npm run test:e2e
```

## Development Workflow

### Running Specific Tests During Development

```bash
# Run just auth tests with visible browser
./scripts/run-e2e-tests-local.sh --file e2e/auth.spec.ts --headed

# Run in UI mode for debugging
./scripts/run-e2e-tests-local.sh --ui
```

### Keeping Services Running

When actively developing, keep services running and only run tests:

**Terminal 1 (leave running):**
```bash
cd backend && cargo run
```

**Terminal 2 (leave running):**
```bash
cd frontend && npm run dev
```

**Terminal 3 (run as needed):**
```bash
./scripts/run-e2e-tests-local.sh --skip-checks
```

Or use the automated script with skip flags:
```bash
./scripts/run-e2e-tests-automated.sh --skip-backend --skip-frontend
```

## Performance Tips

- **Use `--skip-checks`** if you know services are running
- **Use specific test files** during development instead of full suite
- **Use headless mode** (default) for faster execution
- **Keep services running** between test runs during active development

## Next Steps

- Add more E2E test coverage for new features
- Configure CI/CD pipeline to run E2E tests
- Set up test result reporting
- Add visual regression testing
