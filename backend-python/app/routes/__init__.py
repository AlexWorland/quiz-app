"""API routes."""

from app.routes import auth, events, join, leaderboard, questions, segments

__all__ = [
    "auth",
    "events",
    "join",
    "segments",
    "questions",
    "leaderboard",
]
