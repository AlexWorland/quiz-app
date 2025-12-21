#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

TEST_DB_URL="postgres://quiz:quiz@postgres:5432/quiz_test"
COMPOSE_FILE="docker-compose.test.yml"

docker compose -f "$COMPOSE_FILE" up -d postgres minio minio-init

docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U quiz -c "DROP DATABASE IF EXISTS quiz_test;"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U quiz -c "CREATE DATABASE quiz_test;"

docker compose -f "$COMPOSE_FILE" run --rm --build -e TEST_DATABASE_URL="$TEST_DB_URL" backend-test cargo test "$@"
docker compose -f "$COMPOSE_FILE" exec -T postgres psql -U quiz -c "DROP DATABASE IF EXISTS quiz_test;"
