#!/usr/bin/env bash

# All Tests Runner (Non-Docker)
# Runs all tests: backend (pytest), frontend unit (vitest), frontend e2e2 (playwright)
# Can optionally start services before running tests

set -euo pipefail

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPTS_DIR="${ROOT_DIR}/scripts"
FRONTEND_DIR="${ROOT_DIR}/frontend"
BACKEND_DIR="${ROOT_DIR}/backend-python"

# Service ports
BACKEND_PORT=8080
FRONTEND_PORT=5173
DB_HOST=localhost
DB_PORT=5432

# PIDs for cleanup
BACKEND_PID=""
FRONTEND_PID=""

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

# Cleanup function
cleanup() {
    if [ -n "$BACKEND_PID" ]; then
        print_info "Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        print_info "Stopping frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Test results tracking
BACKEND_PASSED=false
FRONTEND_UNIT_PASSED=false
FRONTEND_E2E2_PASSED=false
INTEGRATION_PASSED=false

# Check if PostgreSQL is running
check_postgres() {
    if pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
        print_success "PostgreSQL is running"
        return 0
    else
        print_error "PostgreSQL is not running on $DB_HOST:$DB_PORT"
        print_info "Start with: brew services start postgresql@15"
        return 1
    fi
}

# Setup Python environment
setup_python_env() {
    print_info "Setting up Python environment..."

    cd "$BACKEND_DIR"

    if [ ! -d "venv" ]; then
        print_info "Creating Python virtual environment..."
        python3 -m venv venv
    fi

    source venv/bin/activate
    pip install -q -r requirements.txt

    print_success "Python environment ready"
}

# Setup database
setup_database() {
    print_info "Setting up database..."

    local db_exists=$(PGPASSWORD=quiz psql -h "$DB_HOST" -p "$DB_PORT" -U quiz -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='quiz'" 2>/dev/null || echo "0")

    if [ "$db_exists" != "1" ]; then
        print_info "Creating database 'quiz'..."
        PGPASSWORD=quiz psql -h "$DB_HOST" -p "$DB_PORT" -U quiz -d postgres -c "CREATE DATABASE quiz;" 2>/dev/null || true
    fi

    # Run migrations
    cd "$BACKEND_DIR"
    source venv/bin/activate
    export DATABASE_URL="postgresql+asyncpg://quiz:quiz@$DB_HOST:$DB_PORT/quiz"

    print_info "Running database migrations..."
    alembic upgrade head 2>/dev/null || print_warning "Migrations may have already been applied"

    print_success "Database ready"
}

# Start backend service
start_backend() {
    print_info "Starting backend on port $BACKEND_PORT..."

    # Check if port is in use
    if lsof -Pi ":$BACKEND_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $BACKEND_PORT already in use - assuming backend is running"
        return 0
    fi

    cd "$BACKEND_DIR"
    source venv/bin/activate

    export DATABASE_URL="postgresql+asyncpg://quiz:quiz@$DB_HOST:$DB_PORT/quiz"
    export ENVIRONMENT="development"
    export CORS_ALLOWED_ORIGINS="http://localhost:$FRONTEND_PORT"

    uvicorn app.main:app --host 0.0.0.0 --port "$BACKEND_PORT" >/dev/null 2>&1 &
    BACKEND_PID=$!

    # Wait for backend to be ready
    print_info "Waiting for backend to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
            print_success "Backend is ready (PID: $BACKEND_PID)"
            return 0
        fi
        sleep 1
    done

    print_error "Backend failed to start"
    return 1
}

# Start frontend service
start_frontend() {
    print_info "Starting frontend on port $FRONTEND_PORT..."

    # Check if port is in use
    if lsof -Pi ":$FRONTEND_PORT" -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_warning "Port $FRONTEND_PORT already in use - assuming frontend is running"
        return 0
    fi

    cd "$FRONTEND_DIR"

    if [ ! -d "node_modules" ]; then
        print_info "Installing frontend dependencies..."
        npm install --silent
    fi

    export VITE_API_URL="http://localhost:$BACKEND_PORT"
    export VITE_WS_URL="ws://localhost:$BACKEND_PORT"

    npm run dev >/dev/null 2>&1 &
    FRONTEND_PID=$!

    # Wait for frontend to be ready
    print_info "Waiting for frontend to be ready..."
    for i in {1..30}; do
        if curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
            print_success "Frontend is ready (PID: $FRONTEND_PID)"
            return 0
        fi
        sleep 1
    done

    print_warning "Frontend may still be starting..."
    return 0
}

# Run backend tests
run_backend() {
    print_header "Backend Tests (pytest)"

    if "${SCRIPTS_DIR}/run-backend-tests-local.sh"; then
        BACKEND_PASSED=true
        print_success "Backend tests: PASSED"
        return 0
    else
        print_error "Backend tests: FAILED"
        return 1
    fi
}

# Run frontend unit tests
run_frontend_unit() {
    print_header "Frontend Unit Tests (vitest)"

    if "${SCRIPTS_DIR}/run-frontend-tests-local.sh"; then
        FRONTEND_UNIT_PASSED=true
        print_success "Frontend unit tests: PASSED"
        return 0
    else
        print_error "Frontend unit tests: FAILED"
        return 1
    fi
}

# Run frontend E2E2 tests
run_frontend_e2e2() {
    print_header "Frontend E2E2 Tests (playwright)"

    # Check if backend is running
    if ! curl -s "http://localhost:$BACKEND_PORT/api/health" >/dev/null 2>&1; then
        print_error "Backend not running at http://localhost:$BACKEND_PORT"
        if [ "$SETUP_SERVICES" = true ]; then
            print_error "Backend failed to start during setup"
        else
            print_info "Run with default options to auto-start services"
            print_info "Or start manually: cd backend-python && source venv/bin/activate && uvicorn app.main:app --port 8080"
        fi
        return 1
    fi

    # Check if frontend is running
    if ! curl -s "http://localhost:$FRONTEND_PORT" >/dev/null 2>&1; then
        print_error "Frontend not running at http://localhost:$FRONTEND_PORT"
        if [ "$SETUP_SERVICES" = true ]; then
            print_error "Frontend failed to start during setup"
        else
            print_info "Run with default options to auto-start services"
            print_info "Or start manually: cd frontend && npm run dev"
        fi
        return 1
    fi

    print_success "Backend and frontend are running"
    print_info "Running E2E2 tests..."

    cd "$FRONTEND_DIR"
    if E2E2_API_URL="http://localhost:$BACKEND_PORT" E2E2_BASE_URL="http://localhost:$FRONTEND_PORT" E2E2_START_SERVER=false npx playwright test --config=e2e2/playwright.config.ts; then
        FRONTEND_E2E2_PASSED=true
        print_success "Frontend E2E2 tests: PASSED"
        return 0
    else
        print_error "Frontend E2E2 tests: FAILED"
        return 1
    fi
}

# Run static integration verification
run_integration_check() {
    print_header "Integration Verification (static)"

    if "${SCRIPTS_DIR}/verify-integration-static.sh"; then
        INTEGRATION_PASSED=true
        print_success "Integration verification: PASSED"
        return 0
    else
        print_error "Integration verification: FAILED"
        return 1
    fi
}

# Print summary
print_summary() {
    print_header "Test Summary"

    local all_passed=true

    if [ "$BACKEND_PASSED" = true ]; then
        print_success "Backend Tests: PASSED"
    elif [ "$SKIP_BACKEND" = true ]; then
        print_warning "Backend Tests: SKIPPED"
    else
        print_error "Backend Tests: FAILED"
        all_passed=false
    fi

    if [ "$FRONTEND_UNIT_PASSED" = true ]; then
        print_success "Frontend Unit Tests: PASSED"
    elif [ "$SKIP_FRONTEND_UNIT" = true ]; then
        print_warning "Frontend Unit Tests: SKIPPED"
    else
        print_error "Frontend Unit Tests: FAILED"
        all_passed=false
    fi

    if [ "$FRONTEND_E2E2_PASSED" = true ]; then
        print_success "Frontend E2E2 Tests: PASSED"
    elif [ "$SKIP_E2E2" = true ]; then
        print_warning "Frontend E2E2 Tests: SKIPPED"
    else
        print_error "Frontend E2E2 Tests: FAILED"
        all_passed=false
    fi

    if [ "$INTEGRATION_PASSED" = true ]; then
        print_success "Integration Verification: PASSED"
    elif [ "$SKIP_INTEGRATION" = true ]; then
        print_warning "Integration Verification: SKIPPED"
    else
        print_error "Integration Verification: FAILED"
        all_passed=false
    fi

    echo ""
    if [ "$all_passed" = true ]; then
        print_success "All tests passed! 🎉"
        return 0
    else
        print_error "Some tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "This script sets up the environment, starts services, and runs all tests."
    echo "Services are automatically started and stopped (unless --no-setup)."
    echo ""
    echo "Options:"
    echo "  --no-setup              Skip service setup (assume services already running)"
    echo "  --skip-backend          Skip backend tests"
    echo "  --skip-frontend-unit    Skip frontend unit tests"
    echo "  --skip-e2e2             Skip E2E2 tests"
    echo "  --skip-integration      Skip integration verification"
    echo "  --auto                  Non-interactive mode (skip prompts)"
    echo "  --help                  Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Full test run (setup, start, test, cleanup)"
    echo "  $0 --no-setup                         # Run tests (services must be running)"
    echo "  $0 --skip-e2e2                        # Skip browser tests"
    echo "  $0 --skip-backend --skip-e2e2         # Only frontend unit tests"
    echo ""
    echo "Requirements:"
    echo "  - PostgreSQL running on localhost:5432"
    echo "  - Python 3.x and Node.js installed"
    echo ""
}

# Main execution
main() {
    print_header "All Tests Runner (Non-Docker)"

    # Parse arguments
    SKIP_BACKEND=false
    SKIP_FRONTEND_UNIT=false
    SKIP_E2E2=false
    SKIP_INTEGRATION=false
    AUTO_MODE=false
    SETUP_SERVICES=true  # Default to true - always setup services
    NO_SETUP=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --setup)
                SETUP_SERVICES=true
                shift
                ;;
            --no-setup)
                NO_SETUP=true
                SETUP_SERVICES=false
                shift
                ;;
            --skip-backend)
                SKIP_BACKEND=true
                shift
                ;;
            --skip-frontend-unit)
                SKIP_FRONTEND_UNIT=true
                shift
                ;;
            --skip-e2e2|--skip-e2e|--skip-frontend-e2e)
                SKIP_E2E2=true
                shift
                ;;
            --skip-integration)
                SKIP_INTEGRATION=true
                shift
                ;;
            --auto)
                AUTO_MODE=true
                shift
                ;;
            # Legacy flags for backwards compatibility
            --skip-backend-unit|--skip-backend-integration)
                SKIP_BACKEND=true
                shift
                ;;
            --help|-h)
                print_help
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                print_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done

    # Setup services (default behavior)
    if [ "$SETUP_SERVICES" = true ]; then
        print_header "Environment Setup"

        if ! check_postgres; then
            exit 1
        fi

        setup_python_env
        setup_database
        start_backend
        start_frontend
    fi

    # Run tests
    if [ "$SKIP_BACKEND" = false ]; then
        run_backend || true
    else
        print_info "Skipping backend tests"
    fi

    if [ "$SKIP_FRONTEND_UNIT" = false ]; then
        run_frontend_unit || true
    else
        print_info "Skipping frontend unit tests"
    fi

    if [ "$SKIP_E2E2" = false ]; then
        run_frontend_e2e2 || true
    else
        print_info "Skipping E2E2 tests"
    fi

    if [ "$SKIP_INTEGRATION" = false ]; then
        run_integration_check || true
    else
        print_info "Skipping integration verification"
    fi

    # Print summary
    print_summary
    exit $?
}

# Run main function
main "$@"
