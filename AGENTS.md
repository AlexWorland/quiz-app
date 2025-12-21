# Repository Guidelines

## Project Structure & Module Organization
- `backend/`: Rust (Axum) API, WebSocket hub, services, and SQLx migrations in `backend/migrations/`.
- `frontend/`: React + TypeScript app, page/components in `frontend/src/pages/` and `frontend/src/components/`, shared state in `frontend/src/store/`.
- `scripts/`: helper scripts and docs; `work-items/`: scoped implementation tasks.
- Root docs (`README.md`, `ARCHITECTURE.md`, etc.) describe features and operational notes.

## Build, Test, and Development Commands
- Requirement: run all builds, tests, and local execution via Docker/Docker Compose unless explicitly approved otherwise.
- Tests must use the test Docker files (`docker-compose.test.yml`, `backend/Dockerfile.test`, `frontend/Dockerfile.test`), not the production or dev Dockerfiles.
- Backend tests: `./scripts/run-backend-tests.sh` or `docker compose -f docker-compose.test.yml run --rm --build -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test backend-test cargo test`.
- Frontend unit tests: `docker compose -f docker-compose.test.yml run --rm --build frontend-test npm test -- --run`.
- Frontend E2E tests: `docker compose -f docker-compose.test.yml run --rm --build frontend-test npm run test:e2e`.
- Dev Docker stack: `docker-compose up -d` and `docker-compose down -v` to reset volumes.

## Coding Style & Naming Conventions
- Rust: snake_case modules, prefer `Result` + `?`, avoid `unwrap`, use `AppError`, add tracing spans around request flow.
- TypeScript/React: strict types (no `any`), components/pages PascalCase, hooks `use*`, constants `SCREAMING_SNAKE_CASE`.
- Imports: group std/third-party/local, avoid unused exports, keep paths stable.

## Testing Guidelines
- Keep fixtures deterministic and mock external AI/STT providers.
- Frontend tests live alongside code in `__tests__` and shared mocks in `frontend/src/test/mocks/`.
- Run focused tests with `cargo test path::to_test` or `npm run test -- src/foo.test.ts -t "case"`.

## Commit & Pull Request Guidelines
- Commit messages are short, imperative, and scoped (e.g., “Add…”, “Fix…”, “Update…”).
- PRs should describe the change, list tests run, and note any new env vars or migrations.
- Include screenshots for UI changes and link related work items/issues when available.

## Security & Configuration Tips
- Copy `.env.example` to `.env` and never commit secrets.
- If you add config flags, document them in `README.md` and mention them in the PR.

## Agent-Specific Instructions
- Follow `.cursorrules` and guidance in `.cursor/commands/*` and `CLAUDE.md` when using coding agents.
