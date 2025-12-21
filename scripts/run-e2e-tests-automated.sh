#!/usr/bin/env bash

# Automated E2E Test Runner
# Starts backend and frontend, runs E2E tests, then cleans up

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"
MAX_WAIT_TIME=60  # seconds
CHECK_INTERVAL=2   # seconds

# Find available port if default is in use
find_available_port() {
    local port=$1
    while lsof -ti:"$port" >/dev/null 2>&1; do
        print_warning "Port $port is in use, trying next port..."
        port=$((port + 1))
    done
    echo "$port"
}

# Determine backend port
if [ -z "${BACKEND_URL:-}" ]; then
    BACKEND_PORT=$(find_available_port 8080)
    BACKEND_URL="http://localhost:$BACKEND_PORT"
    if [ "$BACKEND_PORT" != "8080" ]; then
        print_info "Using backend port $BACKEND_PORT (default 8080 was in use)"
    fi
else
    # Extract port from user-provided URL
    BACKEND_PORT=$(echo "$BACKEND_URL" | grep -oP '(?<=:)\d+' || echo "8080")
fi

# Determine frontend port
if [ -z "${FRONTEND_URL:-}" ]; then
    FRONTEND_PORT=$(find_available_port 5173)
    FRONTEND_URL="http://localhost:$FRONTEND_PORT"
    if [ "$FRONTEND_PORT" != "5173" ]; then
        print_info "Using frontend port $FRONTEND_PORT (default 5173 was in use)"
    fi
else
    # Extract port from user-provided URL
    FRONTEND_PORT=$(echo "$FRONTEND_URL" | grep -oP '(?<=:)\d+' || echo "5173")
fi

BACKEND_HEALTH_ENDPOINT="${BACKEND_URL}/api/health"

# Export for Playwright and backend to use
# Note: Don't include /api suffix - the frontend client adds it automatically
export VITE_API_URL="${VITE_API_URL:-${BACKEND_URL}}"
export BACKEND_PORT="$BACKEND_PORT"

# Process IDs for cleanup
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
    print_header "Cleaning Up"

    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        print_info "Stopping backend (PID: $BACKEND_PID)..."
        kill "$BACKEND_PID" 2>/dev/null || true
        wait "$BACKEND_PID" 2>/dev/null || true
        print_success "Backend stopped"
    fi

    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        print_info "Stopping frontend (PID: $FRONTEND_PID)..."
        kill "$FRONTEND_PID" 2>/dev/null || true
        wait "$FRONTEND_PID" 2>/dev/null || true
        print_success "Frontend stopped"
    fi

    # Kill any remaining processes on the ports
    print_info "Ensuring ports are free..."
    lsof -ti:8080 | xargs kill -9 2>/dev/null || true
    lsof -ti:5173 | xargs kill -9 2>/dev/null || true

    print_success "Cleanup complete"
}

# Register cleanup on exit
trap cleanup EXIT INT TERM

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local elapsed=0

    print_info "Waiting for ${service_name} to be ready at ${url}..."

    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
            echo ""
            print_success "${service_name} is ready!"
            return 0
        fi
        sleep $CHECK_INTERVAL
        elapsed=$((elapsed + CHECK_INTERVAL))
        echo -n "."
    done

    echo ""
    print_error "${service_name} failed to start within ${MAX_WAIT_TIME} seconds"
    return 1
}

# Start backend
start_backend() {
    print_header "Starting Backend"

    cd "$BACKEND_DIR"

    # Check if backend is already running
    if curl -sf "$BACKEND_HEALTH_ENDPOINT" >/dev/null 2>&1; then
        print_warning "Backend is already running at $BACKEND_URL"
        print_info "Using existing backend instance"
        return 0
    fi

    print_info "Starting backend server on port $BACKEND_PORT..."

    # Start backend in background with custom port, redirect output to log file
    BACKEND_PORT="$BACKEND_PORT" cargo run > /tmp/backend-e2e.log 2>&1 &
    BACKEND_PID=$!

    print_info "Backend process started (PID: $BACKEND_PID)"

    # Wait for backend to be ready
    if ! wait_for_service "$BACKEND_HEALTH_ENDPOINT" "Backend"; then
        print_error "Backend failed to start. Check logs: /tmp/backend-e2e.log"
        tail -20 /tmp/backend-e2e.log
        return 1
    fi

    return 0
}

# Start frontend
start_frontend() {
    print_header "Starting Frontend"

    cd "$FRONTEND_DIR"

    # Check if frontend is already running
    if curl -sf "$FRONTEND_URL" >/dev/null 2>&1; then
        print_warning "Frontend is already running at $FRONTEND_URL"
        print_info "Using existing frontend instance"
        return 0
    fi

    print_info "Starting frontend dev server..."

    # Start frontend in background, redirect output to log file
    npm run dev > /tmp/frontend-e2e.log 2>&1 &
    FRONTEND_PID=$!

    print_info "Frontend process started (PID: $FRONTEND_PID)"

    # Wait for frontend to be ready
    if ! wait_for_service "$FRONTEND_URL" "Frontend"; then
        print_error "Frontend failed to start. Check logs: /tmp/frontend-e2e.log"
        tail -20 /tmp/frontend-e2e.log
        return 1
    fi

    return 0
}

# Run E2E tests
run_e2e_tests() {
    print_header "Running E2E Tests"

    cd "$FRONTEND_DIR"

    print_info "Backend URL: $BACKEND_URL (port: $BACKEND_PORT)"
    print_info "Frontend URL: $FRONTEND_URL (port: $FRONTEND_PORT)"
    print_info "API URL: $VITE_API_URL"
    echo ""

    # Run tests
    if npm run test:e2e; then
        print_success "All E2E tests passed!"
        return 0
    else
        print_error "Some E2E tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-backend     Don't start backend (use existing)"
    echo "  --skip-frontend    Don't start frontend (use existing)"
    echo "  --keep-running     Don't stop services after tests"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKEND_URL        Backend URL (default: http://localhost:8080)"
    echo "  FRONTEND_URL       Frontend URL (default: http://localhost:5173)"
    echo "  VITE_API_URL       Backend API URL for tests (default: BACKEND_URL/api)"
    echo ""
    echo "Examples:"
    echo "  $0                                                  # Start everything and run tests"
    echo "  $0 --skip-backend                                  # Use existing backend"
    echo "  $0 --keep-running                                  # Keep services running after tests"
    echo "  BACKEND_URL=http://localhost:3000 $0               # Use custom backend port"
    echo "  BACKEND_URL=http://localhost:3000 VITE_API_URL=http://localhost:3000/api $0"
    echo ""
    echo "Logs are written to:"
    echo "  Backend:  /tmp/backend-e2e.log"
    echo "  Frontend: /tmp/frontend-e2e.log"
    echo ""
}

# Main execution
main() {
    print_header "Automated E2E Test Runner"

    # Parse arguments
    SKIP_BACKEND=false
    SKIP_FRONTEND=false
    KEEP_RUNNING=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backend)
                SKIP_BACKEND=true
                shift
                ;;
            --skip-frontend)
                SKIP_FRONTEND=true
                shift
                ;;
            --keep-running)
                KEEP_RUNNING=true
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

    # Start services
    if [ "$SKIP_BACKEND" = false ]; then
        if ! start_backend; then
            print_error "Failed to start backend"
            exit 1
        fi
    else
        print_info "Skipping backend startup (using existing instance)"
    fi

    if [ "$SKIP_FRONTEND" = false ]; then
        if ! start_frontend; then
            print_error "Failed to start frontend"
            exit 1
        fi
    else
        print_info "Skipping frontend startup (using existing instance)"
    fi

    # Run E2E tests
    TEST_RESULT=0
    if ! run_e2e_tests; then
        TEST_RESULT=1
    fi

    # Keep services running if requested
    if [ "$KEEP_RUNNING" = true ]; then
        print_header "Services Still Running"
        print_info "Backend: $BACKEND_URL (PID: $BACKEND_PID)"
        print_info "Frontend: $FRONTEND_URL (PID: $FRONTEND_PID)"
        print_info "Press Ctrl+C to stop services"

        # Unregister cleanup trap and wait indefinitely
        trap - EXIT INT TERM
        wait
    fi

    exit $TEST_RESULT
}

# Run main function
main "$@"
