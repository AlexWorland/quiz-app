#!/bin/bash
# Script to start backend for E2E tests
# This script ensures Docker services are running and starts the backend

set -e

cd "$(dirname "$0")/../../backend"

# Check if Docker services are running
if ! docker compose ps postgres minio 2>/dev/null | grep -q "Up"; then
  echo "Starting Docker services (postgres, minio)..."
  docker compose up -d postgres minio minio-init
  echo "Waiting for services to be ready..."
  sleep 5
fi

# Start backend
echo "Starting backend server..."
cargo run

