#!/bin/bash
# Script to start backend for E2E tests or local development
# Supports both Docker and non-Docker setups

set -e

BACKEND_DIR="$(cd "$(dirname "$0")/../../backend" && pwd)"
DB_URL="${DATABASE_URL:-postgres://quiz:quiz@localhost:5432/quiz}"
COLOR_RESET='\033[0m'
COLOR_BLUE='\033[0;34m'
COLOR_GREEN='\033[0;32m'
COLOR_RED='\033[0;31m'

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

print_info() {
    echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $1"
}

print_success() {
    echo -e "${COLOR_GREEN}✓${COLOR_RESET} $1"
}

print_error() {
    echo -e "${COLOR_RED}✗${COLOR_RESET} $1"
}

cd "$BACKEND_DIR"

# Check if we should use Docker or local PostgreSQL
USE_DOCKER=false
if command -v docker-compose &> /dev/null && docker-compose ps 2>/dev/null | grep -q "postgres.*Up"; then
    USE_DOCKER=true
elif command -v docker &> /dev/null && docker compose ps 2>/dev/null | grep -q "postgres.*Up"; then
    USE_DOCKER=true
fi

if [ "$USE_DOCKER" = true ]; then
    print_info "Docker PostgreSQL services detected"
    # Check if services are running
    if ! docker compose ps postgres minio 2>/dev/null | grep -q "Up"; then
        print_info "Starting Docker services (postgres, minio)..."
        docker compose up -d postgres minio minio-init
        echo "Waiting for services to be ready..."
        sleep 5
    fi
else
    print_info "Using local PostgreSQL"

    # Check if PostgreSQL is running and create database if needed
    if ! command -v psql &> /dev/null; then
        print_error "PostgreSQL client (psql) not found. Please install PostgreSQL."
        exit 1
    fi

    # Extract database name and credentials from connection string
    if [[ "$DB_URL" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
    elif [[ "$DB_URL" =~ /([^/]+)$ ]]; then
        DB_NAME="${BASH_REMATCH[1]}"
        DB_USER="quiz"
        DB_PASS="quiz"
        DB_HOST="localhost"
        DB_PORT="5432"
    else
        print_error "Invalid DATABASE_URL format: $DB_URL"
        exit 1
    fi

    # Check if database exists and create if needed
    if psql postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
        print_success "Database '$DB_NAME' exists"
    else
        print_info "Creating database '$DB_NAME'..."
        if createdb "$DB_NAME" 2>/dev/null; then
            print_success "Database '$DB_NAME' created"
        else
            print_error "Failed to create database '$DB_NAME'"
            exit 1
        fi
    fi

    # Check if user exists and create if needed
    if psql postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER'" 2>/dev/null | grep -q 1; then
        print_success "User '$DB_USER' exists"
        # Ensure user has CREATEDB privilege (needed for tests)
        if ! psql postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER' AND rolcreatedb" 2>/dev/null | grep -q 1; then
            print_info "Granting CREATEDB privilege to '$DB_USER'..."
            psql postgres -c "ALTER USER $DB_USER WITH CREATEDB;" >/dev/null 2>&1
            print_success "CREATEDB privilege granted"
        fi
    else
        print_info "Creating user '$DB_USER'..."
        if createuser "$DB_USER" 2>/dev/null && psql postgres -c "ALTER USER $DB_USER WITH PASSWORD '$DB_PASS' CREATEDB;" >/dev/null 2>&1; then
            print_success "User '$DB_USER' created with CREATEDB privilege"
        else
            print_error "Failed to create user '$DB_USER'"
            exit 1
        fi
    fi

    # Grant schema and table permissions
    print_info "Ensuring database permissions..."
    psql postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;" >/dev/null 2>&1 || true
    psql "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO $DB_USER;" >/dev/null 2>&1 || true
    psql "$DB_NAME" -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;" >/dev/null 2>&1 || true
    psql "$DB_NAME" -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO $DB_USER;" >/dev/null 2>&1 || true
    print_success "Database permissions granted"

    # Create .env file if it doesn't exist
    if [ ! -f ".env" ]; then
        print_info "Creating .env file..."
        echo "DATABASE_URL=$DB_URL" > .env
        print_success ".env file created"
    else
        print_info ".env file already exists"
    fi

    # Run migrations
    print_info "Running migrations..."
    export DATABASE_URL="$DB_URL"
    if command -v sqlx &> /dev/null; then
        if sqlx migrate run 2>/dev/null; then
            print_success "Migrations completed"
        else
            print_info "Migrations already applied or skipped"
        fi
    else
        print_info "sqlx-cli not installed. Skipping migrations."
        print_info "To install: cargo install sqlx-cli --no-default-features --features postgres"
    fi
fi

# Start backend
print_info "Starting backend server..."
cargo run

