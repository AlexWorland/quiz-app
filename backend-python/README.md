# Quiz App - Python FastAPI Backend

Real-time multiplayer quiz application backend built with FastAPI.

## Tech Stack

- **Framework**: FastAPI (async Python web framework)
- **Database**: PostgreSQL with SQLAlchemy 2.0 async
- **Migrations**: Alembic
- **Auth**: JWT tokens with argon2 password hashing
- **AI**: Official Anthropic & OpenAI Python SDKs
- **WebSocket**: FastAPI native WebSocket support

## Development Setup

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Docker (optional)

### Local Development

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Set environment variables
cp .env.example .env
# Edit .env with your settings

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --port 8080
```

### Docker Development

```bash
# Start all services
docker-compose up -d

# View logs
docker-compose logs -f backend
```

## API Documentation

Once running, visit:
- Swagger UI: http://localhost:8080/docs
- ReDoc: http://localhost:8080/redoc

## Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=term-missing

# Run specific test
pytest tests/test_auth.py -v
```

## Project Structure

```
backend-python/
├── app/
│   ├── main.py           # FastAPI app entry point
│   ├── config.py         # Pydantic settings
│   ├── database.py       # SQLAlchemy async setup
│   ├── models/           # SQLAlchemy ORM models
│   ├── schemas/          # Pydantic request/response schemas
│   ├── routes/           # API endpoint handlers
│   ├── ws/               # WebSocket handlers
│   ├── services/         # Business logic
│   └── auth/             # JWT and password handling
├── migrations/           # Alembic database migrations
├── tests/                # Pytest test files
└── requirements.txt      # Python dependencies
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | Secret key for JWT signing | Required in production |
| `JWT_EXPIRY_HOURS` | Token expiration time | 24 |
| `ANTHROPIC_API_KEY` | Claude API key | Optional |
| `OPENAI_API_KEY` | OpenAI API key | Optional |
| `DEFAULT_AI_PROVIDER` | claude, openai, or ollama | claude |
