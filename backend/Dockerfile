# Build stage
FROM rust:nightly as builder

WORKDIR /app

# Copy Cargo files first to cache dependencies
COPY Cargo.toml Cargo.lock* ./

# Create dummy main to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src

# Install sqlx-cli for migrations
RUN cargo install sqlx-cli --no-default-features --features postgres

# Copy actual source code
COPY src src/
COPY migrations migrations/

# Build the application
RUN cargo build --release

# Runtime stage
FROM debian:bookworm-slim

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

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/api/health || exit 1

# Run the application
CMD ["/usr/local/bin/quiz-backend"]
