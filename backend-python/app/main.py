"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.database import close_db


settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler for startup/shutdown."""
    # Startup
    settings.validate_production_settings() if settings.is_production else None
    yield
    # Shutdown
    await close_db()


app = FastAPI(
    title="Quiz API",
    description="Real-time multiplayer quiz application backend",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
async def health_check() -> dict[str, Any]:
    """Health check endpoint."""
    return {
        "status": "healthy",
        "database": True,  # TODO: Add actual DB check
        "providers": {
            "llm": settings.default_ai_provider,
            "stt": settings.default_stt_provider,
        },
    }


@app.get("/health")
async def root_health() -> dict[str, str]:
    """Alias health endpoint for simple load balancers."""
    return {"status": "ok"}


# Import and include routers
from app.routes import auth, events, join, leaderboard, questions, segments
from app.ws import game_router

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(events.router, prefix="/api", tags=["events"])
app.include_router(join.router, prefix="/api", tags=["join"])
app.include_router(segments.router, prefix="/api", tags=["segments"])
app.include_router(questions.router, prefix="/api", tags=["questions"])
app.include_router(leaderboard.router, prefix="/api", tags=["leaderboard"])
app.include_router(game_router, prefix="/api", tags=["websocket"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.environment == "development",
    )
