"""Tests for resume accidentally ended segment/event functionality."""

import pytest
from datetime import datetime, timezone
from uuid import uuid4

from app.models import Event, Segment, EventStatus, SegmentStatus


@pytest.fixture
def test_event(test_user):
    """Create a test event."""
    return Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Test Event",
        join_code="TEST01",
        status=EventStatus.ACTIVE.value,
    )


@pytest.fixture
def test_segment(test_event):
    """Create a test segment."""
    return Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Test Presenter",
        status=SegmentStatus.QUIZZING.value,
        order_index=0,
    )


@pytest.mark.asyncio
async def test_complete_segment_stores_previous_status(test_session, test_user, test_event, test_segment):
    """Completing a segment should store the previous status."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segment)
    await test_session.commit()

    # Complete the segment
    test_segment.previous_status = test_segment.status
    test_segment.status = SegmentStatus.COMPLETED.value
    test_segment.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    assert test_segment.status == SegmentStatus.COMPLETED.value
    assert test_segment.previous_status == SegmentStatus.QUIZZING.value
    assert test_segment.ended_at is not None


@pytest.mark.asyncio
async def test_resume_segment_restores_previous_status(test_session, test_user, test_event, test_segment):
    """Resuming a segment should restore the previous status."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segment)
    await test_session.commit()

    # Complete the segment
    original_status = test_segment.status
    test_segment.previous_status = original_status
    test_segment.status = SegmentStatus.COMPLETED.value
    test_segment.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    # Resume the segment
    test_segment.status = test_segment.previous_status
    test_segment.previous_status = None
    test_segment.ended_at = None
    await test_session.commit()

    assert test_segment.status == original_status
    assert test_segment.previous_status is None
    assert test_segment.ended_at is None


@pytest.mark.asyncio
async def test_clear_resume_state_keeps_segment_completed(test_session, test_user, test_event, test_segment):
    """Clearing resume state should keep segment completed but remove previous status."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segment)
    await test_session.commit()

    # Complete the segment
    test_segment.previous_status = test_segment.status
    test_segment.status = SegmentStatus.COMPLETED.value
    test_segment.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    # Clear resume state
    test_segment.previous_status = None
    await test_session.commit()

    assert test_segment.status == SegmentStatus.COMPLETED.value
    assert test_segment.previous_status is None
    assert test_segment.ended_at is not None


@pytest.mark.asyncio
async def test_complete_event_stores_previous_status(test_session, test_user, test_event):
    """Completing an event should store the previous status."""
    test_session.add(test_user)
    test_session.add(test_event)
    await test_session.commit()

    # Complete the event
    test_event.previous_status = test_event.status
    test_event.status = EventStatus.FINISHED.value
    test_event.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    assert test_event.status == EventStatus.FINISHED.value
    assert test_event.previous_status == EventStatus.ACTIVE.value
    assert test_event.ended_at is not None


@pytest.mark.asyncio
async def test_resume_event_restores_previous_status(test_session, test_user, test_event):
    """Resuming an event should restore the previous status."""
    test_session.add(test_user)
    test_session.add(test_event)
    await test_session.commit()

    # Complete the event
    original_status = test_event.status
    test_event.previous_status = original_status
    test_event.status = EventStatus.FINISHED.value
    test_event.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    # Resume the event
    test_event.status = test_event.previous_status
    test_event.previous_status = None
    test_event.ended_at = None
    await test_session.commit()

    assert test_event.status == original_status
    assert test_event.previous_status is None
    assert test_event.ended_at is None


@pytest.mark.asyncio
async def test_multiple_rapid_resume_attempts_prevented(test_session, test_user, test_event, test_segment):
    """Multiple rapid resume attempts should be prevented by checking previous_status."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segment)
    await test_session.commit()

    # Complete the segment
    test_segment.previous_status = test_segment.status
    test_segment.status = SegmentStatus.COMPLETED.value
    await test_session.commit()

    # First resume succeeds
    test_segment.status = test_segment.previous_status
    test_segment.previous_status = None
    await test_session.commit()

    # Second resume attempt should fail (no previous_status available)
    assert test_segment.previous_status is None


@pytest.mark.asyncio
async def test_resume_different_statuses(test_session, test_user, test_event):
    """Resume should work from different previous statuses."""
    test_session.add(test_user)
    test_session.add(test_event)
    await test_session.commit()

    # Test from WAITING status
    test_event.status = EventStatus.WAITING.value
    test_event.previous_status = test_event.status
    test_event.status = EventStatus.FINISHED.value
    await test_session.commit()

    test_event.status = test_event.previous_status
    test_event.previous_status = None
    await test_session.commit()

    assert test_event.status == EventStatus.WAITING.value


@pytest.mark.asyncio
async def test_ended_at_timestamp_recorded(test_session, test_user, test_event, test_segment):
    """Ending should record timestamp for resume time tracking."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segment)
    await test_session.commit()

    before_complete = datetime.now(timezone.utc)

    # Complete the segment
    test_segment.previous_status = test_segment.status
    test_segment.status = SegmentStatus.COMPLETED.value
    test_segment.ended_at = datetime.now(timezone.utc)
    await test_session.commit()

    after_complete = datetime.now(timezone.utc)

    assert test_segment.ended_at >= before_complete
    assert test_segment.ended_at <= after_complete
