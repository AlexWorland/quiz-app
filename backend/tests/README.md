# Backend Test Organization

This directory contains integration tests for the quiz backend. For unit tests, see the inline tests in the `src/` directory.

## Directory Structure

```
tests/
├── integration/        # Integration tests (require database)
│   ├── api_tests.rs
│   ├── auth_routes_test.rs
│   ├── auth_middleware_test.rs
│   ├── quiz_routes_test.rs
│   ├── segment_routes_test.rs
│   └── event_access_test.rs
├── common/            # Shared test utilities
│   └── mod.rs         # Test helper functions
└── README.md          # This file
```

## Test Categories

### Unit Tests (Inline in `src/`)

Pure unit tests are located in their corresponding source files using `#[cfg(test)]` modules:

- **`src/services/crypto.rs`** - Encryption/decryption (9 tests)
- **`src/auth/jwt.rs`** - JWT token generation and validation (11 tests)
- **`src/auth/middleware.rs`** - Authentication middleware (3 tests)
- **`src/error.rs`** - Error response mapping (9 tests)
- **`src/services/scoring.rs`** - Speed-based scoring calculations (3 tests)
- **`src/config.rs`** - Configuration parsing and validation (12+ tests)

Run unit tests with:
```bash
cargo test --lib -- --test-threads=1
```

### Integration Tests (`tests/integration/`)

Integration tests that require a running database:

- **`api_tests.rs`** - Health check and basic API endpoints
- **`auth_routes_test.rs`** - Authentication routes (registration, login, verification)
- **`auth_middleware_test.rs`** - Authentication middleware with request state
- **`quiz_routes_test.rs`** - Quiz gameplay routes and WebSocket integration
- **`segment_routes_test.rs`** - Segment/presenter management
- **`event_access_test.rs`** - Event access control and permissions

Run integration tests with Docker (requires `TEST_DATABASE_URL`):
```bash
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test --test '*'
```

## Running Tests Locally

### Unit Tests Only (No Database Required)
```bash
# Run all unit tests sequentially
cargo test --lib -- --test-threads=1

# Run specific unit test module
cargo test --lib auth::jwt -- --test-threads=1

# Run tests with output
cargo test --lib -- --test-threads=1 --nocapture
```

### Integration Tests (Database Required)

Integration tests require a PostgreSQL database. Use the provided Docker setup:

```bash
# Run all integration tests
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test --test '*'

# Run specific integration test
docker compose -f docker-compose.test.yml run --rm --build \
  -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test \
  backend-test cargo test --test auth_routes_test
```

## Test Utilities

The `tests/common/mod.rs` file provides helper functions for integration tests:

- `create_test_user_with_token()` - Create a test user with JWT token
- `create_test_event()` - Create a test event with join code
- `create_test_segment()` - Create a test segment
- `create_test_question()` - Create a test question
- `create_test_app_state()` - Create app state with dependencies
- `create_test_server()` - Create a test server
- `create_test_server_with_user()` - Create server with pre-authenticated user
- `create_authenticated_request()` - Create authorization headers

## Best Practices

1. **Unit Tests**: Keep unit tests fast, focused, and self-contained
2. **Integration Tests**: Use test helpers from `tests/common/mod.rs`
3. **Test Isolation**: The config tests use a mutex to prevent race conditions when modifying env vars
4. **Database Cleanup**: Integration tests should clean up test data (handled by test database)

## CI/CD

Tests are run in Docker with:
- Unit tests: No external dependencies
- Integration tests: Full database required

See `docker-compose.test.yml` and `backend/Dockerfile.test` for test environment configuration.
