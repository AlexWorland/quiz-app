# GitHub Workflows Updated for GPT-5.2 and Python Backend

## Overview

Completely rewrote GitHub Actions workflows to support the Python FastAPI backend, GPT-5.2 batch question generation, and comprehensive test coverage.

## Workflows Updated

### 1. `.github/workflows/ci.yml` - Continuous Integration

**Runs on:** Every push and pull request to `main`

#### Jobs

##### Job 1: Backend Unit Tests (Python)
- **Runtime:** Python 3.11 with PostgreSQL 15
- **System Dependencies:** ffmpeg (for AudioCombiner)
- **Python Dependencies:** All requirements + pytest suite
- **Database Migration:** Runs migration for questions_to_generate column
- **Tests:** All backend unit tests with coverage
- **Coverage:** Uploads to Codecov

**Key Changes from Old Workflow:**
- ❌ Removed: Rust toolchain, cargo commands
- ✅ Added: Python 3.11 setup
- ✅ Added: ffmpeg installation
- ✅ Added: Database migration step
- ✅ Added: Coverage reporting

##### Job 2: Frontend Build & Lint
- **Runtime:** Node.js 20
- **Tasks:** Type checking, linting, build verification
- **No changes from original** (already correct)

##### Job 3: Frontend Unit Tests
- **Runtime:** Node.js 20
- **Tests:** Vitest unit tests with coverage
- **Coverage:** Uploads coverage artifacts

**Key Changes:**
- ✅ Updated: Use `npm test -- --run` for CI mode

---

### 2. `.github/workflows/e2e.yml` - End-to-End Tests

**Runs on:** Every push and pull request to `main`

#### Jobs

##### Job 1: E2E Tests (Basic)
- **Runtime:** Node.js 20 with Playwright
- **Tests:** Basic E2E tests (no backend required)
- **Browser:** Chromium only
- **Uploads:** Playwright report and test results

**No backend changes** - runs frontend-only tests

##### Job 2: E2E2 Tests (Full - with Backend)
- **Runs on:** Push to main only (not PRs - too expensive)
- **Timeout:** 45 minutes
- **Services:** PostgreSQL, MinIO
- **Backend:** Python FastAPI with all dependencies

**Complete Setup:**
1. PostgreSQL service for database
2. MinIO service for object storage
3. Python 3.11 with ffmpeg
4. Install all backend dependencies
5. Initialize MinIO buckets (avatars, audio-chunks)
6. Run database migration
7. Start backend server (port 8080)
8. Install frontend dependencies
9. Install Playwright browsers
10. Run E2E2 tests
11. Upload reports

**Key Environment Variables:**
- `OPENAI_API_KEY`: From GitHub secrets
- `OPENAI_MODEL`: gpt-5.2-thinking
- `DEFAULT_AI_PROVIDER`: openai
- All required service credentials

**Key Changes from Old Workflow:**
- ❌ Removed: Rust backend build
- ✅ Added: Python backend with uvicorn
- ✅ Added: ffmpeg installation
- ✅ Added: MinIO bucket initialization
- ✅ Added: Database migration
- ✅ Added: OpenAI configuration
- ✅ Added: E2E2 test execution

##### Job 3: Docker Integration Tests
- **Runs on:** Push to main only
- **Purpose:** Verify Docker Compose test setup works
- **Tests:** Both backend and frontend tests via Docker

**Steps:**
1. Build test images
2. Run backend tests in container
3. Run frontend tests in container
4. Cleanup volumes

---

## Environment Variables & Secrets

### Required GitHub Secrets

Add these in your repository settings (Settings → Secrets and variables → Actions):

```
OPENAI_API_KEY=sk-proj-...           # Required for GPT-5.2 question generation
ANTHROPIC_API_KEY=sk-ant-...         # Optional: Claude fallback
DEEPGRAM_API_KEY=...                 # Optional: For transcription tests
```

### How to Add Secrets

1. Go to: https://github.com/AlexWorland/quiz-app/settings/secrets/actions
2. Click "New repository secret"
3. Add each secret with the name and value

---

## Test Coverage Matrix

| Test Type | Workflow | Job | When Runs | Duration |
|-----------|----------|-----|-----------|----------|
| Backend Unit | `ci.yml` | backend-unit-tests | All pushes/PRs | ~2 min |
| Frontend Unit | `ci.yml` | frontend-unit-tests | All pushes/PRs | ~2 min |
| Frontend Build | `ci.yml` | frontend-build | All pushes/PRs | ~2 min |
| E2E Basic | `e2e.yml` | e2e-tests | All pushes/PRs | ~5 min |
| E2E2 Full | `e2e.yml` | e2e2-tests-full | Push to main only | ~15 min |
| Docker Tests | `e2e.yml` | docker-integration-tests | Push to main only | ~10 min |

**Total for PR:** ~11 minutes (4 jobs)  
**Total for main push:** ~36 minutes (6 jobs)

---

## What Gets Tested

### Backend Unit Tests (9 tests)
- ✅ OpenAI batch question generation
- ✅ GPT-5.2-thinking model configuration
- ✅ Question generation helper function
- ✅ Fallback to chunking mode
- ✅ Provider selection logic
- ✅ Error handling

### Frontend Unit Tests
- ✅ Component rendering
- ✅ State management
- ✅ API integration
- ✅ Form validation
- ✅ Auth flows

### E2E Tests (Basic)
- ✅ Navigation
- ✅ Authentication UI
- ✅ Basic component interactions

### E2E2 Tests (Full - 7 tests)
- ✅ Event creation with questions_to_generate
- ✅ EventSettings modal functionality
- ✅ Input validation (1-20 range)
- ✅ Batch question generation
- ✅ Chunked upload with generation
- ✅ Settings persistence
- ✅ Full user flows

### Docker Integration Tests
- ✅ Backend tests in Docker
- ✅ Frontend tests in Docker
- ✅ Image builds successfully

---

## Migration Strategy

### Database Migration in CI

The workflows now run the migration automatically:

```python
# Runs in backend-unit-tests and e2e2-tests-full jobs
ALTER TABLE events 
ADD COLUMN IF NOT EXISTS questions_to_generate INTEGER DEFAULT 5
```

This ensures the test database has the correct schema.

---

## Key Improvements

### Before (Old Workflows)
- ❌ Used Rust backend (outdated)
- ❌ No backend unit tests
- ❌ No E2E2 tests
- ❌ No Docker integration tests
- ❌ Missing AI provider configuration
- ❌ No migration support

### After (New Workflows)
- ✅ Uses Python FastAPI backend
- ✅ Backend unit tests with coverage (9 tests)
- ✅ E2E2 tests with full backend (7 tests)
- ✅ Docker integration testing
- ✅ GPT-5.2 configuration
- ✅ Automatic database migration
- ✅ Audio processing support (ffmpeg)
- ✅ MinIO bucket initialization

---

## Workflow Triggers

### ci.yml
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**Runs:** On every push and PR to main

### e2e.yml
```yaml
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
```

**Basic E2E:** On every push/PR  
**Full E2E2:** Only on push to main (not PRs - saves CI time)  
**Docker Tests:** Only on push to main

---

## Cost Optimization

### PR Workflow (Fast & Cheap)
Runs only essential tests:
- Backend unit tests (~2 min)
- Frontend unit tests (~2 min)
- Frontend build (~2 min)
- Basic E2E tests (~5 min)

**Total:** ~11 minutes

### Main Push Workflow (Comprehensive)
Runs all tests including:
- All PR tests
- Full E2E2 with backend (~15 min)
- Docker integration tests (~10 min)

**Total:** ~36 minutes

This strategy saves CI credits on PRs while ensuring full coverage on main.

---

## Artifacts Uploaded

### On Success
- `coverage-report` - Backend coverage (7 days)
- `frontend-coverage` - Frontend coverage (7 days)

### On Failure
- `playwright-report-basic` - Basic E2E results
- `playwright-report-e2e2` - Full E2E2 results
- `test-results-basic` - Screenshots/videos
- `test-results-e2e2` - Screenshots/videos

---

## Required Secrets

For full test coverage, configure these GitHub secrets:

| Secret | Required | Used For |
|--------|----------|----------|
| `OPENAI_API_KEY` | Yes | GPT-5.2 question generation, Whisper transcription |
| `ANTHROPIC_API_KEY` | Optional | Claude fallback tests |
| `DEEPGRAM_API_KEY` | Optional | Speech-to-text tests |
| `ASSEMBLYAI_API_KEY` | Optional | Alternative STT tests |

**Note:** Without `OPENAI_API_KEY`, E2E2 tests will skip actual question generation but still test UI/API structure.

---

## Running Locally vs CI

### Local Development
```bash
# Backend tests
cd backend-python
pytest -v

# Frontend tests
cd frontend
npm test

# E2E2 tests
npm run test:e2e2:local:serve
```

### CI Environment
- Uses GitHub Actions runners
- Services run in containers
- Environment variables from secrets
- Artifacts uploaded automatically
- Parallel job execution

---

## Troubleshooting

### If Backend Tests Fail
1. Check PostgreSQL service is healthy
2. Verify migration ran successfully
3. Check DATABASE_URL format (postgresql+asyncpg://)
4. Ensure ffmpeg is installed

### If E2E2 Tests Fail
1. Verify backend started successfully
2. Check MinIO buckets were created
3. Ensure OPENAI_API_KEY secret is set
4. Review Playwright screenshots in artifacts

### If Docker Tests Fail
1. Check Docker Compose builds
2. Verify test.yml has correct context paths
3. Ensure all environment variables are set

---

## Summary

| Aspect | Before | After | Status |
|--------|--------|-------|--------|
| Backend | Rust (outdated) | Python FastAPI | ✅ Updated |
| Backend Tests | None in CI | 9 unit tests | ✅ Added |
| Frontend Tests | Basic only | Unit + E2E + E2E2 | ✅ Enhanced |
| E2E2 Tests | None | 7 comprehensive | ✅ Added |
| Docker Tests | None | Full integration | ✅ Added |
| AI Provider | Not configured | GPT-5.2 ready | ✅ Configured |
| Audio Processing | Not supported | ffmpeg included | ✅ Added |
| Coverage | None | Backend + Frontend | ✅ Reporting |

**Result:** Comprehensive CI/CD pipeline testing all aspects of GPT-5.2 batch question generation feature!

