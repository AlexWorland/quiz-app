"""Tests for mega quiz service."""

import pytest
from uuid import uuid4

from app.models import Event, Segment, Question, EventStatus, SegmentStatus
from app.services.mega_quiz import (
    MegaQuizMetadata,
    aggregate_event_questions,
    count_event_questions,
    get_mega_quiz_metadata,
    should_emit_mega_quiz_ready,
)


@pytest.fixture
def test_event(test_user):
    """Create a test event."""
    return Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Multi-Segment Event",
        join_code="MEGA01",
        status=EventStatus.ACTIVE.value,
    )


@pytest.fixture
def test_segments(test_event):
    """Create multiple test segments."""
    return [
        Segment(
            id=uuid4(),
            event_id=test_event.id,
            presenter_name="Presenter 1",
            status=SegmentStatus.COMPLETED.value,
            order_index=0,
        ),
        Segment(
            id=uuid4(),
            event_id=test_event.id,
            presenter_name="Presenter 2",
            status=SegmentStatus.COMPLETED.value,
            order_index=1,
        ),
        Segment(
            id=uuid4(),
            event_id=test_event.id,
            presenter_name="Presenter 3",
            status=SegmentStatus.COMPLETED.value,
            order_index=2,
        ),
    ]


@pytest.mark.asyncio
async def test_aggregate_questions_from_multiple_segments(test_session, test_user, test_event, test_segments):
    """Mega quiz should aggregate questions from all segments."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Add questions to each segment
    all_question_ids = []
    for i, segment in enumerate(test_segments):
        for j in range(3):  # 3 questions per segment
            question = Question(
                id=uuid4(),
                segment_id=segment.id,
                question_text=f"Question {j+1} from Segment {i+1}",
                correct_answer=f"Answer {j+1}",
                order_index=j,
            )
            test_session.add(question)
            all_question_ids.append(question.id)
    await test_session.commit()

    # Aggregate questions
    questions = await aggregate_event_questions(test_session, test_event.id)

    # Should have all 9 questions (3 segments × 3 questions)
    assert len(questions) == 9

    # Questions should be from different segments
    segment_ids = {q.segment_id for q in questions}
    assert len(segment_ids) == 3


@pytest.mark.asyncio
async def test_aggregate_questions_respects_max_limit(test_session, test_user, test_event, test_segments):
    """Mega quiz should respect max_questions limit."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Add 15 total questions
    for segment in test_segments:
        for j in range(5):
            question = Question(
                id=uuid4(),
                segment_id=segment.id,
                question_text=f"Question {j}",
                correct_answer=f"Answer {j}",
                order_index=j,
            )
            test_session.add(question)
    await test_session.commit()

    # Request only 10 questions
    questions = await aggregate_event_questions(test_session, test_event.id, max_questions=10)

    assert len(questions) == 10


@pytest.mark.asyncio
async def test_aggregate_questions_shuffles_results(test_session, test_user, test_event, test_segments):
    """Mega quiz should shuffle questions for fairness."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Add questions with specific order
    for i, segment in enumerate(test_segments):
        for j in range(5):
            question = Question(
                id=uuid4(),
                segment_id=segment.id,
                question_text=f"Segment{i}_Q{j}",
                correct_answer=f"Answer {j}",
                order_index=j,
            )
            test_session.add(question)
    await test_session.commit()

    # Get questions multiple times
    result1 = await aggregate_event_questions(test_session, test_event.id)
    result2 = await aggregate_event_questions(test_session, test_event.id)

    # Results should likely be in different order (shuffled)
    # Note: There's a tiny chance they're the same, but very unlikely
    texts1 = [q.question_text for q in result1]
    texts2 = [q.question_text for q in result2]

    # At least one should be different (very high probability with 15 items)
    assert texts1 != texts2 or len(texts1) < 3  # Allow same order only if very few items


@pytest.mark.asyncio
async def test_aggregate_questions_empty_event(test_session, test_user, test_event):
    """Mega quiz should handle events with no segments gracefully."""
    test_session.add(test_user)
    test_session.add(test_event)
    await test_session.commit()

    questions = await aggregate_event_questions(test_session, test_event.id)

    assert questions == []


@pytest.mark.asyncio
async def test_aggregate_questions_segments_without_questions(test_session, test_user, test_event, test_segments):
    """Mega quiz should handle segments with no questions."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Don't add any questions
    questions = await aggregate_event_questions(test_session, test_event.id)

    assert questions == []


@pytest.mark.asyncio
async def test_count_event_questions(test_session, test_user, test_event, test_segments):
    """Should accurately count total questions across all segments."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Add different number of questions to each segment
    for i, segment in enumerate(test_segments):
        for j in range(i + 2):  # 2, 3, 4 questions respectively
            question = Question(
                id=uuid4(),
                segment_id=segment.id,
                question_text=f"Question {j}",
                correct_answer=f"Answer {j}",
                order_index=j,
            )
            test_session.add(question)
    await test_session.commit()

    count = await count_event_questions(test_session, test_event.id)

    # Should be 2 + 3 + 4 = 9
    assert count == 9


@pytest.mark.asyncio
async def test_count_event_questions_empty(test_session, test_user, test_event):
    """Should return 0 for events with no questions."""
    test_session.add(test_user)
    test_session.add(test_event)
    await test_session.commit()

    count = await count_event_questions(test_session, test_event.id)

    assert count == 0


@pytest.mark.asyncio
async def test_aggregate_questions_from_single_segment(test_session, test_user, test_event):
    """Mega quiz should work with single segment events."""
    test_session.add(test_user)
    test_session.add(test_event)

    single_segment = Segment(
        id=uuid4(),
        event_id=test_event.id,
        presenter_name="Solo Presenter",
        status=SegmentStatus.COMPLETED.value,
        order_index=0,
    )
    test_session.add(single_segment)
    await test_session.commit()

    # Add questions
    for j in range(5):
        question = Question(
            id=uuid4(),
            segment_id=single_segment.id,
            question_text=f"Question {j}",
            correct_answer=f"Answer {j}",
            order_index=j,
        )
        test_session.add(question)
    await test_session.commit()

    questions = await aggregate_event_questions(test_session, test_event.id)

    assert len(questions) == 5


@pytest.mark.asyncio
async def test_aggregate_questions_preserves_question_data(test_session, test_user, test_event, test_segments):
    """Aggregated questions should preserve all original data."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segments[0])
    await test_session.commit()

    # Add a question with specific attributes
    original_question = Question(
        id=uuid4(),
        segment_id=test_segments[0].id,
        question_text="Test Question",
        correct_answer="Test Answer",
        order_index=0,
        is_ai_generated=True,
        quality_score=0.95,
    )
    test_session.add(original_question)
    await test_session.commit()

    questions = await aggregate_event_questions(test_session, test_event.id)

    assert len(questions) == 1
    question = questions[0]
    assert question.question_text == "Test Question"
    assert question.correct_answer == "Test Answer"
    assert question.is_ai_generated is True
    assert question.quality_score == 0.95


@pytest.mark.asyncio
async def test_aggregate_questions_max_exceeds_available(test_session, test_user, test_event, test_segments):
    """Should return all questions when max_questions exceeds available."""
    test_session.add(test_user)
    test_session.add(test_event)
    test_session.add(test_segments[0])
    await test_session.commit()

    # Add only 3 questions
    for j in range(3):
        question = Question(
            id=uuid4(),
            segment_id=test_segments[0].id,
            question_text=f"Question {j}",
            correct_answer=f"Answer {j}",
            order_index=j,
        )
        test_session.add(question)
    await test_session.commit()

    # Request 100 questions
    questions = await aggregate_event_questions(test_session, test_event.id, max_questions=100)

    # Should only get 3
    assert len(questions) == 3


@pytest.mark.asyncio
async def test_get_mega_quiz_metadata_counts_segments_and_questions(
    test_session, test_user, test_event, test_segments
):
    """Metadata helper should report segment count and available questions."""
    test_session.add(test_user)
    test_session.add(test_event)
    for segment in test_segments:
        test_session.add(segment)
    await test_session.commit()

    # Add two questions across segments
    for segment in test_segments[:2]:
        question = Question(
            id=uuid4(),
            segment_id=segment.id,
            question_text="Question",
            correct_answer="Answer",
            order_index=0,
        )
        test_session.add(question)
    await test_session.commit()

    metadata = await get_mega_quiz_metadata(test_session, test_event.id)

    assert metadata.segment_count == 3
    assert metadata.available_questions == 2
    assert metadata.is_single_segment is False


def test_should_emit_mega_quiz_ready_rules():
    """Decision helper should respect single-segment mode and availability."""
    multi_metadata = MegaQuizMetadata(segment_count=2, available_questions=5)
    single_metadata = MegaQuizMetadata(segment_count=1, available_questions=5)
    empty_metadata = MegaQuizMetadata(segment_count=2, available_questions=0)

    assert should_emit_mega_quiz_ready(multi_metadata, "remix") is True
    assert should_emit_mega_quiz_ready(single_metadata, "remix") is True
    assert should_emit_mega_quiz_ready(single_metadata, "skip") is True
    assert should_emit_mega_quiz_ready(empty_metadata, "remix") is False
