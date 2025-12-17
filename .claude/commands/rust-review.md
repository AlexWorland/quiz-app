---
allowed-tools: Bash(cargo clippy:*), Bash(cargo test:*), Bash(cargo check:*)
argument-hint: [optional: focus-area]
description: Review Rust backend code for security and best practices
---

# Rust Backend Code Review

Review the Rust backend code for this quiz application. Focus on $ARGUMENTS if specified, otherwise review all areas.

## Current Status
!`cd backend && cargo check 2>&1 | head -20`

## Areas to Check
1. **Safety & Security**
   - SQL injection vulnerabilities (ensure SQLx parameterized queries)
   - JWT token handling and validation
   - Password hashing with argon2
   - API key encryption for user AI settings

2. **Async/Concurrency**
   - Proper use of tokio async patterns
   - WebSocket connection handling and cleanup
   - Deadlock potential in shared state (Arc<Mutex<>>)
   - Channel usage for message broadcasting

3. **Error Handling**
   - Consistent error types and propagation
   - Proper HTTP status codes
   - User-friendly error messages
   - Logging of internal errors

4. **Axum Best Practices**
   - Proper use of extractors
   - Middleware ordering
   - State management
   - Route organization

5. **Database**
   - SQLx query correctness
   - Transaction handling
   - Connection pool configuration
   - Migration compatibility

## What to Review
Review recent changes in the `backend/` directory.

Provide specific, actionable feedback with file paths and line numbers.
