#!/usr/bin/env bash

# Local Development Startup Script (No Docker)
# Starts PostgreSQL verification, backend, and frontend services

set -e

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_PORT=${BACKEND_PORT:-8080}
FRONTEND_PORT=${FRONTEND_PORT:-5173}
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-quiz}
DB_PASS=${DB_PASS:-quiz}
DB_NAME=${DB_NAME:-quiz}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend-python"
FRONTEND_DIR="${ROOT_DIR}/frontend"

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo ""
}

# Check if PostgreSQL is running
check_postgres() {
    print_info "Checking PostgreSQL connection..."

    if ! command -v pg_isready &> /dev/null; then
        print_error "pg_isready command not found"
        print_info "Install PostgreSQL: brew install postgresql@15"
        return 1
    fi

    if pg_isready -h "$DB_HOST" -p "$DB_PORT" > /dev/null 2>&1; then
        print_success "PostgreSQL is running on $DB_HOST:$DB_PORT"
        return 0
    else
        print_error "PostgreSQL is not running on $DB_HOST:$DB_PORT"
        print_info "Start PostgreSQL: brew services start postgresql@15"
        return 1
    fi
}

# Check if database exists, create if not
ensure_database() {
    print_info "Checking database '$DB_NAME'..."

    local db_exists=$(PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "0")

    if [ "$db_exists" = "1" ]; then
        print_success "Database '$DB_NAME' exists"
    else
        print_info "Creating database '$DB_NAME'..."
        PGPASSWORD="$DB_PASS" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";" 2>/dev/null || {
            print_error "Failed to create database. You may need to create it manually:"
            print_info "  createdb -U $DB_USER $DB_NAME"
            return 1
        }
        print_success "Database '$DB_NAME' created"
    fi
}

# Setup Python virtual environment
setup_python_env() {
    print_info "Setting up Python environment..."

    cd "$BACKEND_DIR"

    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    source venv/bin/activate
    print_info "Installing Python dependencies..."
    pip install -q -r requirements.txt

    print_success "Python environment ready"
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations..."

    cd "$BACKEND_DIR"
    source venv/bin/activate

    export DATABASE_URL="postgresql+asyncpg://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"

    if alembic upgrade head 2>/dev/null; then
        print_success "Database migrations complete"
    else
        print_warning "Migrations may have already been applied"
    fi
}

# Check if port is available
check_port() {
    local port=$1
    local service=$2

    if lsof -Pi ":$port" -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $port is already in use"
        local pid=$(lsof -Pi ":$port" -sTCP:LISTEN -t)
        print_info "Process using port $port: PID $pid"
        print_info "Stop it with: kill $pid"
        return 1
    fi
    return 0
}

# Start backend server
start_backend() {
    print_info "Starting backend on port $BACKEND_PORT..."

    if ! check_port "$BACKEND_PORT" "backend"; then
        print_info "Assuming backend is already running"
        return 0
    fi

    cd "$BACKEND_DIR"
    source venv/bin/activate

    export DATABASE_URL="postgresql+asyncpg://$DB_USER:$DB_PASS@$DB_HOST:$DB_PORT/$DB_NAME"
    export ENVIRONMENT="development"
    export CORS_ALLOWED_ORIGINS="http://localhost:$FRONTEND_PORT,http://localhost:5174"

    uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" --reload &
    BACKEND_PID=$!
    echo "$BACKEND_PID" > /tmp/quiz-backend.pid

    print_info "Backend starting (PID: $BACKEND_PID)..."
}

# Wait for backend to be healthy
wait_for_backend() {
    print_info "Waiting for backend health check..."

    for i in {1..30}; do
        if curl -s "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
            print_success "Backend is healthy"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    echo ""
    print_error "Backend failed to start within 30 seconds"
    return 1
}

# Start frontend server
start_frontend() {
    print_info "Starting frontend on port $FRONTEND_PORT..."

    if ! check_port "$FRONTEND_PORT" "frontend"; then
        print_info "Assuming frontend is already running"
        return 0
    fi

    cd "$FRONTEND_DIR"

    if [ ! -d "node_modules" ]; then
        print_info "Installing frontend dependencies..."
        npm install --silent
    fi

    export VITE_API_URL="http://localhost:$BACKEND_PORT"
    export VITE_WS_URL="ws://localhost:$BACKEND_PORT"

    npm run dev &
    FRONTEND_PID=$!
    echo "$FRONTEND_PID" > /tmp/quiz-frontend.pid

    print_info "Frontend starting (PID: $FRONTEND_PID)..."
}

# Wait for frontend to be healthy
wait_for_frontend() {
    print_info "Waiting for frontend health check..."

    for i in {1..30}; do
        if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            print_success "Frontend is healthy"
            return 0
        fi
        sleep 1
        echo -n "."
    done
    echo ""
    print_warning "Frontend may still be starting..."
    return 0
}

# Print final status
print_ready() {
    print_header "Application Ready"

    echo -e "${GREEN}All services are running!${NC}"
    echo ""
    echo "Services:"
    echo "  Frontend:  http://localhost:$FRONTEND_PORT"
    echo "  Backend:   http://localhost:$BACKEND_PORT"
    echo "  API Docs:  http://localhost:$BACKEND_PORT/docs"
    echo "  Health:    http://localhost:$BACKEND_PORT/api/health"
    echo ""
    echo "Database:"
    echo "  Host:      $DB_HOST:$DB_PORT"
    echo "  Database:  $DB_NAME"
    echo "  User:      $DB_USER"
    echo ""

    if [ -n "$BACKEND_PID" ]; then
        echo "PIDs:"
        echo "  Backend:   $BACKEND_PID"
        echo "  Frontend:  $FRONTEND_PID"
        echo ""
    fi

    echo "To stop services:"
    echo "  ./scripts/stop-local-dev.sh"
    echo ""
    echo "To run tests:"
    echo "  ./scripts/run-all-tests-local.sh --no-setup"
    echo ""
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Start local development environment (PostgreSQL, backend, frontend)"
    echo ""
    echo "Options:"
    echo "  --foreground    Keep script running (show logs, Ctrl+C to stop)"
    echo "  --help          Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKEND_PORT    Backend port (default: 8080)"
    echo "  FRONTEND_PORT   Frontend port (default: 5173)"
    echo "  DB_HOST         Database host (default: localhost)"
    echo "  DB_PORT         Database port (default: 5432)"
    echo "  DB_USER         Database user (default: quiz)"
    echo "  DB_PASS         Database password (default: quiz)"
    echo "  DB_NAME         Database name (default: quiz)"
    echo ""
}

# Main
main() {
    FOREGROUND=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --foreground|-f)
                FOREGROUND=true
                shift
                ;;
            --help|-h)
                print_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_help
                exit 1
                ;;
        esac
    done

    print_header "Local Development Setup"

    echo "Configuration:"
    echo "  Backend:   http://localhost:$BACKEND_PORT"
    echo "  Frontend:  http://localhost:$FRONTEND_PORT"
    echo "  Database:  postgresql://$DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
    echo ""

    # Pre-flight checks
    print_header "Pre-flight Checks"

    if ! check_postgres; then
        exit 1
    fi

    ensure_database
    setup_python_env
    run_migrations

    # Start services
    print_header "Starting Services"

    start_backend
    wait_for_backend || exit 1

    start_frontend
    wait_for_frontend

    # Ready!
    print_ready

    if [ "$FOREGROUND" = true ]; then
        print_info "Running in foreground mode. Press Ctrl+C to stop."
        trap 'echo ""; print_info "Stopping services..."; ./scripts/stop-local-dev.sh; exit 0' INT
        wait
    fi
}

main "$@"
