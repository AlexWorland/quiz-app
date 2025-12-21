#!/usr/bin/env bash

# E2E Test Runner (Non-Docker)
# Runs frontend E2E tests without Docker (requires services to be running)

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="${BACKEND_URL:-http://localhost:8080}"
FRONTEND_URL="${FRONTEND_URL:-http://localhost:5173}"
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
        print_info "Please start the backend: cd backend && cargo run"
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
    
    # Check PostgreSQL (optional, but recommended)
    if command_exists psql; then
        if PGPASSWORD=quiz psql -h localhost -U quiz -d quiz -c "SELECT 1;" >/dev/null 2>&1; then
            print_success "PostgreSQL is accessible"
        else
            print_warning "PostgreSQL may not be accessible (tests may fail)"
        fi
    fi
    
    # Check MinIO (optional, but recommended)
    if curl -sf "http://localhost:9000/minio/health/live" >/dev/null 2>&1; then
        print_success "MinIO is accessible"
    else
        print_warning "MinIO may not be accessible (avatar uploads may fail)"
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

# Run E2E tests
run_e2e_tests() {
    print_header "Running E2E Tests"
    
    cd "$FRONTEND_DIR"
    
    local test_cmd="npm run test:e2e"
    local test_file=""
    local headed=false
    local ui_mode=false
    
    # Parse arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --file)
                test_file="$2"
                shift 2
                ;;
            --headed)
                headed=true
                shift
                ;;
            --ui)
                ui_mode=true
                shift
                ;;
            *)
                print_error "Unknown option: $1"
                print_info "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Build test command
    if [ "$ui_mode" = true ]; then
        test_cmd="npm run test:e2e:ui"
    elif [ "$headed" = true ]; then
        test_cmd="npm run test:e2e:headed"
    fi
    
    if [ -n "$test_file" ]; then
        test_cmd="npx playwright test $test_file"
        if [ "$headed" = true ]; then
            test_cmd="$test_cmd --headed"
        fi
        if [ "$ui_mode" = true ]; then
            test_cmd="$test_cmd --ui"
        fi
    fi
    
    print_info "Running: $test_cmd"
    print_info "Backend URL: $BACKEND_URL"
    print_info "Frontend URL: $FRONTEND_URL"
    echo ""
    
    # Execute test command
    if eval "$test_cmd"; then
        print_success "E2E tests passed!"
        return 0
    else
        print_error "E2E tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --file FILE        Run specific test file"
    echo "  --headed           Run tests in headed mode (show browser)"
    echo "  --ui               Run tests in UI mode (interactive)"
    echo "  --skip-checks      Skip service availability checks"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  BACKEND_URL        Backend URL (default: http://localhost:8080)"
    echo "  FRONTEND_URL       Frontend URL (default: http://localhost:5173)"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all E2E tests"
    echo "  $0 --file e2e/auth.spec.ts          # Run specific test file"
    echo "  $0 --headed                          # Run with visible browser"
    echo "  $0 --ui                              # Run in interactive UI mode"
    echo "  BACKEND_URL=http://localhost:8081 $0 # Use custom backend URL"
    echo ""
    echo "Note: This script requires backend and frontend to be running."
    echo "Start them manually before running tests:"
    echo "  Terminal 1: cd backend && cargo run"
    echo "  Terminal 2: cd frontend && npm run dev"
    echo ""
}

# Main execution
main() {
    print_header "E2E Test Runner (Non-Docker)"
    
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
            print_info "Please start backend and frontend before running E2E tests"
            exit 1
        fi
    else
        print_info "Skipping service checks (--skip-checks flag set)"
    fi
    
    # Run tests
    run_e2e_tests --file "$TEST_FILE" $([ "$HEADED" = true ] && echo "--headed") $([ "$UI_MODE" = true ] && echo "--ui")
    exit $?
}

# Run main function
main "$@"
