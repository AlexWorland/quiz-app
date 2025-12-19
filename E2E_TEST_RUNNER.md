# E2E Test Runner Documentation

This document describes the end-to-end test runner infrastructure created for the quiz application.

## Overview

The E2E test runner provides multiple ways to run and manage end-to-end tests:

1. **Shell Script** (`scripts/run-e2e-tests.sh`) - Bash script for Unix/Linux/Mac
2. **Node.js Script** (`scripts/run-e2e-tests.js`) - Cross-platform Node.js script
3. **Test Runner UI** (`frontend/src/pages/TestRunner.tsx`) - Web-based test runner interface
4. **NPM Scripts** - Convenient shortcuts in package.json

## Quick Start

### Option 1: Using Shell Script

```bash
# Run all tests (automatically starts services)
./scripts/run-e2e-tests.sh

# Run specific test file
./scripts/run-e2e-tests.sh --file multi-presenter.spec.ts

# Run with browser visible
./scripts/run-e2e-tests.sh --headed
```

### Option 2: Using Node.js Script

```bash
# Run all tests
node scripts/run-e2e-tests.js

# Run specific test file
node scripts/run-e2e-tests.js --file multi-presenter.spec.ts

# Run in interactive UI mode
node scripts/run-e2e-tests.js --ui
```

### Option 3: Using NPM Scripts

```bash
cd frontend

# Run all tests
npm run test:e2e

# Run with Playwright UI
npm run test:e2e:ui

# Run with visible browser
npm run test:e2e:headed

# Use test runner script
npm run test:e2e:runner
```

### Option 4: Using Test Runner UI

1. Start frontend in development mode:
   ```bash
   cd frontend
   npm run dev
   ```

2. Navigate to: `http://localhost:5173/test-runner`

3. Select test suite and click "Run Tests"

## Features

### Automatic Service Management

Both scripts automatically:
- ✅ Check if Docker services are running
- ✅ Start PostgreSQL and MinIO if needed
- ✅ Check if backend is running
- ✅ Start backend server if not running
- ✅ Wait for services to be ready before running tests
- ✅ Provide colored output for better visibility

### Test Runner UI

The web-based test runner provides:
- 📊 Visual test execution interface
- 📈 Real-time test results
- 🔍 Test output log viewer
- 🟢 Backend status monitoring
- 📁 Test suite selection
- ⏹️ Stop test execution
- 🧹 Clear output logs

**Note:** The UI is currently a mockup. In production, it would connect to a test runner API service that executes Playwright tests server-side.

## File Structure

```
quiz-app/
├── scripts/
│   ├── run-e2e-tests.sh          # Shell script test runner
│   ├── run-e2e-tests.js          # Node.js test runner
│   └── README.md                 # Scripts documentation
├── frontend/
│   ├── e2e/
│   │   ├── multi-presenter.spec.ts    # Multi-presenter tests
│   │   ├── fixtures/
│   │   │   ├── auth.ts                # Auth helpers
│   │   │   └── multi-presenter.ts     # Multi-presenter helpers
│   │   └── README.md                  # E2E tests documentation
│   └── src/
│       └── pages/
│           └── TestRunner.tsx         # Test Runner UI component
└── E2E_TEST_RUNNER.md                 # This file
```

## Test Suites

### Available Test Files

- `multi-presenter.spec.ts` - Multi-presenter features (presenter auth, pass presenter, role switching, completion)
- `auth.spec.ts` - Authentication tests
- `event.spec.ts` - Event management tests
- `quiz.spec.ts` - Quiz participation tests
- `navigation.spec.ts` - Navigation tests

### Running Specific Tests

```bash
# Run multi-presenter tests only
./scripts/run-e2e-tests.sh --file multi-presenter.spec.ts

# Or using Node.js
node scripts/run-e2e-tests.js --file multi-presenter.spec.ts

# Or using Playwright directly
cd frontend
npx playwright test multi-presenter.spec.ts
```

## Command Line Options

### Shell Script Options

- `--skip-setup` - Skip starting services (assume they're already running)
- `--file FILE` - Run specific test file
- `--headed` - Run tests in headed mode (show browser)
- `--ui` - Run tests in UI mode (interactive)
- `--help` - Show help message

### Node.js Script Options

Same options as shell script:
- `--skip-setup` - Skip service setup
- `--file FILE` - Run specific test file
- `--headed` - Run in headed mode
- `--ui` - Run in UI mode
- `--help` - Show help

## Prerequisites

### Required Software

1. **Docker** - For PostgreSQL and MinIO services
   ```bash
   docker --version
   ```

2. **Node.js** - For frontend and Playwright
   ```bash
   node --version  # Should be v18+
   ```

3. **Rust/Cargo** - For backend server (if not using Docker)
   ```bash
   cargo --version
   ```

### Optional Software

- **docker-compose** or **docker compose** - For managing Docker services
- **Git** - For version control

## Troubleshooting

### Backend Not Starting

**Problem:** Backend fails to start or times out

**Solutions:**
1. Check if port 8080 is available:
   ```bash
   lsof -i :8080  # Mac/Linux
   netstat -ano | findstr :8080  # Windows
   ```

2. Verify Rust is installed:
   ```bash
   cargo --version
   ```

3. Check backend logs:
   - Shell script: `/tmp/quiz-backend.log`
   - Node.js script: Terminal output
   - Manual: Terminal where `cargo run` was executed

4. Try starting backend manually:
   ```bash
   cd backend
   cargo run
   ```

### Docker Services Not Starting

**Problem:** Docker containers fail to start

**Solutions:**
1. Verify Docker is running:
   ```bash
   docker ps
   ```

2. Check Docker Compose:
   ```bash
   docker-compose ps
   # or
   docker compose ps
   ```

3. Start services manually:
   ```bash
   docker-compose up -d postgres minio minio-init
   ```

4. Check Docker logs:
   ```bash
   docker-compose logs postgres
   ```

### Tests Timing Out

**Problem:** Tests fail with timeout errors

**Solutions:**
1. Verify backend is accessible:
   ```bash
   curl http://localhost:8080/api/health
   ```

2. Check frontend dev server:
   - Playwright config should start it automatically
   - Verify it's running on port 5173

3. Increase timeout in `frontend/playwright.config.ts`:
   ```typescript
   use: {
     timeout: 30000, // Increase from default
   }
   ```

### Permission Denied (Shell Script)

**Problem:** `./scripts/run-e2e-tests.sh: Permission denied`

**Solution:**
```bash
chmod +x scripts/run-e2e-tests.sh
```

Or use Node.js version:
```bash
node scripts/run-e2e-tests.js
```

## CI/CD Integration

### GitHub Actions Example

```yaml
name: E2E Tests

on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_USER: quiz
          POSTGRES_PASSWORD: quiz
          POSTGRES_DB: quiz
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Setup Rust
        uses: actions-rs/toolchain@v1
        with:
          toolchain: stable
      
      - name: Install dependencies
        run: |
          cd frontend && npm ci
          cd ../backend && cargo fetch
      
      - name: Start backend
        run: |
          cd backend
          cargo run &
          sleep 10
        env:
          DATABASE_URL: postgres://quiz:quiz@localhost:5432/quiz
      
      - name: Run E2E tests
        run: |
          cd frontend
          npm run test:e2e
```

### GitLab CI Example

```yaml
e2e-tests:
  image: node:18
  services:
    - postgres:15-alpine
  variables:
    POSTGRES_USER: quiz
    POSTGRES_PASSWORD: quiz
    POSTGRES_DB: quiz
  before_script:
    - apt-get update && apt-get install -y curl
    - curl https://sh.rustup.rs -sSf | sh -s -- -y
    - source $HOME/.cargo/env
  script:
    - cd backend && cargo run &
    - sleep 10
    - cd frontend && npm ci && npm run test:e2e
```

## Future Enhancements

### Planned Features

1. **Test Runner API Service**
   - Backend service to execute Playwright tests server-side
   - WebSocket connection for real-time test output
   - Test result storage and history

2. **Enhanced Test Runner UI**
   - Real test execution (not mockup)
   - Test history and reports
   - Screenshot and video viewing
   - Test debugging tools

3. **Test Parallelization**
   - Run tests in parallel across multiple browsers
   - Distribute tests across multiple machines

4. **Test Coverage Reports**
   - Visual coverage reports
   - Coverage trends over time

5. **Test Scheduling**
   - Schedule tests to run automatically
   - Nightly test runs
   - Test on pull requests

## Contributing

When adding new test suites:

1. Create test file in `frontend/e2e/`
2. Add helper functions to `frontend/e2e/fixtures/` if needed
3. Update `frontend/src/pages/TestRunner.tsx` to include new suite
4. Document in `frontend/e2e/README.md`

## Support

For issues or questions:
- Check `scripts/README.md` for script-specific documentation
- Check `frontend/e2e/README.md` for test-specific documentation
- Review test output logs for detailed error messages

