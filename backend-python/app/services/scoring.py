"""Scoring helpers for quiz questions."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EventParticipant, SegmentScore


def calculate_speed_based_score(time_limit_ms: int, response_time_ms: int) -> int:
    """
    Calculate score based on response speed.

    Formula: 1000 × (time_limit - response_time) / time_limit
    Minimum: 1 point (if time expired)
    Maximum: 1000 points (instant answer)
    """
    if response_time_ms >= time_limit_ms:
        return 1  # Minimum score for late answers

    remaining_time = time_limit_ms - response_time_ms
    score = int(1000 * remaining_time / time_limit_ms)
    return max(1, min(1000, score))


async def upsert_segment_score(
    db: AsyncSession, segment_id: UUID, participant_id: UUID
) -> SegmentScore:
    """Fetch or create the SegmentScore row for a participant in a segment."""
    result = await db.execute(
        select(SegmentScore).where(
            SegmentScore.segment_id == segment_id,
            SegmentScore.participant_id == participant_id,
        )
    )
    segment_score = result.scalar_one_or_none()
    if segment_score:
        return segment_score

    segment_score = SegmentScore(segment_id=segment_id, participant_id=participant_id)
    db.add(segment_score)
    await db.flush()
    return segment_score


async def apply_score(
    db: AsyncSession,
    segment_id: UUID,
    participant_id: UUID,
    delta_score: int,
    is_correct: bool,
    response_time_ms: int | None,
    commit: bool = True,
) -> None:
    """
    Apply scoring deltas to segment and event totals.

    - Increment questions_answered for every call.
    - Increment questions_correct only when is_correct is True.
    - Add delta_score to both segment score and event total_score.
    - Accumulate response_time_ms when provided for tie-breaking.
    """
    segment_score = await upsert_segment_score(db, segment_id, participant_id)
    segment_score.score += delta_score
    segment_score.questions_answered += 1
    if is_correct:
        segment_score.questions_correct += 1
    if response_time_ms is not None:
        segment_score.total_response_time_ms += response_time_ms

    participant_row = await db.get(EventParticipant, participant_id)
    if participant_row:
        participant_row.total_score += delta_score
        if response_time_ms is not None:
            participant_row.total_response_time_ms += response_time_ms

    if commit:
        await db.commit()
