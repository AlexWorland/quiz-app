# Build stage
FROM rust:latest as builder

WORKDIR /app

# Install sqlx-cli for migrations
RUN cargo install sqlx-cli --no-default-features --features postgres

# Copy Cargo files
COPY Cargo.toml Cargo.lock* ./

# Create dummy main to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Copy actual source code
COPY src src/
COPY migrations migrations/

# Build the application
RUN cargo build --release

# Runtime stage - use testing for newer GLIBC
FROM debian:trixie-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ca-certificates \
    curl \
    libssl3 \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Copy binary from builder
COPY --from=builder /app/target/release/quiz-backend /usr/local/bin/quiz-backend
COPY --from=builder /app/migrations ./migrations/

# Create .env for migrations (not used in runtime, but kept for reference)
RUN echo "DATABASE_URL=postgres://quiz:quiz@postgres:5432/quiz" > .env

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Run the application
# Use shell form to ensure proper signal handling
CMD /usr/local/bin/quiz-backend
