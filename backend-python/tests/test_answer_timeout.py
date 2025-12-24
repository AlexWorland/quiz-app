"""Tests for answer timeout boundary handling."""

import pytest
from datetime import datetime, timedelta, timezone
from uuid import uuid4

from app.ws.hub import Hub, GameState, EventSession, QuizPhase


@pytest.fixture
def hub():
    """Create a fresh hub for each test."""
    return Hub()


@pytest.fixture
def event_id():
    """Generate event ID."""
    return uuid4()


@pytest.fixture
def user_id():
    """Generate user ID."""
    return uuid4()


@pytest.mark.asyncio
async def test_answer_accepted_within_time_limit(hub, event_id, user_id):
    """Answer submitted within time limit should be accepted."""
    session = await hub.get_or_create_session(event_id)
    session.game_state.question_started_at = datetime.now(timezone.utc)
    session.game_state.time_limit_seconds = 30
    session.game_state.quiz_phase = QuizPhase.SHOWING_QUESTION

    # Submit answer immediately
    success, error = await hub.record_answer(event_id, user_id, "A")

    assert success is True
    assert error is None
    assert session.game_state.answers_received[user_id] == "A"


@pytest.mark.asyncio
async def test_answer_rejected_after_timeout(hub, event_id, user_id):
    """Answer submitted after timeout should be rejected."""
    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc) - timedelta(seconds=31)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 30

    # Submit answer 31 seconds after start (1 second late)
    success, error = await hub.record_answer(event_id, user_id, "A")

    assert success is False
    assert error == 'too_late'
    assert user_id not in session.game_state.answers_received


@pytest.mark.asyncio
async def test_answer_at_exact_timeout_boundary(hub, event_id, user_id):
    """Answer submitted beyond timeout + grace period should be rejected."""
    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc) - timedelta(seconds=30)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 30

    # Submit at 30.6 seconds (beyond 30s + 500ms grace period)
    submitted_at = question_start + timedelta(seconds=30.6)
    success, error = await hub.record_answer(
        event_id, user_id, "A", submitted_at=submitted_at
    )

    assert success is False
    assert error == 'too_late'


@pytest.mark.asyncio
async def test_answer_just_before_timeout(hub, event_id, user_id):
    """Answer submitted 1ms before timeout should be accepted."""
    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 30

    # Submit 100ms before timeout
    submitted_at = question_start + timedelta(seconds=29.9)
    success, error = await hub.record_answer(
        event_id, user_id, "A", submitted_at=submitted_at
    )

    assert success is True
    assert error is None
    assert session.game_state.answers_received[user_id] == "A"


@pytest.mark.asyncio
async def test_duplicate_answer_still_rejected(hub, event_id, user_id):
    """Duplicate answer should be rejected even within time limit."""
    session = await hub.get_or_create_session(event_id)
    session.game_state.question_started_at = datetime.now(timezone.utc)
    session.game_state.time_limit_seconds = 30

    # Submit first answer
    success1, error1 = await hub.record_answer(event_id, user_id, "A")
    assert success1 is True

    # Submit duplicate
    success2, error2 = await hub.record_answer(event_id, user_id, "B")
    assert success2 is False
    assert error2 == 'duplicate'
    assert session.game_state.answers_received[user_id] == "A"


@pytest.mark.asyncio
async def test_no_active_question_rejected(hub, event_id, user_id):
    """Answer without active question should be rejected."""
    await hub.get_or_create_session(event_id)

    # No question started
    success, error = await hub.record_answer(event_id, user_id, "A")

    assert success is False
    assert error == 'no_question'


@pytest.mark.asyncio
async def test_multiple_users_within_time_limit(hub, event_id):
    """Multiple users can submit within time limit."""
    user1 = uuid4()
    user2 = uuid4()
    user3 = uuid4()

    session = await hub.get_or_create_session(event_id)
    session.game_state.question_started_at = datetime.now(timezone.utc)
    session.game_state.time_limit_seconds = 30

    # All submit within time
    success1, _ = await hub.record_answer(event_id, user1, "A")
    success2, _ = await hub.record_answer(event_id, user2, "B")
    success3, _ = await hub.record_answer(event_id, user3, "C")

    assert success1 is True
    assert success2 is True
    assert success3 is True
    assert len(session.game_state.answers_received) == 3


@pytest.mark.asyncio
async def test_mixed_timing_submissions(hub, event_id):
    """Some users in time, some late."""
    user1 = uuid4()
    user2 = uuid4()

    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc) - timedelta(seconds=25)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 30

    # User 1 submits at 25 seconds (in time)
    submitted_at1 = question_start + timedelta(seconds=25)
    success1, error1 = await hub.record_answer(
        event_id, user1, "A", submitted_at=submitted_at1
    )

    # User 2 submits at 35 seconds (late)
    submitted_at2 = question_start + timedelta(seconds=35)
    success2, error2 = await hub.record_answer(
        event_id, user2, "B", submitted_at=submitted_at2
    )

    assert success1 is True
    assert error1 is None
    assert success2 is False
    assert error2 == 'too_late'
    assert len(session.game_state.answers_received) == 1


@pytest.mark.asyncio
async def test_different_time_limits(hub, event_id, user_id):
    """Test with different time limit values."""
    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 15  # 15 second limit

    # Submit at 14 seconds (in time)
    submitted_at = question_start + timedelta(seconds=14)
    success, error = await hub.record_answer(
        event_id, user_id, "A", submitted_at=submitted_at
    )

    assert success is True
    assert error is None


@pytest.mark.asyncio
async def test_answer_timing_with_timezone_aware_datetime(hub, event_id, user_id):
    """Test with timezone-aware datetime objects."""
    session = await hub.get_or_create_session(event_id)
    question_start = datetime.now(timezone.utc)
    session.game_state.question_started_at = question_start
    session.game_state.time_limit_seconds = 30

    # Submit with explicit timezone
    submitted_at = datetime.now(timezone.utc)
    success, error = await hub.record_answer(
        event_id, user_id, "A", submitted_at=submitted_at
    )

    assert success is True
    assert error is None
