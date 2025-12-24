# e2e2: Run Locally Without Docker

Minimal steps to run the new e2e2 auth tests against the local Python backend and a local Postgres instance.

## Prerequisites
- Local PostgreSQL reachable on `localhost:5432`.
- Python venv already set up in `backend-python/venv` with project dependencies installed.

## One-time database prep
```bash
# Create role and database (adjust if your psql defaults differ)
psql -d postgres <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'quiz') THEN
    CREATE ROLE quiz LOGIN PASSWORD 'quiz';
  END IF;
END$$;
SQL

psql -d postgres <<'SQL'
SELECT 'CREATE DATABASE quiz_test OWNER quiz'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'quiz_test')\gexec
SQL

# Create tables using the Python models (from repo root)
cd backend-python
source venv/bin/activate
DATABASE_URL=postgresql+asyncpg://quiz:quiz@localhost:5432/quiz_test python - <<'PY'
import asyncio
from app import models  # register models
from app.database import init_db
asyncio.run(init_db())
PY
```

## Start the backend locally
```bash
cd backend-python
source venv/bin/activate
DATABASE_URL=postgresql+asyncpg://quiz:quiz@localhost:5432/quiz_test \
uvicorn app.main:app --host 0.0.0.0 --port 8080
```

## Run the e2e2 auth suite against the live backend
```bash
cd frontend
E2E2_USE_REAL_API=true \
E2E2_API_URL=http://localhost:8080 \
E2E2_BASE_URL=http://localhost:4174 \
E2E2_WEB_COMMAND="VITE_API_URL=http://localhost:8080 VITE_WS_URL=ws://localhost:8080 npm run dev -- --host 0.0.0.0 --port 4174" \
npm run test:e2e2:local:serve
```

## Notes
- The auth tests seed users via the real API; no mocks when `E2E2_USE_REAL_API=true`.
- Backend health check: `curl http://localhost:8080/api/health`.
- If Postgres auth differs on your machine, adjust the connection string above.***

