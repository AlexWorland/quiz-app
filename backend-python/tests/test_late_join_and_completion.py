"""Tests for late join enforcement and completion messages."""

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.models import Event, EventParticipant, Segment, SegmentScore, SegmentStatus, User
from app.ws.game_handler import _maybe_emit_completion_payload
from app.ws.hub import hub
from app.ws.messages import EventCompleteMessage, ParticipantInfo


@pytest.mark.anyio
async def test_record_answer_blocks_late_join():
    event_id = uuid4()
    user_id = uuid4()

    session = await hub.get_or_create_session(event_id)
    now = datetime.now(timezone.utc)
    session.game_state.question_started_at = now
    session.game_state.time_limit_seconds = 30
    session.game_state.participants[user_id] = ParticipantInfo(
        user_id=user_id,
        username="late",
        joined_at=now + timedelta(seconds=1),
        join_status="waiting_for_segment",
        is_late_joiner=True,
    )

    success, reason = await hub.record_answer(
        event_id, user_id, "A", submitted_at=now + timedelta(seconds=2)
    )

    assert success is False
    assert reason == "late_join"


@pytest.mark.anyio
async def test_event_complete_emitted_when_all_segments_done(test_session):
    event = Event(
        id=uuid4(),
        host_id=uuid4(),
        title="Event",
        join_code="EVT001",
        status="active",
    )

    host_user = User(
        id=event.host_id,
        username="host",
        display_name="Host",
        email="host@example.com",
        password_hash="hash",
        role="host",
    )

    seg1 = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="P1",
        presenter_user_id=None,
        title="Seg1",
        status=SegmentStatus.COMPLETED.value,
        order_index=0,
    )
    seg2 = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="P2",
        presenter_user_id=None,
        title="Seg2",
        status=SegmentStatus.COMPLETED.value,
        order_index=1,
    )

    p1 = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Alice",
        avatar_url="😀",
        device_id=uuid4(),
        session_token="token",
        total_score=20,
        join_status="active_in_quiz",
    )
    p2 = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Bob",
        avatar_url="😎",
        device_id=uuid4(),
        session_token="token2",
        total_score=10,
        join_status="active_in_quiz",
    )

    ss1 = SegmentScore(
        id=uuid4(),
        segment_id=seg1.id,
        participant_id=p1.id,
        score=15,
        questions_answered=3,
        questions_correct=3,
    )
    ss2 = SegmentScore(
        id=uuid4(),
        segment_id=seg2.id,
        participant_id=p2.id,
        score=8,
        questions_answered=3,
        questions_correct=2,
    )

    test_session.add(host_user)
    await test_session.flush()

    test_session.add_all([event, seg1, seg2, p1, p2])
    await test_session.flush()

    test_session.add_all([ss1, ss2])
    await test_session.commit()

    message = await _maybe_emit_completion_payload(test_session, event.id)

    assert isinstance(message, EventCompleteMessage)
    assert message.event_id == event.id
    assert message.winner is not None
    assert message.winner["user_id"] == p1.id
    assert len(message.segment_winners) == 2

