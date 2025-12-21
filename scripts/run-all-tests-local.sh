#!/usr/bin/env bash

# All Tests Runner (Non-Docker)
# Runs all tests (backend unit, backend integration, frontend unit, frontend E2E)

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

# Test results tracking
BACKEND_UNIT_PASSED=false
BACKEND_INTEGRATION_PASSED=false
FRONTEND_UNIT_PASSED=false
FRONTEND_E2E_PASSED=false

# Run backend unit tests
run_backend_unit() {
    print_header "Backend Unit Tests"
    
    if "${SCRIPTS_DIR}/run-backend-tests-local.sh" --unit-only; then
        BACKEND_UNIT_PASSED=true
        print_success "Backend unit tests: PASSED"
        return 0
    else
        print_error "Backend unit tests: FAILED"
        return 1
    fi
}

# Run backend integration tests
run_backend_integration() {
    print_header "Backend Integration Tests"
    
    if "${SCRIPTS_DIR}/run-backend-tests-local.sh" --integration-only; then
        BACKEND_INTEGRATION_PASSED=true
        print_success "Backend integration tests: PASSED"
        return 0
    else
        print_error "Backend integration tests: FAILED"
        return 1
    fi
}

# Run frontend unit tests
run_frontend_unit() {
    print_header "Frontend Unit Tests"
    
    if "${SCRIPTS_DIR}/run-frontend-tests-local.sh"; then
        FRONTEND_UNIT_PASSED=true
        print_success "Frontend unit tests: PASSED"
        return 0
    else
        print_error "Frontend unit tests: FAILED"
        return 1
    fi
}

# Run frontend E2E tests
run_frontend_e2e() {
    print_header "Frontend E2E Tests"
    
    print_warning "E2E tests require backend and frontend to be running"
    print_info "If services are not running, tests will fail"
    print_info "Start services in separate terminals:"
    print_info "  Terminal 1: cd backend && cargo run"
    print_info "  Terminal 2: cd frontend && npm run dev"
    echo ""
    
    read -p "Continue with E2E tests? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_warning "Skipping E2E tests"
        return 0
    fi
    
    if "${SCRIPTS_DIR}/run-e2e-tests-local.sh" --skip-checks; then
        FRONTEND_E2E_PASSED=true
        print_success "Frontend E2E tests: PASSED"
        return 0
    else
        print_error "Frontend E2E tests: FAILED"
        return 1
    fi
}

# Print summary
print_summary() {
    print_header "Test Summary"
    
    local all_passed=true
    
    if [ "$BACKEND_UNIT_PASSED" = true ]; then
        print_success "Backend Unit Tests: PASSED"
    else
        print_error "Backend Unit Tests: FAILED"
        all_passed=false
    fi
    
    if [ "$BACKEND_INTEGRATION_PASSED" = true ]; then
        print_success "Backend Integration Tests: PASSED"
    else
        print_error "Backend Integration Tests: FAILED"
        all_passed=false
    fi
    
    if [ "$FRONTEND_UNIT_PASSED" = true ]; then
        print_success "Frontend Unit Tests: PASSED"
    else
        print_error "Frontend Unit Tests: FAILED"
        all_passed=false
    fi
    
    if [ "$FRONTEND_E2E_PASSED" = true ]; then
        print_success "Frontend E2E Tests: PASSED"
    else
        print_warning "Frontend E2E Tests: SKIPPED or FAILED"
        # Don't fail overall if E2E is skipped
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
    echo "Options:"
    echo "  --skip-backend-unit        Skip backend unit tests"
    echo "  --skip-backend-integration Skip backend integration tests"
    echo "  --skip-frontend-unit      Skip frontend unit tests"
    echo "  --skip-frontend-e2e       Skip frontend E2E tests"
    echo "  --skip-e2e                Skip E2E tests (same as --skip-frontend-e2e)"
    echo "  --help                    Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 --skip-frontend-e2e               # Skip E2E tests"
    echo "  $0 --skip-backend-integration        # Skip backend integration tests"
    echo ""
}

# Main execution
main() {
    print_header "All Tests Runner (Non-Docker)"
    
    # Parse arguments
    SKIP_BACKEND_UNIT=false
    SKIP_BACKEND_INTEGRATION=false
    SKIP_FRONTEND_UNIT=false
    SKIP_FRONTEND_E2E=false
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --skip-backend-unit)
                SKIP_BACKEND_UNIT=true
                shift
                ;;
            --skip-backend-integration)
                SKIP_BACKEND_INTEGRATION=true
                shift
                ;;
            --skip-frontend-unit)
                SKIP_FRONTEND_UNIT=true
                shift
                ;;
            --skip-frontend-e2e|--skip-e2e)
                SKIP_FRONTEND_E2E=true
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
    
    # Run tests
    if [ "$SKIP_BACKEND_UNIT" = false ]; then
        run_backend_unit || true
    else
        print_info "Skipping backend unit tests"
    fi
    
    if [ "$SKIP_BACKEND_INTEGRATION" = false ]; then
        run_backend_integration || true
    else
        print_info "Skipping backend integration tests"
    fi
    
    if [ "$SKIP_FRONTEND_UNIT" = false ]; then
        run_frontend_unit || true
    else
        print_info "Skipping frontend unit tests"
    fi
    
    if [ "$SKIP_FRONTEND_E2E" = false ]; then
        run_frontend_e2e || true
    else
        print_info "Skipping frontend E2E tests"
    fi
    
    # Print summary
    print_summary
    exit $?
}

# Run main function
main "$@"
