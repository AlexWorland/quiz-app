"""Export service for event results."""

import csv
import io
import json
from datetime import datetime, timezone
from typing import Any
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Event, Segment, Question, EventParticipant


async def export_event_data(db: AsyncSession, event_id: UUID) -> dict[str, Any]:
    """Export event data structure.

    Args:
        db: Database session
        event_id: Event UUID

    Returns:
        Dictionary containing event, segments, participants, and leaderboard data
    """
    # Get event
    event_result = await db.execute(select(Event).where(Event.id == event_id))
    event = event_result.scalar_one_or_none()
    if not event:
        raise ValueError("Event not found")

    # Get segments
    segments_result = await db.execute(
        select(Segment).where(Segment.event_id == event_id).order_by(Segment.order_index)
    )
    segments = segments_result.scalars().all()

    # Build segments data with questions
    segments_data = []
    for segment in segments:
        questions_result = await db.execute(
            select(Question)
            .where(Question.segment_id == segment.id)
            .order_by(Question.order_index)
        )
        questions = questions_result.scalars().all()

        segments_data.append({
            "id": str(segment.id),
            "title": segment.title,
            "presenter_name": segment.presenter_name,
            "status": segment.status,
            "questions": [
                {
                    "id": str(q.id),
                    "question_text": q.question_text,
                    "correct_answer": q.correct_answer,
                    "order_index": q.order_index,
                }
                for q in questions
            ],
        })

    # Get participants
    participants_result = await db.execute(
        select(EventParticipant).where(EventParticipant.event_id == event_id)
    )
    participants = participants_result.scalars().all()

    participants_data = []
    final_leaderboard = []

    # Sort by score DESC, then by response time ASC (faster wins ties)
    for i, participant in enumerate(sorted(
        participants,
        key=lambda p: (-p.total_score, p.total_response_time_ms)
    )):
        participants_data.append({
            "id": str(participant.id),
            "display_name": participant.display_name,
            "total_score": participant.total_score,
            "total_response_time_ms": participant.total_response_time_ms,
            "is_late_joiner": participant.is_late_joiner,
            "joined_at": participant.joined_at.isoformat() if participant.joined_at else None,
        })

        final_leaderboard.append({
            "rank": i + 1,
            "display_name": participant.display_name,
            "score": participant.total_score,
            "response_time_ms": participant.total_response_time_ms,
            "is_late_joiner": participant.is_late_joiner,
        })

    return {
        "event": {
            "id": str(event.id),
            "title": event.title,
            "description": event.description,
            "join_code": event.join_code,
            "mode": event.mode,
            "status": event.status,
            "created_at": event.created_at.isoformat() if event.created_at else None,
        },
        "segments": segments_data,
        "participants": participants_data,
        "final_leaderboard": final_leaderboard,
        "exported_at": datetime.now(timezone.utc).isoformat(),
    }


def export_to_json(data: dict[str, Any]) -> str:
    """Convert export data to JSON string.

    Args:
        data: Export data dictionary

    Returns:
        Formatted JSON string
    """
    return json.dumps(data, indent=2)


def export_to_csv(data: dict[str, Any]) -> str:
    """Convert export data to CSV string.

    Args:
        data: Export data dictionary

    Returns:
        CSV string with leaderboard data
    """
    output = io.StringIO()
    writer = csv.writer(output)

    # Write header
    writer.writerow(['Rank', 'Display Name', 'Score', 'Late Joiner'])

    # Write leaderboard data
    for entry in data.get('final_leaderboard', []):
        writer.writerow([
            entry['rank'],
            entry['display_name'],
            entry['score'],
            'Yes' if entry['is_late_joiner'] else 'No',
        ])

    return output.getvalue()
