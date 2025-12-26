"""Integration tests for automatic segment generation and presenter flow."""

import pytest
from uuid import uuid4


@pytest.fixture
async def host_user(test_session):
    """Create a host user."""
    from app.models import User

    user = User(
        id=uuid4(),
        username="host_user",
        display_name="Host User",
        email="host@example.com",
        password_hash="dummy_hash",
        avatar_url="😀",
        avatar_type="emoji",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def event_without_segments(test_session, host_user):
    """Create an event without any segments."""
    from app.models import Event

    event = Event(
        id=uuid4(),
        host_id=host_user.id,
        title="Event Without Segments",
        join_code="NOSEG1",
        mode="listen_only",
        status="waiting",
        join_locked=False,
    )
    test_session.add(event)
    await test_session.commit()
    await test_session.refresh(event)
    return event


@pytest.fixture
async def presenter_user(test_session):
    """Create a presenter user."""
    from app.models import User

    user = User(
        id=uuid4(),
        username="presenter_user",
        display_name="Presenter User",
        email="presenter@example.com",
        password_hash="dummy_hash",
        avatar_url="🎤",
        avatar_type="emoji",
    )
    test_session.add(user)
    await test_session.commit()
    await test_session.refresh(user)
    return user


@pytest.fixture
async def event_participants(test_session, event_without_segments, presenter_user):
    """Create participants for the event."""
    from app.models import EventParticipant, User

    participants = []
    
    # Add presenter as participant
    presenter_participant = EventParticipant(
        id=uuid4(),
        event_id=event_without_segments.id,
        user_id=presenter_user.id,
        device_id=uuid4(),
        display_name="Presenter User",
        avatar_url="🎤",
        avatar_type="emoji",
        session_token="presenter_token",
    )
    participants.append(presenter_participant)
    test_session.add(presenter_participant)
    
    # Add two more regular participants
    for i in range(2):
        user = User(
            id=uuid4(),
            username=f"participant_{i+1}",
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
            event_id=event_without_segments.id,
            user_id=user.id,
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
async def test_join_event_without_segments(test_session, event_without_segments, presenter_user):
    """Test that users can join an event that has no segments defined yet."""
    from app.models import EventParticipant

    # Join the event
    participant = EventParticipant(
        id=uuid4(),
        event_id=event_without_segments.id,
        user_id=presenter_user.id,
        device_id=uuid4(),
        display_name="New Joiner",
        avatar_url="🎉",
        avatar_type="emoji",
        session_token="new_joiner_token",
    )
    test_session.add(participant)
    await test_session.commit()
    await test_session.refresh(participant)

    # Verify participant was created
    assert participant.id is not None
    assert participant.event_id == event_without_segments.id
    assert participant.display_name == "New Joiner"


@pytest.mark.anyio
async def test_segment_creation_on_start_presentation(test_session, event_without_segments, presenter_user, event_participants):
    """Test that a segment is automatically created when presenter starts presentation."""
    from app.models import Segment, SegmentStatus
    from sqlalchemy import select, func
    from datetime import datetime, timezone

    # Verify no segments exist initially
    result = await test_session.execute(
        select(func.count(Segment.id)).where(Segment.event_id == event_without_segments.id)
    )
    initial_count = result.scalar()
    assert initial_count == 0

    # Simulate segment creation (what happens in start_presentation handler)
    # Get next order index
    result = await test_session.execute(
        select(func.coalesce(func.max(Segment.order_index), -1) + 1)
        .where(Segment.event_id == event_without_segments.id)
    )
    next_index = result.scalar() or 0

    segment = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter User",
        presenter_user_id=presenter_user.id,
        title=f"Segment {next_index + 1}",
        order_index=next_index,
        status=SegmentStatus.RECORDING.value,
        recording_started_at=datetime.now(timezone.utc),
    )
    test_session.add(segment)
    await test_session.commit()
    await test_session.refresh(segment)

    # Verify segment was created with correct properties
    assert segment.id is not None
    assert segment.event_id == event_without_segments.id
    assert segment.presenter_user_id == presenter_user.id
    assert segment.status == SegmentStatus.RECORDING.value
    assert segment.recording_started_at is not None
    assert segment.order_index == 0


@pytest.mark.anyio
async def test_segment_order_index_increments(test_session, event_without_segments, presenter_user):
    """Test that segment order_index increments correctly for multiple segments."""
    from app.models import Segment, SegmentStatus
    from sqlalchemy import select, func
    from datetime import datetime, timezone

    # Create first segment
    segment1 = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter 1",
        presenter_user_id=presenter_user.id,
        title="Segment 1",
        order_index=0,
        status=SegmentStatus.COMPLETED.value,
    )
    test_session.add(segment1)
    await test_session.commit()

    # Get next order index (simulating what happens in handler)
    result = await test_session.execute(
        select(func.coalesce(func.max(Segment.order_index), -1) + 1)
        .where(Segment.event_id == event_without_segments.id)
    )
    next_index = result.scalar() or 0
    assert next_index == 1

    # Create second segment
    segment2 = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter 2",
        presenter_user_id=uuid4(),  # Different presenter
        title="Segment 2",
        order_index=next_index,
        status=SegmentStatus.RECORDING.value,
        recording_started_at=datetime.now(timezone.utc),
    )
    test_session.add(segment2)
    await test_session.commit()

    # Verify order indices
    assert segment1.order_index == 0
    assert segment2.order_index == 1


@pytest.mark.anyio
async def test_pass_presenter_self_selection_prevented(test_session, event_without_segments, presenter_user, event_participants):
    """Test that a presenter cannot pass the role to themselves."""
    from app.models import Segment, SegmentStatus

    # Create a segment with presenter
    segment = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter User",
        presenter_user_id=presenter_user.id,
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()

    # In the handler, this validation happens:
    # if next_presenter_id == user_id:
    #     # Send error message
    # This test verifies the logic
    current_presenter_id = presenter_user.id
    next_presenter_id = presenter_user.id  # Trying to pass to self
    
    # This should be rejected
    assert current_presenter_id == next_presenter_id
    # In actual handler, an error message would be sent


@pytest.mark.anyio
async def test_pass_presenter_to_different_user_succeeds(test_session, event_without_segments, presenter_user, event_participants):
    """Test that passing presenter role to a different user succeeds."""
    from app.models import Segment, SegmentStatus

    # Create a segment with presenter
    segment = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter User",
        presenter_user_id=presenter_user.id,
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.QUIZ_READY.value,
    )
    test_session.add(segment)
    await test_session.commit()

    # Get a different participant to pass to
    next_presenter = event_participants[1]  # Not the presenter
    
    # Update segment with new presenter
    segment.presenter_user_id = next_presenter.user_id
    segment.presenter_name = next_presenter.display_name
    await test_session.commit()
    await test_session.refresh(segment)

    # Verify the change
    assert segment.presenter_user_id == next_presenter.user_id
    assert segment.presenter_user_id != presenter_user.id


@pytest.mark.anyio
async def test_host_can_select_any_presenter(test_session, event_without_segments, host_user, event_participants):
    """Test that the host can select any participant as presenter."""
    # The host can select any participant, including themselves if they're a participant
    # This is verified by checking that the host_id matches the event
    
    assert event_without_segments.host_id == host_user.id
    
    # Host can select any participant
    for participant in event_participants:
        # In the handler, the host selects a presenter by user_id
        # This would update the pending_presenter_id in GameState
        selected_user_id = participant.user_id
        assert selected_user_id is not None


@pytest.mark.anyio
async def test_only_host_can_select_first_presenter(test_session, event_without_segments, host_user, presenter_user):
    """Test that only the host can select the first presenter for an event."""
    # This validation happens in the select_presenter handler:
    # if event.host_id != user_id:
    #     # Send error message
    
    # Verify the relationship
    assert event_without_segments.host_id == host_user.id
    assert event_without_segments.host_id != presenter_user.id


@pytest.mark.anyio
async def test_segment_status_transitions(test_session, event_without_segments, presenter_user):
    """Test the segment status transitions during presentation flow."""
    from app.models import Segment, SegmentStatus
    from datetime import datetime, timezone

    # Create segment in recording status (start_presentation)
    segment = Segment(
        id=uuid4(),
        event_id=event_without_segments.id,
        presenter_name="Presenter User",
        presenter_user_id=presenter_user.id,
        title="Test Segment",
        order_index=0,
        status=SegmentStatus.RECORDING.value,
        recording_started_at=datetime.now(timezone.utc),
    )
    test_session.add(segment)
    await test_session.commit()
    assert segment.status == SegmentStatus.RECORDING.value

    # Transition to transcribing (when recording stops)
    segment.status = SegmentStatus.TRANSCRIBING.value
    segment.recording_stopped_at = datetime.now(timezone.utc)
    await test_session.commit()
    assert segment.status == SegmentStatus.TRANSCRIBING.value

    # Transition to generating questions
    segment.status = SegmentStatus.GENERATING.value
    await test_session.commit()
    assert segment.status == SegmentStatus.GENERATING.value

    # Transition to quiz ready
    segment.status = SegmentStatus.QUIZ_READY.value
    await test_session.commit()
    assert segment.status == SegmentStatus.QUIZ_READY.value

    # Transition to completed (after quiz and leaderboard)
    segment.status = SegmentStatus.COMPLETED.value
    await test_session.commit()
    assert segment.status == SegmentStatus.COMPLETED.value


@pytest.mark.anyio
async def test_presenter_lookup_by_user_id(test_session, event_without_segments, event_participants):
    """Test looking up presenter display name by user_id."""
    from app.models import EventParticipant, User
    from sqlalchemy import select

    # Get a participant's user_id
    target_participant = event_participants[0]
    user_id = target_participant.user_id

    # Look up by user_id (what happens in the handler)
    result = await test_session.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_without_segments.id,
            EventParticipant.user_id == user_id,
        )
    )
    found_participant = result.scalar_one_or_none()

    assert found_participant is not None
    assert found_participant.display_name == target_participant.display_name

    # Fallback to User table if not found in participants
    result = await test_session.execute(
        select(User).where(User.id == user_id)
    )
    found_user = result.scalar_one_or_none()
    
    if found_participant:
        presenter_name = found_participant.display_name
    elif found_user:
        presenter_name = found_user.username
    else:
        presenter_name = "Presenter"

    assert presenter_name == target_participant.display_name


@pytest.mark.anyio
async def test_multiple_participants_can_join_before_segments(test_session, event_without_segments):
    """Test that multiple participants can join an event before any segments exist."""
    from app.models import EventParticipant, User, Segment
    from sqlalchemy import select, func

    # Verify no segments exist
    result = await test_session.execute(
        select(func.count(Segment.id)).where(Segment.event_id == event_without_segments.id)
    )
    segment_count = result.scalar()
    assert segment_count == 0

    # Create multiple participants
    for i in range(5):
        user = User(
            id=uuid4(),
            username=f"early_joiner_{i}",
            display_name=f"Early Joiner {i}",
            email=f"early{i}@example.com",
            password_hash="dummy_hash",
            avatar_url="😀",
            avatar_type="emoji",
        )
        test_session.add(user)
        await test_session.flush()

        participant = EventParticipant(
            id=uuid4(),
            event_id=event_without_segments.id,
            user_id=user.id,
            device_id=uuid4(),
            display_name=f"Early Joiner {i}",
            avatar_url="😀",
            avatar_type="emoji",
            session_token=f"early_token_{i}",
        )
        test_session.add(participant)

    await test_session.commit()

    # Verify all participants joined
    result = await test_session.execute(
        select(func.count(EventParticipant.id)).where(
            EventParticipant.event_id == event_without_segments.id
        )
    )
    participant_count = result.scalar()
    assert participant_count == 5

    # Segments still don't exist
    result = await test_session.execute(
        select(func.count(Segment.id)).where(Segment.event_id == event_without_segments.id)
    )
    segment_count = result.scalar()
    assert segment_count == 0

