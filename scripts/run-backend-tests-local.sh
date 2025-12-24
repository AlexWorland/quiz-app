#!/usr/bin/env bash

# Backend Test Runner (Non-Docker)
# Runs Python/FastAPI backend tests using pytest

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
DATABASE_URL="${DATABASE_URL:-postgresql+asyncpg://quiz:quiz@localhost:5432/quiz}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BACKEND_DIR="${ROOT_DIR}/backend-python"

# Add PostgreSQL to PATH if not already there
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

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

    # Extract connection details - handle both sync and async URLs
    local url="${DATABASE_URL//postgresql+asyncpg/postgres}"
    url="${url//postgresql/postgres}"

    if [[ "$url" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        local user="${BASH_REMATCH[1]}"
        local password="${BASH_REMATCH[2]}"
        local host="${BASH_REMATCH[3]}"
        local port="${BASH_REMATCH[4]}"
        local db="${BASH_REMATCH[5]}"

        if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -c "SELECT 1;" >/dev/null 2>&1; then
            print_success "PostgreSQL is accessible"
            return 0
        else
            print_error "Cannot connect to PostgreSQL"
            print_info "Please ensure PostgreSQL is running and credentials are correct"
            return 1
        fi
    else
        print_error "Invalid DATABASE_URL format: $DATABASE_URL"
        return 1
    fi
}

# Ensure database exists
ensure_database() {
    print_info "Ensuring database exists..."

    local url="${DATABASE_URL//postgresql+asyncpg/postgres}"
    url="${url//postgresql/postgres}"

    if [[ "$url" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        local user="${BASH_REMATCH[1]}"
        local password="${BASH_REMATCH[2]}"
        local host="${BASH_REMATCH[3]}"
        local port="${BASH_REMATCH[4]}"
        local db="${BASH_REMATCH[5]}"

        local db_exists=$(PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$db'" 2>/dev/null || echo "0")

        if [ "$db_exists" = "1" ]; then
            print_success "Database '$db' already exists"
        else
            print_info "Creating database '$db'..."
            if PGPASSWORD="$password" psql -h "$host" -p "$port" -U "$user" -d postgres -c "CREATE DATABASE \"$db\";" >/dev/null 2>&1; then
                print_success "Database '$db' created"
            else
                print_error "Failed to create database '$db'"
                return 1
            fi
        fi
        return 0
    else
        print_error "Invalid DATABASE_URL format: $DATABASE_URL"
        return 1
    fi
}

# Check Python and venv
check_python() {
    print_info "Checking Python environment..."

    if [ ! -d "$BACKEND_DIR/venv" ]; then
        print_error "Python virtual environment not found at $BACKEND_DIR/venv"
        print_info "Create it with: cd $BACKEND_DIR && python -m venv venv && source venv/bin/activate && pip install -r requirements.txt"
        return 1
    fi

    print_success "Python venv found"
    return 0
}

# Run tests
run_tests() {
    print_header "Running Backend Tests (pytest)"

    cd "$BACKEND_DIR"

    # Activate virtual environment
    source venv/bin/activate

    # Set database URL for tests
    export DATABASE_URL="$DATABASE_URL"

    local pytest_args=("-v")

    # Add any additional arguments
    if [ ${#PYTEST_ARGS[@]} -gt 0 ]; then
        pytest_args+=("${PYTEST_ARGS[@]}")
    fi

    print_info "Running: pytest ${pytest_args[*]}"
    print_info "Using database: $DATABASE_URL"

    if pytest "${pytest_args[@]}"; then
        print_success "All tests passed!"
        return 0
    else
        print_error "Some tests failed"
        return 1
    fi
}

# Run tests with coverage
run_tests_with_coverage() {
    print_header "Running Backend Tests with Coverage"

    cd "$BACKEND_DIR"
    source venv/bin/activate
    export DATABASE_URL="$DATABASE_URL"

    local pytest_args=("-v" "--cov=app" "--cov-report=term-missing")

    if [ ${#PYTEST_ARGS[@]} -gt 0 ]; then
        pytest_args+=("${PYTEST_ARGS[@]}")
    fi

    print_info "Running: pytest ${pytest_args[*]}"

    if pytest "${pytest_args[@]}"; then
        print_success "All tests passed!"
        return 0
    else
        print_error "Some tests failed"
        return 1
    fi
}

# Print help
print_help() {
    echo "Usage: $0 [OPTIONS] [PYTEST_ARGS...]"
    echo ""
    echo "Options:"
    echo "  --coverage         Run tests with coverage report"
    echo "  --skip-db-check    Skip database connectivity check"
    echo "  --help             Show this help message"
    echo ""
    echo "Environment Variables:"
    echo "  DATABASE_URL       PostgreSQL connection string"
    echo "                     Default: postgresql+asyncpg://quiz:quiz@localhost:5432/quiz"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Run all tests"
    echo "  $0 --coverage                         # Run with coverage"
    echo "  $0 tests/test_auth.py                 # Run specific test file"
    echo "  $0 -k 'test_login'                    # Run tests matching pattern"
    echo "  DATABASE_URL=... $0                   # Use custom database"
    echo ""
}

# Main execution
main() {
    print_header "Backend Test Runner (Python/FastAPI)"

    # Parse arguments
    WITH_COVERAGE=false
    SKIP_DB_CHECK=false
    PYTEST_ARGS=()

    while [[ $# -gt 0 ]]; do
        case $1 in
            --coverage)
                WITH_COVERAGE=true
                shift
                ;;
            --skip-db-check)
                SKIP_DB_CHECK=true
                shift
                ;;
            --help|-h)
                print_help
                exit 0
                ;;
            # Legacy flags for compatibility with run-all-tests-local.sh
            --unit-only|--integration-only)
                # Python backend doesn't separate unit/integration - run all
                shift
                ;;
            *)
                PYTEST_ARGS+=("$1")
                shift
                ;;
        esac
    done

    # Pre-flight checks
    print_header "Pre-flight Checks"

    if ! check_python; then
        exit 1
    fi

    if [ "$SKIP_DB_CHECK" = false ]; then
        if ! check_postgres; then
            print_error "PostgreSQL check failed"
            exit 1
        fi

        if ! ensure_database; then
            print_error "Database setup failed"
            exit 1
        fi
    fi

    # Run tests
    if [ "$WITH_COVERAGE" = true ]; then
        run_tests_with_coverage
    else
        run_tests
    fi
    exit $?
}

# Run main function
main "$@"
