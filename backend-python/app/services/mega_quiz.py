"""Mega quiz service for aggregating questions across segments."""

from dataclasses import dataclass
import random
from typing import Literal
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Question, Segment


async def aggregate_event_questions(
    db: AsyncSession, event_id: UUID, max_questions: int | None = None
) -> list[Question]:
    """Aggregate questions from all segments of an event.

    Args:
        db: Database session
        event_id: Event UUID
        max_questions: Optional limit on number of questions to return

    Returns:
        List of questions shuffled and limited to max_questions if specified
    """
    # Get all segments for the event
    result = await db.execute(
        select(Segment).where(Segment.event_id == event_id).order_by(Segment.order_index)
    )
    segments = result.scalars().all()

    if not segments:
        return []

    # Collect all questions from all segments
    all_questions = []
    for segment in segments:
        question_result = await db.execute(
            select(Question)
            .where(Question.segment_id == segment.id)
            .order_by(Question.order_index)
        )
        segment_questions = question_result.scalars().all()
        all_questions.extend(segment_questions)

    # Shuffle questions to mix content from different segments
    random.shuffle(all_questions)

    # Limit to max_questions if specified
    if max_questions is not None and len(all_questions) > max_questions:
        return all_questions[:max_questions]

    return all_questions


async def count_event_questions(db: AsyncSession, event_id: UUID) -> int:
    """Count total questions available across all segments.

    Args:
        db: Database session
        event_id: Event UUID

    Returns:
        Total number of questions
    """
    result = await db.execute(
        select(Segment).where(Segment.event_id == event_id)
    )
    segments = result.scalars().all()

    total = 0
    for segment in segments:
        question_result = await db.execute(
            select(Question).where(Question.segment_id == segment.id)
        )
        total += len(question_result.scalars().all())

    return total


@dataclass
class MegaQuizMetadata:
    """Metadata describing mega quiz readiness for an event."""

    segment_count: int
    available_questions: int

    @property
    def is_single_segment(self) -> bool:
        return self.segment_count == 1


async def get_mega_quiz_metadata(db: AsyncSession, event_id: UUID) -> MegaQuizMetadata:
    """Return segment count and available question count for an event."""
    segment_result = await db.execute(select(Segment.id).where(Segment.event_id == event_id))
    segment_ids = segment_result.scalars().all()
    segment_count = len(segment_ids)
    available_questions = await count_event_questions(db, event_id) if segment_count else 0

    return MegaQuizMetadata(
        segment_count=segment_count,
        available_questions=available_questions,
    )


def should_emit_mega_quiz_ready(
    metadata: MegaQuizMetadata, single_segment_mode: Literal["remix", "skip"]
) -> bool:
    """Determine whether to emit mega_quiz_ready instead of final results."""
    if metadata.available_questions <= 0:
        return False
    return True
