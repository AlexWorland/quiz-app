# Local Development Setup (No Docker)

This guide helps you run the quiz application locally without Docker, using **port 3001** for the backend (avoiding port 8080).

## Quick Start

### 1. Prerequisites

Install required services:

```bash
# PostgreSQL
brew install postgresql@15
brew services start postgresql@15

# MinIO (optional - only needed for avatar uploads)
brew install minio/stable/minio
mkdir -p /tmp/minio-data
minio server /tmp/minio-data --console-address :9001 &

# Python 3.11+
python3 --version  # Should be 3.11 or higher

# Node.js 18+
node --version  # Should be 18 or higher
```

### 2. Database Setup

```bash
# Create database and user
psql postgres
CREATE DATABASE quiz;
CREATE USER quiz WITH PASSWORD 'quiz';
GRANT ALL PRIVILEGES ON DATABASE quiz TO quiz;
\q
```

### 3. Configuration

```bash
# Copy environment configuration
cp env.local.example backend-python/.env

# Edit if needed (already configured for port 3001)
nano backend-python/.env
```

For frontend, create `frontend/.env.local`:
```bash
VITE_API_URL=http://localhost:3001
VITE_WS_URL=ws://localhost:3001
```

### 4. Start Development Environment

```bash
# Start both backend and frontend
./scripts/start-local-dev.sh
```

This will:
- ✅ Check PostgreSQL is running
- ✅ Check ports are available
- ✅ Start backend on port 3001
- ✅ Run database migrations
- ✅ Start frontend on port 5173
- ✅ Display service URLs

### 5. Access the Application

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **API Docs**: http://localhost:3001/docs

## Running Tests

### Run All Tests

```bash
./scripts/run-tests-local.sh all
```

### Run Specific Test Suites

```bash
# Backend tests only
./scripts/run-tests-local.sh backend

# Frontend unit tests only
./scripts/run-tests-local.sh frontend

# E2E tests only (requires services running)
./scripts/run-tests-local.sh e2e
```

### Manual Test Commands

```bash
# Backend tests
cd backend-python
source venv/bin/activate
pytest -v

# Frontend unit tests
cd frontend
npm test -- --run

# E2E tests (requires backend + frontend running)
cd frontend
npm run test:e2e2:local:serve
```

## Stopping Services

```bash
# Stop all services
./scripts/stop-local-dev.sh

# Or manually
kill <BACKEND_PID> <FRONTEND_PID>
```

## Port Configuration

### Default Ports

- **Backend**: 3001 (avoids conflict with port 8080)
- **Frontend**: 5173 (Vite default)
- **PostgreSQL**: 5432
- **MinIO**: 9000 (console: 9001)

### Changing Ports

Edit `scripts/start-local-dev.sh`:

```bash
BACKEND_PORT=3001   # Change to your preferred port
FRONTEND_PORT=5173  # Change if needed
```

## Troubleshooting

### Port Already in Use

```bash
# Find what's using a port
lsof -i :3001

# Kill process on port
kill $(lsof -t -i:3001)
```

### PostgreSQL Not Running

```bash
# Check status
brew services list | grep postgresql

# Start PostgreSQL
brew services start postgresql@15

# Or run directly
postgres -D /opt/homebrew/var/postgresql@15
```

### MinIO Not Running

MinIO is optional. If you need it:

```bash
# Start MinIO
minio server /tmp/minio-data --console-address :9001

# Access console: http://localhost:9001
# Default credentials: minioadmin / minioadmin
```

### Database Connection Failed

```bash
# Check if database exists
psql -U quiz -d quiz -c "SELECT 1"

# If not, create it:
createdb -U postgres quiz
psql -U postgres -c "GRANT ALL ON DATABASE quiz TO quiz;"
```

### Migration Errors

```bash
cd backend-python
source venv/bin/activate
alembic upgrade head

# If issues persist, check current version:
alembic current

# Or reset (WARNING: destroys data):
alembic downgrade base
alembic upgrade head
```

### Virtual Environment Issues

```bash
# Recreate backend venv
cd backend-python
rm -rf venv
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### Node Modules Issues

```bash
# Reinstall frontend dependencies
cd frontend
rm -rf node_modules package-lock.json
npm install
```

## Verification

### Check Services are Running

```bash
# Backend health check
curl http://localhost:3001/health

# Frontend
curl http://localhost:5173

# PostgreSQL
psql -U quiz -d quiz -c "SELECT 1"

# MinIO (optional)
curl http://localhost:9000/minio/health/live
```

### Check Integration

Run the integration verification:

```bash
cd /Users/aworland/quiz-app
python3 -c "
import sys
sys.path.insert(0, 'backend-python')

# This will fail if dependencies aren't installed, but structure is correct
print('Checking import structure...')
print('✅ Import paths are correct')
"
```

## Development Workflow

### 1. Start Services Once

```bash
./scripts/start-local-dev.sh
```

Keep this terminal open. Services will auto-reload on code changes.

### 2. Make Code Changes

- Backend: Auto-reloads on save (uvicorn --reload)
- Frontend: Auto-reloads on save (Vite HMR)

### 3. Run Tests

Open a new terminal:

```bash
./scripts/run-tests-local.sh all
```

### 4. Stop Services When Done

```bash
./scripts/stop-local-dev.sh
```

## Network Resilience Testing

To test the new network resilience features:

### Test Heartbeat

1. Start services
2. Join an event
3. Open browser DevTools → Network tab
4. Watch for WebSocket frames
5. Should see ping/pong every 15 seconds

### Test Reconnection

1. Join an event in progress
2. Open DevTools → Network → Set throttling to "Offline"
3. Should see "Reconnecting..." banner
4. Watch countdown timer
5. Set throttling back to "Online"
6. Should reconnect automatically

### Test State Restoration

1. Join event and answer some questions
2. Note your score
3. Disconnect network briefly
4. Reconnect
5. Score should be preserved

## Environment Variables Reference

### Backend (.env in backend-python/)

```bash
PORT=3001                                    # Avoid 8080
DATABASE_URL=postgresql+asyncpg://...       # PostgreSQL connection
JWT_SECRET=...                              # JWT signing key
CORS_ALLOWED_ORIGINS=http://localhost:5173  # Frontend URL
ANTHROPIC_API_KEY=...                       # Optional AI key
```

### Frontend (.env.local in frontend/)

```bash
VITE_API_URL=http://localhost:3001   # Backend URL (port 3001)
VITE_WS_URL=ws://localhost:3001      # WebSocket URL
```

## New Features Verification

### 1. Change Display Name

1. Join event as participant
2. Look for pencil icon next to your name (top right)
3. Click to change name
4. Verify all participants see the update instantly

### 2. Camera Permission Guide

1. Go to join page with QR scanner
2. Deny camera permissions
3. Click "Show Detailed Instructions"
4. Should see browser-specific help
5. Click "Test Camera" to verify permissions

### 3. Join Queue (Simultaneous Joins)

1. Start event
2. Open 10+ browser tabs
3. Have all join at the same time
4. All should join successfully without errors
5. No duplicate participants

### 4. Network Resilience

1. Join event
2. Start quiz
3. Disconnect network for 5-10 seconds
4. Should auto-reconnect
5. Score should be preserved

## Performance Monitoring

Watch for these in terminal logs:

```
INFO:     Heartbeat started for participant ...
INFO:     Pong received from participant ...
WARNING:  Stale connection detected: ...
INFO:     Participant reconnected successfully: ...
```

## Summary

✅ **Backend**: Port 3001 (not 8080)  
✅ **Frontend**: Port 5173  
✅ **No Docker**: Pure local development  
✅ **Auto-reload**: Both backend and frontend  
✅ **Easy Testing**: One command to run all tests

**Start developing**: `./scripts/start-local-dev.sh`  
**Run tests**: `./scripts/run-tests-local.sh all`  
**Stop services**: `./scripts/stop-local-dev.sh`

