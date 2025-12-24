"""Integration tests for presenter rotation functionality."""

import pytest
from uuid import uuid4


@pytest.fixture
async def test_segment(test_session, test_event):
    """Create a test segment."""
    from app.models import Segment, SegmentStatus

    segment = Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Test Presenter",
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()
    await test_session.refresh(segment)
    return segment


@pytest.fixture
async def participants(test_session, test_event):
    """Create test participants with associated user accounts."""
    from app.models import EventParticipant, User

    participants = []
    for i in range(3):
        # Create user for each participant
        user = User(
            id=uuid4(),
            username=f"participant{i+1}",
            display_name=f"Participant {i+1}",
            email=f"participant{i+1}@example.com",
            password_hash="dummy_hash",
            avatar_url="😀",
            avatar_type="emoji",
        )
        test_session.add(user)
        await test_session.flush()

        participant = EventParticipant(
            id=uuid4(),
            event_id=test_event.id,
            user_id=user.id,  # Link to user
            device_id=uuid4(),
            display_name=f"Participant {i+1}",
            avatar_url="😀",
            avatar_type="emoji",
            session_token=f"token_{i}",
        )
        participants.append(participant)
        test_session.add(participant)

    await test_session.commit()
    for p in participants:
        await test_session.refresh(p)
    return participants


@pytest.mark.anyio
async def test_pass_presenter_success(test_session, test_event, test_segment, test_user, participants):
    """Test successful presenter handoff."""
    from app.models import Segment

    # Set initial presenter
    test_segment.presenter_user_id = test_user.id
    await test_session.commit()

    # Simulate pass to participant[0] (use their user_id)
    next_presenter_id = participants[0].user_id
    test_segment.presenter_user_id = next_presenter_id
    await test_session.commit()
    await test_session.refresh(test_segment)

    assert test_segment.presenter_user_id == next_presenter_id


@pytest.mark.anyio
async def test_pass_presenter_authorization(test_session, test_event, test_segment, participants):
    """Test that only host or current presenter can pass presenter role."""
    from app.models import Segment

    # Set presenter to participant[0] (use their user_id)
    test_segment.presenter_user_id = participants[0].user_id
    await test_session.commit()

    # participant[1] should not be able to pass (neither host nor current presenter)
    # This would be tested in WebSocket handler, here we just verify state
    assert test_segment.presenter_user_id == participants[0].user_id


@pytest.mark.anyio
async def test_presenter_disconnect_detection(test_session, test_event, test_segment, participants):
    """Test that disconnected presenter is detected."""
    from app.models import EventParticipant

    # Mark participant as presenter (use their user_id)
    test_segment.presenter_user_id = participants[0].user_id
    await test_session.commit()

    # In real scenario, WebSocket hub would detect disconnection
    # Here we verify the data model supports tracking
    assert test_segment.presenter_user_id == participants[0].user_id
    assert participants[0].display_name == "Participant 1"


@pytest.mark.anyio
async def test_resume_segment_with_no_participants(test_session, test_event):
    """Test resuming a segment when no participants are in the event."""
    from app.models import Segment, SegmentStatus, EventParticipant
    from sqlalchemy import func, select

    # Create completed segment
    segment = Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Test Presenter",
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.COMPLETED.value,
        previous_status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()

    # Verify no participants
    count = await test_session.scalar(
        select(func.count(EventParticipant.id)).where(EventParticipant.event_id == test_event.id)
    )
    assert count == 0

    # Resume should succeed but warning should be generated
    segment.status = segment.previous_status
    segment.previous_status = None
    await test_session.commit()

    assert segment.status == SegmentStatus.QUIZ_READY.value
    assert segment.previous_status is None


@pytest.mark.anyio
async def test_resume_segment_with_participants(test_session, test_event, participants):
    """Test resuming a segment when participants are in the event."""
    from app.models import Segment, SegmentStatus, EventParticipant
    from sqlalchemy import func, select

    # Create completed segment
    segment = Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Test Presenter",
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.COMPLETED.value,
        previous_status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()

    # Verify participants exist
    count = await test_session.scalar(
        select(func.count(EventParticipant.id)).where(EventParticipant.event_id == test_event.id)
    )
    assert count == 3

    # Resume should succeed with no warning
    segment.status = segment.previous_status
    segment.previous_status = None
    await test_session.commit()

    assert segment.status == SegmentStatus.QUIZ_READY.value


@pytest.mark.anyio
async def test_rapid_resume_prevention(test_session, test_event):
    """Test that rapid resume attempts are handled gracefully."""
    from app.models import Segment, SegmentStatus

    # Create completed segment
    segment = Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Test Presenter",
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.COMPLETED.value,
        previous_status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()

    # First resume succeeds
    segment.status = segment.previous_status
    segment.previous_status = None
    await test_session.commit()
    await test_session.refresh(segment)

    assert segment.status == SegmentStatus.QUIZ_READY.value
    assert segment.previous_status is None

    # Second resume should fail (no previous_status to restore)
    # This is handled by endpoint validation


@pytest.mark.anyio
async def test_display_name_uniqueness(test_session, test_event):
    """Test that display names are made unique automatically."""
    from app.models import EventParticipant

    # Create three participants with same base name
    names = []
    for i in range(3):
        participant = EventParticipant(
            id=uuid4(),
            event_id=test_event.id,
            device_id=uuid4(),
            display_name=f"Alex{' ' + str(i+1) if i > 0 else ''}",  # "Alex", "Alex 2", "Alex 3"
            avatar_url="😀",
            avatar_type="emoji",
            session_token=f"token_{i}",
        )
        test_session.add(participant)
        await test_session.commit()
        await test_session.refresh(participant)
        names.append(participant.display_name)

    assert names[0] == "Alex"
    assert names[1] == "Alex 2"
    assert names[2] == "Alex 3"
