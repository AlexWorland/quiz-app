---
allowed-tools: Bash(cargo build:*), Bash(npm run build:*), Bash(docker build:*)
argument-hint: [optional: backend|frontend|docker]
description: Verify that all components build successfully
---

# Build Check

Verify that all components of the quiz application build successfully.

## Backend Build (Rust)
!`cd backend && cargo build --release 2>&1 | tail -20`

## Frontend Build (React)
!`cd frontend && npm run build 2>&1 | tail -20`

## Docker Build Check
!`docker compose build --dry-run 2>&1 | head -20`

## Build Requirements

### Backend
- Rust toolchain (rustc, cargo)
- SQLx CLI for compile-time query checking
- OpenSSL dev libraries

### Frontend
- Node.js 18+
- npm or pnpm
- Vite

### Docker
- Docker Engine
- Docker Compose v2

## Common Build Issues

### Backend
- **SQLx offline mode**: Run `cargo sqlx prepare` after schema changes
- **Missing dependencies**: Check Cargo.toml for required crates
- **OpenSSL errors**: Install openssl-dev package

### Frontend
- **Type errors**: Run `npm run type-check` for details
- **Missing modules**: Run `npm install`
- **Vite config issues**: Check vite.config.ts

### Docker
- **Layer cache issues**: Use `docker compose build --no-cache`
- **Platform issues**: Specify `--platform linux/amd64` if needed
