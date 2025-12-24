#!/bin/bash

# Stop local development services

echo "Stopping local development services..."

# Kill backend
if [ -f /tmp/quiz-backend.pid ]; then
    BACKEND_PID=$(cat /tmp/quiz-backend.pid)
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "Stopping backend (PID: $BACKEND_PID)..."
        kill $BACKEND_PID
        rm /tmp/quiz-backend.pid
    fi
fi

# Kill frontend
if [ -f /tmp/quiz-frontend.pid ]; then
    FRONTEND_PID=$(cat /tmp/quiz-frontend.pid)
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "Stopping frontend (PID: $FRONTEND_PID)..."
        kill $FRONTEND_PID
        rm /tmp/quiz-frontend.pid
    fi
fi

# Also kill any uvicorn or vite processes on our ports
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:5173 | xargs kill -9 2>/dev/null || true

echo "✅ All services stopped"

