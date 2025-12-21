#!/usr/bin/env bash

# Backend Test Runner (Non-Docker)
# Runs backend unit and integration tests without Docker

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_DB_URL="${TEST_DATABASE_URL:-postgres://quiz:quiz@localhost:5432/quiz_test}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend"

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

# Check PostgreSQL connection
check_postgres() {
    print_info "Checking PostgreSQL connection..."
    
    # Extract connection details from TEST_DB_URL
    if [[ "$TEST_DB_URL" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        local user="${BASH_REMATCH[1]}"
        local password="${BASH_REMATCH[2]}"
        local host="${BASH_REMATCH[3]}"
        local port="${BASH_REMATCH[4]}"
        local db="${BASH_REMATCH[5]}"
        
        # Try to connect to postgres database first
        local admin_url="postgres://${user}:${password}@${host}:${port}/postgres"
        
        if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            print_success "PostgreSQL is accessible"
            return 0
        else
            print_error "Cannot connect to PostgreSQL"
            print_info "Please ensure PostgreSQL is running and credentials are correct"
            print_info "Connection string: ${admin_url}"
            return 1
        fi
    else
        print_error "Invalid DATABASE_URL format: $TEST_DB_URL"
        return 1
    fi
}

# Ensure test database exists
ensure_test_database() {
    print_info "Ensuring test database exists..."
    
    if [[ "$TEST_DB_URL" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        local user="${BASH_REMATCH[1]}"
        local password="${BASH_REMATCH[2]}"
        local host="${BASH_REMATCH[3]}"
        local port="${BASH_REMATCH[4]}"
        local db="${BASH_REMATCH[5]}"
        
        # Check if database exists
        local db_exists=$(PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null || echo "0")
        
        if [ "$db_exists" = "1" ]; then
            print_success "Test database '$db' already exists"
        else
            print_info "Creating test database '$db'..."
            if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -c "CREATE DATABASE \"$db\";" >/dev/null 2>&1; then
                print_success "Test database '$db' created"
            else
                print_error "Failed to create test database '$db'"
                print_info "You may need to create it manually:"
                print_info "  psql -U $user -d postgres -c \"CREATE DATABASE $db;\""
                return 1
            fi
        fi
        return 0
    else
        print_error "Invalid DATABASE_URL format: $TEST_DB_URL"
        return 1
    fi
}

# Check if cargo is installed
check_cargo() {
    if ! command_exists cargo; then
        print_error "Cargo (Rust) is not installed"
        print_info "Please install Rust: https://rustup.rs/"
        return 1
    fi
    print_success "Cargo is installed ($(cargo --version))"
    return 0
}

# Run unit tests
run_unit_tests() {
    print_header "Running Unit Tests"
    
    cd "$BACKEND_DIR"
    
    print_info "Running: cargo test --lib"
    if cargo test --lib "$@"; then
        print_success "Unit tests passed!"
        return 0
    else
        print_error "Unit tests failed"
        return 1
    fi
}

# Run integration tests
run_integration_tests() {
    print_header "Running Integration Tests"
    
    cd "$BACKEND_DIR"
    
    # Set test database URL
    export TEST_DATABASE_URL="$TEST_DB_URL"
    
    print_info "Running: cargo test --test '*'"
    print_info "Using test database: $TEST_DB_URL"
    
    if cargo test --test '*' "$@"; then
        print_success "Integration tests passed!"
        return 0
    else
        print_error "Integration tests failed"
        return 1
    fi
}

# Run all tests
run_all_tests() {
    print_header "Running All Backend Tests"
    
    local unit_passed=true
    local integration_passed=true
    
    # Run unit tests
    if ! run_unit_tests "$@"; then
        unit_passed=false
    fi
    
    # Run integration tests
    if ! run_integration_tests "$@"; then
        integration_passed=false
    fi
    
    # Summary
    echo ""
    print_header "Test Summary"
    
    if [ "$unit_passed" = true ]; then
        print_success "Unit tests: PASSED"
    else
        print_error "Unit tests: FAILED"
    fi
    
    if [ "$integration_passed" = true ]; then
        print_success "Integration tests: PASSED"
    else
        print_error "Integration tests: FAILED"
    fi
    
    if [ "$unit_passed" = true ] && [ "$integration_passed" = true ]; then
        print_success "All tests passed!"
        return 0
    else
        print_error "Some tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS] [CARGO_TEST_ARGS...]"
    echo ""
    echo "Options:"
    echo "  --unit-only        Run only unit tests (no database required)"
    echo "  --integration-only Run only integration tests (requires database)"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  TEST_DATABASE_URL  PostgreSQL connection string for test database"
    echo "                     Default: postgres://quiz:quiz@localhost:5432/quiz_test"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 --unit-only                        # Run unit tests only"
    echo "  $0 --integration-only                 # Run integration tests only"
    echo "  $0 -- test_name                       # Run specific test"
    echo "  TEST_DATABASE_URL=... $0              # Use custom test database"
    echo ""
}

# Main execution
main() {
    print_header "Backend Test Runner (Non-Docker)"
    
    # Parse arguments
    UNIT_ONLY=false
    INTEGRATION_ONLY=false
    CARGO_ARGS=()
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --unit-only)
                UNIT_ONLY=true
                shift
                ;;
            --integration-only)
                INTEGRATION_ONLY=true
                shift
                ;;
            --help|-h)
                print_help
                exit 0
                ;;
            --)
                shift
                CARGO_ARGS+=("$@")
                break
                ;;
            *)
                CARGO_ARGS+=("$1")
                shift
                ;;
        esac
    done
    
    # Pre-flight checks
    print_header "Pre-flight Checks"
    
    if ! check_cargo; then
        exit 1
    fi
    
    # Check PostgreSQL only if running integration tests
    if [ "$UNIT_ONLY" = false ]; then
        if ! check_postgres; then
            print_error "PostgreSQL check failed. Cannot run integration tests."
            exit 1
        fi
        
        if ! ensure_test_database; then
            print_error "Test database setup failed. Cannot run integration tests."
            exit 1
        fi
    fi
    
    # Run tests
    if [ "$UNIT_ONLY" = true ]; then
        run_unit_tests "${CARGO_ARGS[@]}"
        exit $?
    elif [ "$INTEGRATION_ONLY" = true ]; then
        run_integration_tests "${CARGO_ARGS[@]}"
        exit $?
    else
        run_all_tests "${CARGO_ARGS[@]}"
        exit $?
    fi
}

# Run main function
main "$@"
