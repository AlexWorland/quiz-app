"""Tests for mega quiz WebSocket messages."""

import pytest
from uuid import uuid4

from app.ws.messages import (
    StartMegaQuizMessage,
    SkipMegaQuizMessage,
    MegaQuizReadyMessage,
    MegaQuizStartedMessage,
    parse_client_message,
)


def test_start_mega_quiz_message_with_count():
    """Should parse start_mega_quiz message with question count."""
    data = {"type": "start_mega_quiz", "question_count": 15}

    message = parse_client_message(data)

    assert isinstance(message, StartMegaQuizMessage)
    assert message.type == "start_mega_quiz"
    assert message.question_count == 15


def test_start_mega_quiz_message_without_count():
    """Should parse start_mega_quiz message without question count."""
    data = {"type": "start_mega_quiz"}

    message = parse_client_message(data)

    assert isinstance(message, StartMegaQuizMessage)
    assert message.type == "start_mega_quiz"
    assert message.question_count is None


def test_skip_mega_quiz_message():
    """Should parse skip_mega_quiz message."""
    data = {"type": "skip_mega_quiz"}

    message = parse_client_message(data)

    assert isinstance(message, SkipMegaQuizMessage)
    assert message.type == "skip_mega_quiz"


def test_mega_quiz_ready_message():
    """Should create mega_quiz_ready server message."""
    event_id = uuid4()
    leaderboard = [
        {"rank": 1, "username": "Player1", "score": 100},
        {"rank": 2, "username": "Player2", "score": 80},
    ]

    message = MegaQuizReadyMessage(
        event_id=event_id,
        available_questions=25,
        current_leaderboard=leaderboard,
    )

    assert message.type == "mega_quiz_ready"
    assert message.event_id == event_id
    assert message.available_questions == 25
    assert len(message.current_leaderboard) == 2
    assert message.current_leaderboard[0]["username"] == "Player1"
    assert message.is_single_segment is False
    assert message.single_segment_mode is None


def test_mega_quiz_started_message():
    """Should create mega_quiz_started server message."""
    event_id = uuid4()

    message = MegaQuizStartedMessage(
        event_id=event_id,
        question_count=12,
    )

    assert message.type == "mega_quiz_started"
    assert message.event_id == event_id
    assert message.question_count == 12


def test_mega_quiz_ready_message_serialization():
    """Should serialize to JSON correctly."""
    event_id = uuid4()
    leaderboard = [{"rank": 1, "username": "Player1", "score": 100}]

    message = MegaQuizReadyMessage(
        event_id=event_id,
        available_questions=10,
        current_leaderboard=leaderboard,
    )

    data = message.model_dump()

    assert data["type"] == "mega_quiz_ready"
    assert data["event_id"] == event_id
    assert data["available_questions"] == 10
    assert data["current_leaderboard"] == leaderboard
    assert data["is_single_segment"] is False
    assert data["single_segment_mode"] is None


def test_mega_quiz_started_message_serialization():
    """Should serialize to JSON correctly."""
    event_id = uuid4()

    message = MegaQuizStartedMessage(
        event_id=event_id,
        question_count=8,
    )

    data = message.model_dump()

    assert data["type"] == "mega_quiz_started"
    assert data["event_id"] == event_id
    assert data["question_count"] == 8


def test_mega_quiz_ready_single_segment_fields():
    """Should include single segment metadata when provided."""
    event_id = uuid4()
    leaderboard = [{"rank": 1, "username": "Player1", "score": 100}]

    message = MegaQuizReadyMessage(
        event_id=event_id,
        available_questions=4,
        current_leaderboard=leaderboard,
        is_single_segment=True,
        single_segment_mode="remix",
    )

    assert message.is_single_segment is True
    assert message.single_segment_mode == "remix"


def test_start_mega_quiz_with_zero_count():
    """Should handle zero question count."""
    data = {"type": "start_mega_quiz", "question_count": 0}

    message = parse_client_message(data)

    assert isinstance(message, StartMegaQuizMessage)
    assert message.question_count == 0


def test_start_mega_quiz_with_large_count():
    """Should handle large question counts."""
    data = {"type": "start_mega_quiz", "question_count": 100}

    message = parse_client_message(data)

    assert isinstance(message, StartMegaQuizMessage)
    assert message.question_count == 100


def test_mega_quiz_ready_with_empty_leaderboard():
    """Should handle empty leaderboard."""
    event_id = uuid4()

    message = MegaQuizReadyMessage(
        event_id=event_id,
        available_questions=5,
        current_leaderboard=[],
    )

    assert message.type == "mega_quiz_ready"
    assert len(message.current_leaderboard) == 0


def test_mega_quiz_messages_in_parser():
    """Parser should recognize mega quiz message types."""
    start_msg = parse_client_message({"type": "start_mega_quiz"})
    skip_msg = parse_client_message({"type": "skip_mega_quiz"})

    assert start_msg is not None
    assert skip_msg is not None
    assert isinstance(start_msg, StartMegaQuizMessage)
    assert isinstance(skip_msg, SkipMegaQuizMessage)
