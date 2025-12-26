Test run notes (Docker)
=======================

- Backend: `docker compose run --rm -e TEST_DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz_test backend cargo test`
  - Unit tests passed.
  - Integration tests in `backend/tests/api_tests.rs` failed on `test_create_event` (HTTP 500). The route expects `Extension<AuthUser>`, but the test app wiring does not inject auth, so the handler receives no user.

- Frontend unit tests: `docker compose run --rm frontend npm run test -- --exclude="e2e/**"`
  - 42 files / 462 tests passed.
  - Warnings only (getUserMedia permission denied in `useAudioWebSocket`, duplicate emoji keys & act() warnings in `AvatarSelector`, MSW interceptor tests skipped, misc act() warnings in canvas/online status tests).

- E2E tests: `docker compose exec frontend npm run test:e2e`
  - All Playwright specs failed immediately: missing browser binaries (`browserType.launch: Executable doesn't exist … run npx playwright install`). Container also logs “Docker is not installed or not in PATH,” but services were already running; the blocker is the missing Playwright browsers.

- Current containers: `quiz-backend`, `quiz-frontend` (VITE_API_URL/WS_URL pointing to backend:8080), `quiz-postgres`, `quiz-minio` are up and healthy.

Next steps
----------
1) Add auth middleware or otherwise supply `AuthUser` for `/api/quizzes` in the test router so `test_create_event` passes, then rerun backend tests.
2) Install Playwright browsers in the frontend container (`docker compose exec frontend npx playwright install --with-deps`) or run e2e from a host with browsers available, then rerun `npm run test:e2e`.
