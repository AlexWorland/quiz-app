"""Tests for presenter pause and resume behaviors."""

from datetime import datetime, timezone
from uuid import uuid4

import pytest

from app.ws.hub import hub
from app.ws.messages import QuizPhase


@pytest.mark.anyio
async def test_record_answer_rejected_when_presenter_paused():
    """Ensure answers are rejected while presenter_paused is active."""
    event_id = uuid4()
    user_id = uuid4()

    session = await hub.get_or_create_session(event_id)
    session.game_state.presenter_paused = True
    session.game_state.current_question_id = uuid4()
    session.game_state.question_started_at = datetime.now(timezone.utc)

    success, reason = await hub.record_answer(
        event_id,
        user_id,
        "A",
        submitted_at=datetime.now(timezone.utc),
    )

    assert not success
    assert reason == "paused"

    # Clean up hub state for other tests
    hub.event_sessions.pop(event_id, None)


@pytest.mark.anyio
async def test_pause_flag_can_be_cleared_for_resume():
    """Presenter pause flag should clear cleanly when resuming."""
    event_id = uuid4()
    session = await hub.get_or_create_session(event_id)

    session.game_state.presenter_paused = True
    session.game_state.quiz_phase = QuizPhase.PRESENTER_PAUSED

    await hub.update_game_state(
        event_id,
        presenter_paused=False,
        quiz_phase=QuizPhase.SHOWING_QUESTION,
    )

    state = hub.get_game_state(event_id)
    assert state is not None
    assert state.presenter_paused is False
    assert state.quiz_phase == QuizPhase.SHOWING_QUESTION

    hub.event_sessions.pop(event_id, None)

