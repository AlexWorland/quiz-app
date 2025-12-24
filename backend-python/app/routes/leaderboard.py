"""Leaderboard routes."""

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import EventParticipant, SegmentScore
from app.schemas import LeaderboardEntry

router = APIRouter()


@router.get("/events/{event_id}/leaderboard", response_model=list[LeaderboardEntry])
async def get_event_leaderboard(
    event_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LeaderboardEntry]:
    """Get master leaderboard for an event."""
    result = await db.execute(
        select(EventParticipant)
        .where(EventParticipant.event_id == event_id)
        .order_by(
            EventParticipant.total_score.desc(),
            EventParticipant.total_response_time_ms.asc(),
        )
    )
    participants = result.scalars().all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=p.id,
            username=p.display_name,
            avatar_url=p.avatar_url,
            score=p.total_score,
            is_late_joiner=p.is_late_joiner,
            response_time_ms=p.total_response_time_ms,
        )
        for i, p in enumerate(participants)
    ]


@router.get("/segments/{segment_id}/leaderboard", response_model=list[LeaderboardEntry])
async def get_segment_leaderboard(
    segment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[LeaderboardEntry]:
    """Get leaderboard for a specific segment."""
    result = await db.execute(
        select(SegmentScore, EventParticipant)
        .join(EventParticipant, SegmentScore.participant_id == EventParticipant.id)
        .where(SegmentScore.segment_id == segment_id)
        .order_by(
            SegmentScore.score.desc(),
            SegmentScore.total_response_time_ms.asc(),
        )
    )
    rows = result.all()

    return [
        LeaderboardEntry(
            rank=i + 1,
            user_id=participant.id,
            username=participant.display_name,
            avatar_url=participant.avatar_url,
            score=score.score,
            is_late_joiner=participant.is_late_joiner,
            response_time_ms=score.total_response_time_ms,
        )
        for i, (score, participant) in enumerate(rows)
    ]
