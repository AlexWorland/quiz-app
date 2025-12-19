#!/bin/bash

# E2E Test Runner Script
# This script sets up the environment and runs end-to-end tests

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL_DOCKER="http://localhost:8081"  # Docker maps container 8080 -> host 8081
BACKEND_URL_LOCAL="http://localhost:8080"   # Local cargo run uses 8080
FRONTEND_URL="http://localhost:5173"
BACKEND_HEALTH_ENDPOINT_DOCKER="${BACKEND_URL_DOCKER}/api/health"
BACKEND_HEALTH_ENDPOINT_LOCAL="${BACKEND_URL_LOCAL}/api/health"
MAX_WAIT_TIME=120  # seconds
CHECK_INTERVAL=2   # seconds

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

# Check which backend is running (Docker or local)
check_backend_running() {
    if curl -sf "$BACKEND_HEALTH_ENDPOINT_DOCKER" >/dev/null 2>&1; then
        echo "docker"
        return 0
    elif curl -sf "$BACKEND_HEALTH_ENDPOINT_LOCAL" >/dev/null 2>&1; then
        echo "local"
        return 0
    else
        echo "none"
        return 1
    fi
}

# Check if Docker services are running
check_docker_services() {
    print_info "Checking Docker services..."
    
    local compose_cmd=""
    if command_exists docker-compose; then
        compose_cmd="docker-compose"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        compose_cmd="docker compose"
    else
        print_warning "Docker Compose not found"
        return 1
    fi
    
    local backend_running=false
    local postgres_running=false
    local minio_running=false
    
    if $compose_cmd ps | grep -q "quiz-backend.*Up"; then
        print_success "Backend container is running"
        backend_running=true
    else
        print_warning "Backend container is not running"
    fi
    
    if $compose_cmd ps | grep -q "quiz-postgres.*Up"; then
        print_success "PostgreSQL container is running"
        postgres_running=true
    else
        print_warning "PostgreSQL container is not running"
    fi
    
    if $compose_cmd ps | grep -q "quiz-minio.*Up"; then
        print_success "MinIO container is running"
        minio_running=true
    else
        print_warning "MinIO container is not running"
    fi
    
    if [ "$backend_running" = true ] && [ "$postgres_running" = true ] && [ "$minio_running" = true ]; then
        return 0
    else
        return 1
    fi
}

# Start Docker services
start_docker_services() {
    print_header "Starting Docker Services"
    
    local compose_cmd=""
    if command_exists docker-compose; then
        compose_cmd="docker-compose"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        compose_cmd="docker compose"
    else
        print_error "Docker Compose is not installed. Please install Docker to run tests."
        exit 1
    fi
    
    print_info "Starting services with ${compose_cmd}..."
    $compose_cmd up -d postgres minio minio-init backend
    
    print_info "Waiting for services to be healthy..."
    local elapsed=0
    while [ $elapsed -lt 180 ]; do
        if $compose_cmd ps | grep -q "quiz-postgres.*healthy" && \
           $compose_cmd ps | grep -q "quiz-minio.*Up" && \
           curl -sf "$BACKEND_HEALTH_ENDPOINT_DOCKER" >/dev/null 2>&1; then
            print_success "Docker services are ready!"
            return 0
        fi
        sleep 2
        elapsed=$((elapsed + 2))
        echo -n "."
    done
    
    echo ""
    print_warning "Some services may not be fully ready yet, but continuing..."
    return 0
}

# Start backend (prefer Docker, fallback to local)
start_backend() {
    print_header "Starting Backend"
    
    # Check if Docker backend is already running
    if curl -sf "$BACKEND_HEALTH_ENDPOINT_DOCKER" >/dev/null 2>&1; then
        print_success "Backend is already running in Docker"
        return 0
    fi
    
    # Try to start Docker backend first
    local compose_cmd=""
    if command_exists docker-compose; then
        compose_cmd="docker-compose"
    elif command_exists docker && docker compose version >/dev/null 2>&1; then
        compose_cmd="docker compose"
    fi
    
    if [ -n "$compose_cmd" ]; then
        print_info "Starting backend container with ${compose_cmd}..."
        $compose_cmd up -d backend
        
        # Wait for Docker backend to be ready
        if wait_for_service "$BACKEND_HEALTH_ENDPOINT_DOCKER" "Backend (Docker)"; then
            print_success "Backend started in Docker"
            return 0
        else
            print_warning "Docker backend failed to start, trying local backend..."
        fi
    fi
    
    # Fallback to local backend
    if pgrep -f "quiz-backend" > /dev/null; then
        print_warning "Backend is already running locally"
        return 0
    fi
    
    print_info "Starting backend server locally..."
    cd backend
    
    # Check if cargo is installed
    if ! command_exists cargo; then
        print_error "Cargo (Rust) is not installed. Please install Rust to run the backend locally."
        exit 1
    fi
    
    # Start backend in background
    cargo run > /tmp/quiz-backend.log 2>&1 &
    BACKEND_PID=$!
    echo $BACKEND_PID > /tmp/quiz-backend.pid
    
    cd ..
    
    # Wait for local backend to be ready
    if wait_for_service "$BACKEND_HEALTH_ENDPOINT_LOCAL" "Backend (Local)"; then
        print_success "Backend started locally (PID: $BACKEND_PID)"
    else
        print_error "Backend failed to start. Check logs: /tmp/quiz-backend.log"
        exit 1
    fi
}

# Stop backend
stop_backend() {
    if [ -f /tmp/quiz-backend.pid ]; then
        BACKEND_PID=$(cat /tmp/quiz-backend.pid)
        if kill -0 $BACKEND_PID 2>/dev/null; then
            print_info "Stopping backend (PID: $BACKEND_PID)..."
            kill $BACKEND_PID
            rm /tmp/quiz-backend.pid
            print_success "Backend stopped"
        fi
    fi
}

# Cleanup function
cleanup() {
    print_info "Cleaning up..."
    stop_backend
    exit 0
}

# Trap signals
trap cleanup SIGINT SIGTERM

# Main execution
main() {
    print_header "E2E Test Runner"
    
    # Parse arguments
    SKIP_SETUP=false
    TEST_FILE=""
    HEADED=false
    UI_MODE=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-setup)
                SKIP_SETUP=true
                shift
                ;;
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
            --help)
                echo "Usage: $0 [OPTIONS]"
                echo ""
                echo "Options:"
                echo "  --skip-setup    Skip starting services (assume they're already running)"
                echo "  --file FILE      Run specific test file"
                echo "  --headed         Run tests in headed mode (show browser)"
                echo "  --ui             Run tests in UI mode (interactive)"
                echo "  --help           Show this help message"
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # Setup phase
    if [ "$SKIP_SETUP" = false ]; then
        # Check Docker services
        if ! check_docker_services; then
            read -p "Start Docker services? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                start_docker_services
            fi
        fi
        
        # Start backend if not running
        BACKEND_TYPE=$(check_backend_running)
        if [ "$BACKEND_TYPE" = "none" ]; then
            start_backend
        elif [ "$BACKEND_TYPE" = "docker" ]; then
            print_success "Backend is already running in Docker"
        elif [ "$BACKEND_TYPE" = "local" ]; then
            print_success "Backend is already running locally"
        fi
    else
        print_info "Skipping setup (--skip-setup flag set)"
    fi
    
    # Verify services are ready
    print_header "Verifying Services"
    BACKEND_TYPE=$(check_backend_running)
    if [ "$BACKEND_TYPE" = "docker" ]; then
        if ! wait_for_service "$BACKEND_HEALTH_ENDPOINT_DOCKER" "Backend"; then
            print_error "Backend is not accessible. Please start it manually."
            exit 1
        fi
    elif [ "$BACKEND_TYPE" = "local" ]; then
        if ! wait_for_service "$BACKEND_HEALTH_ENDPOINT_LOCAL" "Backend"; then
            print_error "Backend is not accessible. Please start it manually."
            exit 1
        fi
    else
        print_error "Backend is not accessible. Please start it manually."
        exit 1
    fi
    
    # Run tests
    print_header "Running E2E Tests"
    cd frontend
    
    # Build test command
    TEST_CMD="npm run test:e2e"
    
    if [ "$UI_MODE" = true ]; then
        TEST_CMD="npm run test:e2e:ui"
    elif [ "$HEADED" = true ]; then
        TEST_CMD="npm run test:e2e:headed"
    fi
    
    if [ -n "$TEST_FILE" ]; then
        TEST_CMD="npx playwright test $TEST_FILE"
        if [ "$HEADED" = true ]; then
            TEST_CMD="$TEST_CMD --headed"
        fi
        if [ "$UI_MODE" = true ]; then
            TEST_CMD="$TEST_CMD --ui"
        fi
    fi
    
    print_info "Running: $TEST_CMD"
    echo ""
    
    # Execute test command
    eval $TEST_CMD
    TEST_EXIT_CODE=$?
    
    cd ..
    
    # Report results
    echo ""
    if [ $TEST_EXIT_CODE -eq 0 ]; then
        print_success "All tests passed!"
    else
        print_error "Some tests failed (exit code: $TEST_EXIT_CODE)"
    fi
    
    # Cleanup
    if [ "$SKIP_SETUP" = false ]; then
        read -p "Stop backend? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            stop_backend
        fi
    fi
    
    exit $TEST_EXIT_CODE
}

# Run main function
main "$@"

