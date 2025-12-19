# Docker Service Testing Guide

## Quick Test

Test that all services start correctly:

```bash
# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f backend
docker compose logs -f frontend

# Test endpoints
curl http://localhost:8081/api/health
curl http://localhost:5173
```

## E2E Test Configuration

The E2E tests automatically:
1. Check if Docker services are running
2. Start all services if needed (`docker compose up -d`)
3. Wait for services to be healthy
4. Run tests against services on ports:
   - Frontend: `http://localhost:5173`
   - Backend: `http://localhost:8081`

## Port Configuration

- **Backend**: Port 8081 on host (8080 in container)
- **Frontend**: Port 5173
- **PostgreSQL**: Port 5432
- **MinIO**: Ports 9000, 9001

## Troubleshooting

### SSL Certificate Issues

If you see SSL certificate errors when building the backend:
1. The Dockerfile configures cargo to use system certificates
2. If issues persist, try rebuilding: `docker compose build --no-cache backend`
3. Or build locally and copy the binary

### Services Won't Start

```bash
# Check Docker is running
docker info

# Check service logs
docker compose logs backend
docker compose logs frontend

# Restart services
docker compose restart backend frontend
```

### Port Conflicts

If ports are already in use:
- Backend: Change `8081:8080` in docker-compose.yml
- Frontend: Change `5173:5173` in docker-compose.yml
- Update `VITE_API_URL` and `VITE_WS_URL` accordingly

### Network Issues

```bash
# Clean up networks
docker network prune -f

# Recreate services
docker compose down
docker compose up -d
```

