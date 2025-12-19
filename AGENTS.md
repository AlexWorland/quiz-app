# Repository Guidelines

## Project Structure & Modules
- `backend/`: Rust (Axum) API. `src/` holds routes, services (AI/transcription/quiz), ws hubs, auth, config/db/error helpers; `migrations/` for SQLx; integration tests in `tests/api_tests.rs`; Dockerfile.* for container builds.
- `frontend/`: React + TypeScript + Vite. `src/` split into `pages/`, `components/`, `hooks/`, `store/` (Zustand), `api/`, `utils/`, `types/`; unit tests live in `__tests__` folders with shared helpers in `src/test`.
- `scripts/` for automation; `work-items/`, `ARCHITECTURE.md`, and `IMPLEMENTATION_GUIDE.md` capture feature plans and rationale.

## Build, Test & Development Commands
- Docker stack: from repo root `docker-compose up -d` (postgres, minio, backend, frontend). `docker-compose down -v` resets volumes; `docker-compose logs -f backend` tails API.
- Backend: `cd backend && cargo build` (compile), `cargo run` (dev server with `.env`), `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`. Migrations via `sqlx migrate run`.
- Frontend: `cd frontend && npm install`; `npm run dev` (Vite), `npm run build` (type-check + bundle), `npm run lint`, `npm run type-check`, `npm run test` or `npm run test:coverage` (Vitest), `npm run test:e2e` (Playwright; start backend + Vite first).

## Coding Style & Naming Conventions
- Rust: format with `cargo fmt`; keep files/modules snake_case; avoid `unwrap` in handlers—propagate errors through `AppError`; prefer tracing spans/logs for request flow.
- TypeScript/React: ESLint + TS strictness gate merges; components/pages PascalCase; hooks in `hooks/` prefixed `use`; tests in `__tests__` alongside features; place shared mocks in `src/test/mocks`. Styling is Tailwind-first; keep primitives in `components/common`.

## Testing Guidelines
- Backend integration tests in `backend/tests/api_tests.rs` using `axum-test`; add helpers to `backend/src/test_utils.rs`.
- Frontend uses Vitest + Testing Library; name specs `*.test.ts[x]` inside `__tests__`. Playwright config lives at `frontend/playwright.config.ts`; ensure services running and data seeded before e2e.
- Target meaningful coverage on new branches; prefer fixtures/mocks over real AI/STT calls.

## Commit & Pull Request Guidelines
- Commits are short, imperative summaries (e.g., `Add presenter handoff API`); group related changes.
- PRs should include scope summary, linked work item/issue, testing notes (commands run), and UI screenshots/video for visible changes.
- Keep secrets out of git; copy `.env.example`, set `JWT_SECRET`, `ENCRYPTION_KEY`, provider keys locally. Highlight new env vars or migrations in PR descriptions.

## Security & Configuration
- Never commit real API keys or JWT secrets; rotate if exposed.
- Prefer `.env` + `docker-compose` for local dev; adjust `VITE_API_URL`/`VITE_WS_URL` if backend port differs.
- For schema changes, run `sqlx migrate run` locally and note DB impacts for reviewers.
