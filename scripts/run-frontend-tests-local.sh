#!/usr/bin/env bash

# Frontend Test Runner (Non-Docker)
# Runs frontend unit tests without Docker

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
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

# Check Node.js and npm
check_node() {
    if ! command_exists node; then
        print_error "Node.js is not installed"
        print_info "Please install Node.js: https://nodejs.org/"
        return 1
    fi
    
    if ! command_exists npm; then
        print_error "npm is not installed"
        print_info "Please install npm (comes with Node.js)"
        return 1
    fi
    
    print_success "Node.js is installed ($(node --version))"
    print_success "npm is installed ($(npm --version))"
    return 0
}

# Check if dependencies are installed
check_dependencies() {
    if [ ! -d "${FRONTEND_DIR}/node_modules" ]; then
        print_warning "Dependencies not installed"
        print_info "Installing dependencies..."
        cd "$FRONTEND_DIR"
        if npm install; then
            print_success "Dependencies installed"
        else
            print_error "Failed to install dependencies"
            return 1
        fi
    else
        print_success "Dependencies are installed"
    fi
    return 0
}

# Run unit tests
run_unit_tests() {
    print_header "Running Frontend Unit Tests"
    
    cd "$FRONTEND_DIR"
    
    local test_cmd="npm test"
    local coverage=false
    local watch=false
    
    # Parse additional arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            --coverage)
                coverage=true
                shift
                ;;
            --watch)
                watch=true
                shift
                ;;
            *)
                # Pass through to npm test
                test_cmd="$test_cmd $1"
                shift
                ;;
        esac
    done
    
    if [ "$coverage" = true ]; then
        test_cmd="npm run test:coverage"
    elif [ "$watch" = true ]; then
        test_cmd="npm run test:watch"
    fi
    
    print_info "Running: $test_cmd"
    
    if eval "$test_cmd"; then
        print_success "Unit tests passed!"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS] [NPM_TEST_ARGS...]"
    echo ""
    echo "Options:"
    echo "  --coverage         Run tests with coverage report"
    echo "  --watch            Run tests in watch mode"
    echo "  --help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all unit tests"
    echo "  $0 --coverage                        # Run with coverage"
    echo "  $0 --watch                           # Run in watch mode"
    echo "  $0 -- src/store/__tests__/authStore.test.ts  # Run specific test"
    echo ""
}

# Main execution
main() {
    print_header "Frontend Unit Test Runner (Non-Docker)"
    
    # Parse arguments
    HELP=false
    ARGS=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --help|-h)
                HELP=true
                shift
                ;;
            *)
                ARGS+=("$1")
                shift
                ;;
        esac
    done
    
    if [ "$HELP" = true ]; then
        print_help
        exit 0
    fi
    
    # Pre-flight checks
    print_header "Pre-flight Checks"
    
    if ! check_node; then
        exit 1
    fi
    
    if ! check_dependencies; then
        exit 1
    fi
    
    # Run tests
    run_unit_tests "${ARGS[@]}"
    exit $?
}

# Run main function
main "$@"
