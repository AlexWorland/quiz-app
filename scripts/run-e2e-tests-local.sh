#!/usr/bin/env bash

# E2E2 Test Runner (Non-Docker)
# Runs frontend E2E2 tests (Playwright) - requires services to be running

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${E2E2_API_URL:-http://localhost:8080}"
FRONTEND_URL="${E2E2_BASE_URL:-http://localhost:5173}"
BACKEND_HEALTH_ENDPOINT="${BACKEND_URL}/api/health"
MAX_WAIT_TIME=120  # seconds
CHECK_INTERVAL=2   # seconds
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
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

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Wait for service to be ready
wait_for_service() {
    local url=$1
    local service_name=$2
    local elapsed=0

    print_info "Waiting for ${service_name} to be ready..."

    while [ $elapsed -lt $MAX_WAIT_TIME ]; do
        if curl -sf "$url" >/dev/null 2>&1; then
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

# Check if services are running
check_services() {
    print_header "Checking Services"

    local all_ready=true

    # Check backend
    if curl -sf "$BACKEND_HEALTH_ENDPOINT" >/dev/null 2>&1; then
        print_success "Backend is running at $BACKEND_URL"
    else
        print_error "Backend is not accessible at $BACKEND_URL"
        print_info "Please start the backend:"
        print_info "  cd backend-python && source venv/bin/activate && uvicorn app.main:app --port 8080"
        all_ready=false
    fi

    # Check frontend
    if curl -sf "$FRONTEND_URL" >/dev/null 2>&1; then
        print_success "Frontend is running at $FRONTEND_URL"
    else
        print_error "Frontend is not accessible at $FRONTEND_URL"
        print_info "Please start the frontend: cd frontend && npm run dev"
        all_ready=false
    fi

    # Check PostgreSQL (optional)
    if command_exists psql; then
        export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"
        if PGPASSWORD=quiz psql -h localhost -U quiz -d quiz -c "SELECT 1;" >/dev/null 2>&1; then
            print_success "PostgreSQL is accessible"
        else
            print_warning "PostgreSQL may not be accessible (tests may fail)"
        fi
    fi

    return $([ "$all_ready" = true ] && echo 0 || echo 1)
}

# Check Node.js and npm
check_node() {
    if ! command_exists node; then
        print_error "Node.js is not installed"
        print_info "Please install Node.js: https://nodejs.org/"
        return 1
    fi

    if ! command_exists npm; then
        print_error "npm is not installed"
        return 1
    fi

    print_success "Node.js is installed ($(node --version))"
    return 0
}

# Check Playwright browsers
check_playwright() {
    cd "$FRONTEND_DIR"

    if [ ! -d "node_modules/@playwright" ]; then
        print_warning "Playwright not installed"
        print_info "Installing Playwright browsers..."
        if npx playwright install --with-deps chromium; then
            print_success "Playwright browsers installed"
        else
            print_error "Failed to install Playwright browsers"
            return 1
        fi
    else
        print_success "Playwright is installed"
    fi

    return 0
}

# Run E2E2 tests
run_e2e2_tests() {
    print_header "Running E2E2 Tests"

    cd "$FRONTEND_DIR"

    # Set environment variables for e2e2
    export E2E2_API_URL="$BACKEND_URL"
    export E2E2_BASE_URL="$FRONTEND_URL"
    export E2E2_START_SERVER=false

    local playwright_args=("--config=e2e2/playwright.config.ts")

    # Add test file if specified
    if [ -n "$TEST_FILE" ]; then
        playwright_args+=("$TEST_FILE")
    fi

    # Add headed mode if specified
    if [ "$HEADED" = true ]; then
        playwright_args+=("--headed")
    fi

    # Add UI mode if specified
    if [ "$UI_MODE" = true ]; then
        playwright_args+=("--ui")
    fi

    print_info "Running: npx playwright test ${playwright_args[*]}"
    print_info "Backend URL: $BACKEND_URL"
    print_info "Frontend URL: $FRONTEND_URL"
    echo ""

    # Execute test command
    if npx playwright test "${playwright_args[@]}"; then
        print_success "E2E2 tests passed!"
        return 0
    else
        print_error "E2E2 tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --file FILE        Run specific test file (e.g., e2e2/tests/auth.e2e2.spec.ts)"
    echo "  --headed           Run tests in headed mode (show browser)"
    echo "  --ui               Run tests in UI mode (interactive)"
    echo "  --skip-checks      Skip service availability checks"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  E2E2_API_URL       Backend URL (default: http://localhost:8080)"
    echo "  E2E2_BASE_URL      Frontend URL (default: http://localhost:5173)"
    echo ""
    echo "Examples:"
    echo "  $0                                              # Run all E2E2 tests"
    echo "  $0 --file e2e2/tests/auth.e2e2.spec.ts         # Run specific test file"
    echo "  $0 --headed                                     # Run with visible browser"
    echo "  $0 --ui                                         # Run in interactive UI mode"
    echo "  E2E2_API_URL=http://localhost:8081 $0           # Use custom backend URL"
    echo ""
    echo "Note: This script requires backend and frontend to be running."
    echo "Start them manually before running tests:"
    echo "  Terminal 1: cd backend-python && source venv/bin/activate && uvicorn app.main:app --port 8080"
    echo "  Terminal 2: cd frontend && npm run dev"
    echo ""
}

# Main execution
main() {
    print_header "E2E2 Test Runner (Non-Docker)"

    # Parse arguments
    SKIP_CHECKS=false
    TEST_FILE=""
    HEADED=false
    UI_MODE=false

    while [[ $# -gt 0 ]]; do
        case $1 in
            --file)
                TEST_FILE="$2"
                shift 2
                ;;
            --headed)
                HEADED=true
                shift
                ;;
            --ui)
                UI_MODE=true
                shift
                ;;
            --skip-checks)
                SKIP_CHECKS=true
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

    # Pre-flight checks
    if [ "$SKIP_CHECKS" = false ]; then
        print_header "Pre-flight Checks"

        if ! check_node; then
            exit 1
        fi

        if ! check_playwright; then
            exit 1
        fi

        if ! check_services; then
            print_error "Required services are not running"
            print_info "Please start backend and frontend before running E2E2 tests"
            exit 1
        fi
    else
        print_info "Skipping service checks (--skip-checks flag set)"
    fi

    # Run tests
    run_e2e2_tests
    exit $?
}

# Run main function
main "$@"
