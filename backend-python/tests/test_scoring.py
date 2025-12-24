"""Tests for quiz scoring pipeline."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest
from sqlalchemy import select

from app.models import (
    Event,
    EventParticipant,
    JoinStatus,
    Segment,
    SegmentScore,
    SegmentStatus,
)
from app.services.scoring import apply_score
from app.ws.game_handler import (
    _apply_zero_scores_for_unanswered,
    _get_event_leaderboard,
    _get_segment_leaderboard,
)
from app.ws.hub import hub
from app.ws.messages import ParticipantInfo


@pytest.mark.anyio
async def test_apply_score_updates_totals(test_session, test_user):
    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Scoring Event",
        join_code="SC-APPLY-1",
        status="active",
    )
    segment = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Host",
        status=SegmentStatus.QUIZ_READY.value,
    )
    participant = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Alice",
        avatar_url="😀",
        device_id=uuid4(),
        session_token="token-1",
        join_status=JoinStatus.ACTIVE_IN_QUIZ.value,
    )

    test_session.add_all([event, segment, participant])
    await test_session.commit()

    await apply_score(
        test_session,
        segment_id=segment.id,
        participant_id=participant.id,
        delta_score=120,
        is_correct=True,
        response_time_ms=1500,
    )

    score_row = (
        await test_session.execute(
            select(SegmentScore).where(
                SegmentScore.segment_id == segment.id,
                SegmentScore.participant_id == participant.id,
            )
        )
    ).scalar_one()
    participant_row = await test_session.get(EventParticipant, participant.id)

    assert score_row.score == 120
    assert score_row.questions_answered == 1
    assert score_row.questions_correct == 1
    assert score_row.total_response_time_ms == 1500
    assert participant_row.total_score == 120
    assert participant_row.total_response_time_ms == 1500


@pytest.mark.anyio
async def test_zero_fill_marks_waiting_and_is_idempotent(test_session, test_user):
    hub.event_sessions.clear()
    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Zero Fill Event",
        join_code="SC-ZERO-1",
        status="active",
    )
    segment = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Host",
        status=SegmentStatus.QUIZ_READY.value,
    )
    answered = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Answered",
        avatar_url="😀",
        device_id=uuid4(),
        session_token="token-answered",
        join_status=JoinStatus.ACTIVE_IN_QUIZ.value,
    )
    waiting = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Waiting",
        avatar_url="😎",
        device_id=uuid4(),
        session_token="token-waiting",
        join_status=JoinStatus.WAITING_FOR_SEGMENT.value,
        is_late_joiner=True,
    )

    test_session.add_all([event, segment, answered, waiting])
    await test_session.commit()

    # Prepare in-memory session state
    event_session = await hub.get_or_create_session(event.id)
    question_id = uuid4()
    event_session.game_state.current_segment_id = segment.id
    event_session.game_state.current_question_id = question_id
    event_session.game_state.current_question_index = 0
    event_session.game_state.question_started_at = datetime.now(timezone.utc)
    event_session.game_state.time_limit_seconds = 30
    event_session.game_state.participants = {
        answered.id: ParticipantInfo(
            user_id=answered.id,
            username=answered.display_name,
            avatar_url=answered.avatar_url,
            join_status=answered.join_status,
            is_late_joiner=False,
            joined_at=datetime.now(timezone.utc),
        ),
        waiting.id: ParticipantInfo(
            user_id=waiting.id,
            username=waiting.display_name,
            avatar_url=waiting.avatar_url,
            join_status=waiting.join_status,
            is_late_joiner=True,
            joined_at=datetime.now(timezone.utc),
        ),
    }
    event_session.game_state.answers_received[answered.id] = "A"

    await apply_score(
        test_session,
        segment_id=segment.id,
        participant_id=answered.id,
        delta_score=200,
        is_correct=True,
        response_time_ms=1200,
    )

    await _apply_zero_scores_for_unanswered(test_session, event_session)

    zero_score = (
        await test_session.execute(
            select(SegmentScore).where(
                SegmentScore.segment_id == segment.id,
                SegmentScore.participant_id == waiting.id,
            )
        )
    ).scalar_one()
    waiting_row = await test_session.get(EventParticipant, waiting.id)

    assert zero_score.score == 0
    assert zero_score.questions_answered == 1
    assert zero_score.questions_correct == 0
    assert zero_score.total_response_time_ms == 0
    assert waiting_row.join_status == JoinStatus.ACTIVE_IN_QUIZ.value
    assert question_id in event_session.game_state.scored_question_ids

    # Second call should be a no-op
    await _apply_zero_scores_for_unanswered(test_session, event_session)
    zero_score_again = (
        await test_session.execute(
            select(SegmentScore).where(
                SegmentScore.segment_id == segment.id,
                SegmentScore.participant_id == waiting.id,
            )
        )
    ).scalar_one()
    assert zero_score_again.questions_answered == 1


@pytest.mark.anyio
async def test_leaderboard_orders_by_score_then_time(test_session, test_user):
    hub.event_sessions.clear()
    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Leaderboard Event",
        join_code="SC-LB-1",
        status="active",
    )
    segment = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Host",
        status=SegmentStatus.QUIZ_READY.value,
    )
    fast = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Fast",
        avatar_url="😀",
        device_id=uuid4(),
        session_token="token-fast",
        join_status=JoinStatus.ACTIVE_IN_QUIZ.value,
    )
    slow = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        display_name="Slow",
        avatar_url="🙂",
        device_id=uuid4(),
        session_token="token-slow",
        join_status=JoinStatus.ACTIVE_IN_QUIZ.value,
    )

    test_session.add_all([event, segment, fast, slow])
    await test_session.commit()

    await apply_score(
        test_session,
        segment_id=segment.id,
        participant_id=fast.id,
        delta_score=300,
        is_correct=True,
        response_time_ms=800,
    )
    await apply_score(
        test_session,
        segment_id=segment.id,
        participant_id=slow.id,
        delta_score=300,
        is_correct=True,
        response_time_ms=1500,
    )

    segment_lb = await _get_segment_leaderboard(test_session, segment.id)
    event_lb = await _get_event_leaderboard(test_session, event.id)

    assert segment_lb[0]["user_id"] == fast.id
    assert segment_lb[1]["user_id"] == slow.id
    assert event_lb[0]["user_id"] == fast.id
    assert event_lb[1]["user_id"] == slow.id

