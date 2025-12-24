"""Tests for host WebSocket control helpers."""

from uuid import uuid4

import pytest

from app.models import Event, Segment, User
from app.ws.game_handler import _build_question_payload, _can_control_segment


def _make_user(username: str) -> User:
    return User(
        id=uuid4(),
        username=username,
        display_name=username,
        email=f"{username}@example.com",
        password_hash="hash",
    )


@pytest.mark.anyio
async def test_can_control_segment_allows_host_or_presenter(test_session):
    host = _make_user("host-user")
    presenter = _make_user("presenter-user")
    other = _make_user("other-user")

    event = Event(
        id=uuid4(),
        host_id=host.id,
        title="Event",
        join_code="JOIN01",
        mode="normal",
    )
    segment = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Presenter",
        presenter_user_id=presenter.id,
        title="Segment",
    )

    test_session.add_all([host, presenter, other])
    await test_session.flush()

    test_session.add_all([event, segment])
    await test_session.commit()

    assert _can_control_segment(event, segment, host.id) is True
    assert _can_control_segment(event, segment, presenter.id) is True
    assert _can_control_segment(event, segment, other.id) is False


def test_build_question_payload_has_expected_shape():
    question_id = uuid4()
    message = _build_question_payload(
        question_id=question_id,
        question_text="What is 2+2?",
        correct_answer="4",
        total_questions=3,
        time_limit=25,
        index=1,
    )

    assert message.question_id == question_id
    assert message.question_number == 2  # index is zero-based
    assert message.total_questions == 3
    assert message.text == "What is 2+2?"
    assert message.answers == ["4"]
    assert message.time_limit == 25

