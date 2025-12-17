---
allowed-tools: Bash(cargo test:*), Bash(npm test:*), Bash(npm run test:*)
argument-hint: [optional: backend|frontend|all]
description: Run tests for backend and/or frontend
---

# Run Tests

Run tests for the quiz application. Specify $ARGUMENTS to run specific tests.

## Backend Tests (Rust)
!`cd backend && cargo test 2>&1 | tail -30`

## Frontend Tests (React)
!`cd frontend && npm test -- --run 2>&1 | tail -30`

## Test Coverage Areas
### Backend
- Unit tests for services (scoring, AI integration)
- API endpoint tests
- WebSocket message handling
- Database queries

### Frontend
- Component rendering tests
- Hook behavior tests
- Store state management
- WebSocket mock tests

## Running Specific Tests
- Backend only: `cargo test -p backend`
- Frontend only: `npm test`
- Single test: `cargo test test_name` or `npm test -- -t "test name"`

## If Tests Fail
1. Check the error message for the failing test
2. Verify database is running for integration tests
3. Ensure environment variables are set
4. Review recent code changes that may have broken tests
