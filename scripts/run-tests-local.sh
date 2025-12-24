#!/bin/bash

# Run tests with local development environment (no Docker)
# Usage: ./scripts/run-tests-local.sh [backend|frontend|e2e|all]

set -e

BACKEND_PORT=3001
FRONTEND_PORT=5173

# Parse arguments
TEST_TYPE="${1:-all}"

echo "============================================================"
echo "Local Test Runner (No Docker, Port $BACKEND_PORT)"
echo "============================================================"
echo ""

# Check if services are running
BACKEND_RUNNING=false
FRONTEND_RUNNING=false

if lsof -Pi :$BACKEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    BACKEND_RUNNING=true
    echo "✅ Backend is already running on port $BACKEND_PORT"
else
    echo "⚠️  Backend is not running on port $BACKEND_PORT"
fi

if lsof -Pi :$FRONTEND_PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    FRONTEND_RUNNING=true
    echo "✅ Frontend is already running on port $FRONTEND_PORT"
else
    echo "⚠️  Frontend is not running on port $FRONTEND_PORT"
fi

echo ""

# Start services if needed for E2E tests
if [ "$TEST_TYPE" = "e2e" ] || [ "$TEST_TYPE" = "all" ]; then
    if [ "$BACKEND_RUNNING" = false ] || [ "$FRONTEND_RUNNING" = false ]; then
        echo "E2E tests require both backend and frontend running."
        echo "Starting services..."
        echo ""
        
        # Start services
        ./scripts/start-local-dev.sh &
        START_SCRIPT_PID=$!
        
        # Wait for services to be ready
        echo "Waiting for services to start..."
        sleep 5
        
        # Check if they're up
        for i in {1..30}; do
            if curl -s http://localhost:$BACKEND_PORT/health > /dev/null 2>&1 && \
               curl -s http://localhost:$FRONTEND_PORT > /dev/null 2>&1; then
                echo "✅ Both services are ready"
                SERVICES_STARTED=true
                break
            fi
            sleep 2
        done
        
        if [ "$SERVICES_STARTED" != true ]; then
            echo "❌ Failed to start services"
            exit 1
        fi
    fi
fi

# Set environment variables
export PORT=$BACKEND_PORT
export VITE_API_URL="http://localhost:$BACKEND_PORT"
export VITE_WS_URL="ws://localhost:$BACKEND_PORT"
export E2E2_API_URL="http://localhost:$BACKEND_PORT"
export DATABASE_URL="postgresql+asyncpg://quiz:quiz@localhost:5432/quiz_test"

echo ""
echo "============================================================"
echo "Running Tests: $TEST_TYPE"
echo "============================================================"
echo ""

case "$TEST_TYPE" in
    backend)
        echo "Running backend tests..."
        cd backend-python
        source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
        pip install -q -r requirements.txt
        pytest -v
        ;;
        
    frontend)
        echo "Running frontend unit tests..."
        cd frontend
        npm test -- --run
        ;;
        
    e2e)
        echo "Running E2E tests..."
        cd frontend
        npm run test:e2e2:local:serve
        ;;
        
    all)
        echo "Running all tests..."
        echo ""
        echo "--- Backend Tests ---"
        cd backend-python
        source venv/bin/activate 2>/dev/null || python3 -m venv venv && source venv/bin/activate
        pip install -q -r requirements.txt
        pytest -v
        cd ..
        
        echo ""
        echo "--- Frontend Unit Tests ---"
        cd frontend
        npm test -- --run
        
        echo ""
        echo "--- E2E Tests ---"
        npm run test:e2e2:local:serve
        cd ..
        ;;
        
    *)
        echo "❌ Invalid test type: $TEST_TYPE"
        echo "Usage: $0 [backend|frontend|e2e|all]"
        exit 1
        ;;
esac

echo ""
echo "============================================================"
echo "✅ Tests Complete"
echo "============================================================"

