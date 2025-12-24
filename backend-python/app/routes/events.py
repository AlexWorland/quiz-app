"""Event routes."""

import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_db
from app.models import Event, EventMode, EventStatus
from app.schemas import CreateEventRequest, EventResponse, UpdateEventRequest
from app.services.export import export_event_data, export_to_json, export_to_csv
from app.ws.hub import hub

router = APIRouter()
EVENT_RESUME_DEBOUNCE: dict[str, datetime] = {}


def generate_join_code() -> str:
    """Generate a unique 6-character join code."""
    return secrets.token_hex(3).upper()


@router.get("/quizzes", response_model=list[EventResponse])
async def list_events(
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[EventResponse]:
    """List all events for the current user (host)."""
    result = await db.execute(
        select(Event).where(Event.host_id == current_user.id).order_by(Event.created_at.desc())
    )
    events = result.scalars().all()
    return [EventResponse.model_validate(e) for e in events]


@router.post("/quizzes", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
async def create_event(
    request: CreateEventRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Create a new event."""
    event = Event(
        id=uuid4(),
        host_id=current_user.id,
        title=request.title,
        description=request.description,
        join_code=generate_join_code(),
        mode=request.mode or EventMode.LISTEN_ONLY.value,
        status=EventStatus.WAITING.value,
        num_fake_answers=request.num_fake_answers or 3,
        time_per_question=request.time_per_question or 30,
        question_gen_interval_seconds=request.question_gen_interval_seconds,
    )
    db.add(event)
    await db.flush()
    return EventResponse.model_validate(event)


@router.get("/quizzes/{event_id}", response_model=EventResponse)
async def get_event(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Get a specific event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    return EventResponse.model_validate(event)


@router.put("/quizzes/{event_id}", response_model=EventResponse)
async def update_event(
    event_id: str,
    request: UpdateEventRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Update an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if request.title is not None:
        event.title = request.title
    if request.description is not None:
        event.description = request.description
    if request.status is not None:
        event.status = request.status
    if request.num_fake_answers is not None:
        event.num_fake_answers = request.num_fake_answers
    if request.time_per_question is not None:
        event.time_per_question = request.time_per_question
    if request.question_gen_interval_seconds is not None:
        event.question_gen_interval_seconds = request.question_gen_interval_seconds

    await db.flush()
    return EventResponse.model_validate(event)


@router.delete("/quizzes/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_event(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")
    await db.delete(event)


@router.post("/quizzes/{event_id}/complete", response_model=EventResponse)
async def complete_event(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Mark event as finished (stores previous status for resume)."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Store previous status for resume capability
    event.previous_status = event.status
    event.status = EventStatus.FINISHED.value
    event.ended_at = datetime.now(timezone.utc)
    await db.flush()
    return EventResponse.model_validate(event)


@router.post("/quizzes/{event_id}/resume", response_model=EventResponse)
async def resume_event(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Resume an accidentally ended event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    if event.status != EventStatus.FINISHED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only resume finished events"
        )

    if not event.previous_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No previous status available for resume"
        )

    now = datetime.now(timezone.utc)
    last = EVENT_RESUME_DEBOUNCE.get(event_id)
    if last and (now - last).total_seconds() < 2:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Resume recently triggered. Please wait a moment."
        )
    EVENT_RESUME_DEBOUNCE[event_id] = now

    # Check if any participants are in this event
    from app.models import EventParticipant
    participant_count = await db.scalar(
        select(func.count(EventParticipant.id))
        .where(EventParticipant.event_id == event.id)
    )

    # Restore previous status
    event.status = event.previous_status
    event.previous_status = None
    event.ended_at = None
    await db.flush()

    # Return response with warning if no participants
    response = EventResponse.model_validate(event)
    if participant_count == 0:
        # Add warning header (will be handled by frontend)
        from fastapi import Response
        return Response(
            content=response.model_dump_json(),
            media_type="application/json",
            headers={"X-Warning": "No participants in event. Wait for participants to join before continuing."}
        )

    return response


@router.post("/quizzes/{event_id}/clear-resume", response_model=EventResponse)
async def clear_event_resume_state(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Clear resume state and keep event finished."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    event.previous_status = None
    await db.flush()
    return EventResponse.model_validate(event)


@router.post("/events/{event_id}/join/lock", status_code=status.HTTP_200_OK)
async def lock_event_join(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Lock event joining to prevent new participants."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    event.join_locked = True
    event.join_locked_at = datetime.now(timezone.utc)
    await db.commit()

    # Broadcast lock status change to all connected clients
    from app.ws.messages import JoinLockStatusChangedMessage
    from uuid import UUID
    
    await hub.broadcast_to_event(
        UUID(event_id),
        JoinLockStatusChangedMessage(
            event_id=UUID(event_id),
            join_locked=True,
            locked_at=event.join_locked_at,
            message="Event joining is now locked - no new participants can join"
        ).model_dump(mode="json"),
    )

    return {
        "join_locked": event.join_locked,
        "join_locked_at": event.join_locked_at.isoformat() if event.join_locked_at else None,
        "message": "Event joining locked",
    }


@router.post("/events/{event_id}/join/unlock", status_code=status.HTTP_200_OK)
async def unlock_event_join(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Unlock event joining to allow new participants."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    event.join_locked = False
    event.join_locked_at = None
    await db.commit()

    # Broadcast lock status change to all connected clients
    from app.ws.messages import JoinLockStatusChangedMessage
    from uuid import UUID
    
    await hub.broadcast_to_event(
        UUID(event_id),
        JoinLockStatusChangedMessage(
            event_id=UUID(event_id),
            join_locked=False,
            locked_at=None,
            message="Event joining is now unlocked - new participants can join"
        ).model_dump(mode="json"),
    )

    return {
        "join_locked": event.join_locked,
        "join_locked_at": event.join_locked_at,
        "message": "Event joining unlocked",
    }


@router.get("/events/{event_id}/join/status", status_code=status.HTTP_200_OK)
async def get_event_join_status(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Get current join lock status for an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    return {
        "join_locked": event.join_locked,
        "join_locked_at": event.join_locked_at.isoformat() if event.join_locked_at else None,
        "message": "Locked" if event.join_locked else "Open",
    }


@router.get("/events/{event_id}/export")
async def export_event(
    event_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
    format: str = "json",
) -> Response:
    """Export event results in JSON or CSV format."""
    # Verify event exists and user is host
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Export data
    try:
        data = await export_event_data(db, event_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    # Format response based on format parameter
    if format.lower() == "csv":
        content = export_to_csv(data)
        media_type = "text/csv"
        filename = f"{event.title.replace(' ', '_')}_results.csv"
    else:  # Default to JSON
        content = export_to_json(data)
        media_type = "application/json"
        filename = f"{event.title.replace(' ', '_')}_results.json"

    return Response(
        content=content,
        media_type=media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
