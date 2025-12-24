"""Tests for event export functionality."""

import csv
import io
import json
import pytest
from uuid import uuid4

from app.models import Event, Segment, Question, EventParticipant, EventStatus, SegmentStatus
from app.services.export import export_event_data, export_to_json, export_to_csv


@pytest.fixture
def test_event_with_data(test_user):
    """Create event with segments, questions, and participants."""
    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Export Test Event",
        join_code="EXPORT",
        status=EventStatus.FINISHED.value,
    )

    segment1 = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Presenter 1",
        title="Segment 1",
        status=SegmentStatus.COMPLETED.value,
        order_index=0,
    )

    segment2 = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name="Presenter 2",
        title="Segment 2",
        status=SegmentStatus.COMPLETED.value,
        order_index=1,
    )

    question1 = Question(
        id=uuid4(),
        segment_id=segment1.id,
        question_text="Question 1",
        correct_answer="Answer 1",
        order_index=0,
    )

    question2 = Question(
        id=uuid4(),
        segment_id=segment1.id,
        question_text="Question 2",
        correct_answer="Answer 2",
        order_index=1,
    )

    question3 = Question(
        id=uuid4(),
        segment_id=segment2.id,
        question_text="Question 3",
        correct_answer="Answer 3",
        order_index=0,
    )

    participant1 = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        device_id=uuid4(),
        display_name="Player 1",
        total_score=100,
        is_late_joiner=False,
    )

    participant2 = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        device_id=uuid4(),
        display_name="Player 2",
        total_score=80,
        is_late_joiner=False,
    )

    participant3 = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        device_id=uuid4(),
        display_name="Late Player",
        total_score=50,
        is_late_joiner=True,
    )

    return {
        "event": event,
        "segments": [segment1, segment2],
        "questions": [question1, question2, question3],
        "participants": [participant1, participant2, participant3],
    }


@pytest.mark.asyncio
async def test_export_event_data_structure(test_session, test_user, test_event_with_data):
    """Should export complete event data structure."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    for segment in data["segments"]:
        test_session.add(segment)
    for question in data["questions"]:
        test_session.add(question)
    for participant in data["participants"]:
        test_session.add(participant)
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    assert "event" in result
    assert "segments" in result
    assert "participants" in result
    assert "final_leaderboard" in result
    assert "exported_at" in result


@pytest.mark.asyncio
async def test_export_event_metadata(test_session, test_user, test_event_with_data):
    """Should include event metadata."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    assert result["event"]["title"] == "Export Test Event"
    assert result["event"]["join_code"] == "EXPORT"
    assert result["event"]["status"] == EventStatus.FINISHED.value


@pytest.mark.asyncio
async def test_export_segments_with_questions(test_session, test_user, test_event_with_data):
    """Should export segments with their questions."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    for segment in data["segments"]:
        test_session.add(segment)
    for question in data["questions"]:
        test_session.add(question)
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    assert len(result["segments"]) == 2
    assert result["segments"][0]["title"] == "Segment 1"
    assert len(result["segments"][0]["questions"]) == 2
    assert result["segments"][1]["title"] == "Segment 2"
    assert len(result["segments"][1]["questions"]) == 1


@pytest.mark.asyncio
async def test_export_participants_data(test_session, test_user, test_event_with_data):
    """Should export all participants."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    for participant in data["participants"]:
        test_session.add(participant)
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    assert len(result["participants"]) == 3
    assert result["participants"][0]["display_name"] == "Player 1"
    assert result["participants"][0]["total_score"] == 100


@pytest.mark.asyncio
async def test_export_leaderboard_sorted(test_session, test_user, test_event_with_data):
    """Should sort leaderboard by score descending."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    for participant in data["participants"]:
        test_session.add(participant)
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    leaderboard = result["final_leaderboard"]
    assert len(leaderboard) == 3
    assert leaderboard[0]["rank"] == 1
    assert leaderboard[0]["display_name"] == "Player 1"
    assert leaderboard[0]["score"] == 100
    assert leaderboard[1]["rank"] == 2
    assert leaderboard[1]["score"] == 80
    assert leaderboard[2]["rank"] == 3
    assert leaderboard[2]["score"] == 50


@pytest.mark.asyncio
async def test_export_marks_late_joiners(test_session, test_user, test_event_with_data):
    """Should mark late joiners in export."""
    data = test_event_with_data
    test_session.add(test_user)
    test_session.add(data["event"])
    for participant in data["participants"]:
        test_session.add(participant)
    await test_session.commit()

    result = await export_event_data(test_session, data["event"].id)

    leaderboard = result["final_leaderboard"]
    late_joiner = next(p for p in leaderboard if p["display_name"] == "Late Player")
    assert late_joiner["is_late_joiner"] is True


@pytest.mark.asyncio
async def test_export_nonexistent_event(test_session):
    """Should raise error for nonexistent event."""
    with pytest.raises(ValueError, match="Event not found"):
        await export_event_data(test_session, uuid4())


@pytest.mark.asyncio
async def test_export_empty_event(test_session, test_user):
    """Should handle event with no segments or participants."""
    event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Empty Event",
        join_code="EMPTY",
        status=EventStatus.WAITING.value,
    )
    test_session.add(test_user)
    test_session.add(event)
    await test_session.commit()

    result = await export_event_data(test_session, event.id)

    assert len(result["segments"]) == 0
    assert len(result["participants"]) == 0
    assert len(result["final_leaderboard"]) == 0


def test_export_to_json_format():
    """Should format data as valid JSON."""
    data = {
        "event": {"id": "123", "title": "Test"},
        "segments": [],
        "participants": [],
        "final_leaderboard": [],
        "exported_at": "2024-01-01T00:00:00Z",
    }

    json_str = export_to_json(data)

    # Should be valid JSON
    parsed = json.loads(json_str)
    assert parsed["event"]["title"] == "Test"


def test_export_to_csv_format():
    """Should format leaderboard as CSV."""
    data = {
        "final_leaderboard": [
            {"rank": 1, "display_name": "Player 1", "score": 100, "is_late_joiner": False},
            {"rank": 2, "display_name": "Player 2", "score": 80, "is_late_joiner": True},
        ]
    }

    csv_str = export_to_csv(data)

    # Parse CSV
    reader = csv.DictReader(io.StringIO(csv_str))
    rows = list(reader)

    assert len(rows) == 2
    assert rows[0]["Rank"] == "1"
    assert rows[0]["Display Name"] == "Player 1"
    assert rows[0]["Score"] == "100"
    assert rows[0]["Late Joiner"] == "No"
    assert rows[1]["Late Joiner"] == "Yes"


def test_export_to_csv_empty_leaderboard():
    """Should handle empty leaderboard in CSV."""
    data = {"final_leaderboard": []}

    csv_str = export_to_csv(data)

    # Should have header only
    lines = csv_str.strip().split("\n")
    assert len(lines) == 1
    assert "Rank" in lines[0]


def test_export_to_json_preserves_structure():
    """Should preserve nested data structure in JSON."""
    data = {
        "event": {"id": "123"},
        "segments": [
            {"id": "seg1", "questions": [{"id": "q1"}]},
            {"id": "seg2", "questions": [{"id": "q2"}, {"id": "q3"}]},
        ],
        "participants": [{"id": "p1"}],
        "final_leaderboard": [{"rank": 1}],
        "exported_at": "2024-01-01",
    }

    json_str = export_to_json(data)
    parsed = json.loads(json_str)

    assert len(parsed["segments"]) == 2
    assert len(parsed["segments"][0]["questions"]) == 1
    assert len(parsed["segments"][1]["questions"]) == 2
