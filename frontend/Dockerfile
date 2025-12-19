# Build stage
FROM node:20-alpine as builder

WORKDIR /app

# Build-time arguments for Vite env vars
ARG VITE_API_URL=http://localhost:8080
ARG VITE_WS_URL=ws://localhost:8080

# Set as env vars for build
ENV VITE_API_URL=$VITE_API_URL
ENV VITE_WS_URL=$VITE_WS_URL

# Copy package files
COPY package.json package-lock.json* yarn.lock* ./

# Install dependencies
RUN npm ci --legacy-peer-deps

# Copy source code
COPY . .

# Build the application
RUN npm run build

# Runtime stage
FROM node:20-alpine

WORKDIR /app

# Install serve to run the application
RUN npm install -g serve@14

# Copy built files from builder
COPY --from=builder /app/dist ./dist

# Expose port
EXPOSE 5173

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --quiet --tries=1 --spider http://localhost:5173/ || exit 1

# Serve the application with SPA fallback
# Use shell form to ensure proper path resolution
CMD serve -s /app/dist -l 5173 --single
