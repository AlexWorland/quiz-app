"""Pytest configuration and fixtures."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import NullPool

from app.config import get_settings
from app.database import Base, get_db
from app.main import app
# Import all models to ensure they're registered with Base.metadata
from app.models import (
    User,
    Event,
    Segment,
    Question,
    EventParticipant,
    SegmentScore,
    CanvasStroke,
    PresentationTranscript,
    AudioChunk,
    ProcessingLog,
)


@pytest.fixture
def anyio_backend():
    return "asyncio"


@pytest.fixture(scope="function")
async def test_engine():
    """Create a test database engine per test."""
    settings = get_settings()
    # Use pool_pre_ping and disable prepared statement caching
    engine = create_async_engine(
        settings.database_url,
        echo=True,  # Enable SQL logging to debug schema issues
        pool_pre_ping=True,
        pool_recycle=3600,
        connect_args={
            "server_settings": {"jit": "off"},
            "prepared_statement_cache_size": 0,  # Disable prepared statement cache
        },
        poolclass=NullPool,
    )

    # Drop all tables and recreate for clean state
    async with engine.begin() as conn:
        # Drop all tables in correct order (respecting foreign keys)
        await conn.execute(text("DROP TABLE IF EXISTS canvas_strokes CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS presentation_transcripts CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS segment_scores CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS event_participants CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS questions CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS segments CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS events CASCADE"))
        await conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
        # Recreate all tables
        await conn.run_sync(Base.metadata.create_all)

    yield engine

    # Just dispose, don't drop tables (causes issues with foreign keys)
    await engine.dispose()


@pytest.fixture(scope="function")
async def test_session(test_engine):
    """Create a test database session."""
    async_session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async with async_session_maker() as session:
        # Truncate all tables before each test (ignore if table doesn't exist)
        try:
            await session.execute(text("""
                TRUNCATE TABLE users, events, segments, questions,
                               event_participants, segment_scores,
                               canvas_strokes, presentation_transcripts,
                               join_attempts, audio_chunks, processing_logs
                CASCADE
            """))
            await session.commit()
        except Exception:
            await session.rollback()  # First test, tables may not exist yet

        yield session


@pytest.fixture(scope="function")
async def client(test_engine):
    """Async test client with isolated database session."""
    async_session_maker = async_sessionmaker(
        test_engine,
        class_=AsyncSession,
        expire_on_commit=False,
    )

    async def override_get_db():
        async with async_session_maker() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    # Override the dependency
    app.dependency_overrides[get_db] = override_get_db

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
    ) as ac:
        yield ac

    # Clear overrides after test
    app.dependency_overrides.clear()


@pytest.fixture
async def test_user(test_session):
    """Create a test user."""
    from uuid import uuid4

    from app.models import User

    user = User(
        id=uuid4(),
        username="testuser",
        display_name="Test User",
        email="testuser@example.com",
        password_hash="dummy_hash",
        avatar_url="😀",
        avatar_type="emoji",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def test_event(test_session, test_user):
    """Create a test event."""
    from uuid import uuid4

    from app.models import Event

    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Test Event",
        join_code="TEST01",
        mode="listen_only",
        status="waiting",
        join_locked=False,
    )
    test_session.add(event)
    await test_session.commit()
    await test_session.refresh(event)
    return event
