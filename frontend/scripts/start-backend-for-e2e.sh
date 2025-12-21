#!/bin/bash
# Start backend for E2E tests (non-Docker mode)
set -e

BACKEND_DIR="$(cd "$(dirname "$0")/../../backend" && pwd)"
DB_URL="${DATABASE_URL:-postgres://quiz:quiz@localhost:5432/quiz}"
COLOR_RESET='\033[0m'
COLOR_GREEN='\033[0;32m'
COLOR_BLUE='\033[0;34m'

# Add PostgreSQL to PATH
export PATH="/opt/homebrew/opt/postgresql@15/bin:/usr/local/opt/postgresql@15/bin:$PATH"

print_info() {
    echo -e "${COLOR_BLUE}ℹ${COLOR_RESET} $1"
}

print_success() {
    echo -e "${COLOR_GREEN}✓${COLOR_RESET} $1"
}

cd "$BACKEND_DIR"

print_info "Setting up local PostgreSQL database..."

# Extract database name and credentials from connection string
if [[ "$DB_URL" =~ postgres://([^:]+):([^@]+)@([^:]+):([^/]+)/(.+) ]]; then
    DB_USER="${BASH_REMATCH[1]}"
    DB_NAME="${BASH_REMATCH[5]}"
elif [[ "$DB_URL" =~ /([^/]+)$ ]]; then
    DB_NAME="${BASH_REMATCH[1]}"
    DB_USER="quiz"
fi

# Ensure user has CREATEDB privilege (needed for tests)
if ! psql postgres -c "SELECT 1 FROM pg_roles WHERE rolname='$DB_USER' AND rolcreatedb" 2>/dev/null | grep -q 1; then
    print_info "Granting CREATEDB privilege to '$DB_USER'..."
    psql postgres -c "ALTER USER $DB_USER WITH CREATEDB;" >/dev/null 2>&1 || true
fi

# Create database if it doesn't exist
if psql postgres -c "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null | grep -q 1; then
    print_success "Database '$DB_NAME' exists"
else
    print_info "Creating database '$DB_NAME'..."
    createdb "$DB_NAME"
    print_success "Database '$DB_NAME' created"
fi

# Create .env file if it doesn't exist
if [ ! -f ".env" ]; then
    print_info "Creating .env file..."
    echo "DATABASE_URL=$DB_URL" > .env
    print_success ".env file created"
fi

# Run migrations if sqlx-cli is available
export DATABASE_URL="$DB_URL"
if command -v sqlx &> /dev/null; then
    print_info "Running migrations..."
    sqlx migrate run 2>/dev/null || print_info "Migrations already applied"
    print_success "Migrations completed"
else
    print_info "sqlx-cli not installed. Skipping migrations."
fi

print_info "Starting backend..."
exec cargo run

