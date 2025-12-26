"""Event join routes."""

import secrets
from datetime import datetime, timezone
from typing import Annotated
from uuid import UUID, uuid4, uuid5, NAMESPACE_DNS

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_db
from app.models import Event, EventParticipant, JoinAttempt, JoinAttemptStatus, JoinStatus
from app.schemas import (
    EventParticipantResponse,
    EventResponse,
    JoinEventRequest,
    JoinEventResponse,
)
from app.services.join_queue import join_queue
from app.ws.hub import hub

router = APIRouter()


async def _get_unique_display_name(
    db: AsyncSession, event_id: UUID, base_name: str
) -> str:
    """
    Generate a unique display name by appending numbers if duplicates exist.
    Examples: "Alex", "Alex 2", "Alex 3"
    """
    # Check if base name is already taken
    result = await db.execute(
        select(EventParticipant.display_name)
        .where(EventParticipant.event_id == event_id)
        .where(EventParticipant.display_name.like(f"{base_name}%"))
    )
    existing_names = {row[0] for row in result.fetchall()}

    # If base name is free, use it
    if base_name not in existing_names:
        return base_name

    # Find the next available number
    counter = 2
    while f"{base_name} {counter}" in existing_names:
        counter += 1

    return f"{base_name} {counter}"


@router.get("/events/join/{code}", response_model=EventResponse)
async def get_event_by_code(
    code: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventResponse:
    """Get event by join code (public)."""
    result = await db.execute(select(Event).where(Event.join_code == code.upper()))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return EventResponse.model_validate(event)


async def _execute_join(
    request: JoinEventRequest,
    event: Event,
    device_id: UUID,
    join_start_time: datetime,
    db: AsyncSession,
) -> JoinEventResponse:
    """Execute the actual join logic (called from queue)."""

    # Create join attempt record
    join_attempt = JoinAttempt(
        event_id=event.id,
        device_id=device_id,
        started_at=join_start_time,
        status=JoinAttemptStatus.IN_PROGRESS.value,
    )
    db.add(join_attempt)
    await db.flush()

    # Check if event is locked, but allow grace period for in-progress joins
    # Grace period: 5 seconds from when QR scan started
    if event.join_locked:
        grace_period_seconds = 5
        
        # If no lock timestamp, treat as immediate lock (no grace period)
        if not event.join_locked_at:
            join_attempt.status = JoinAttemptStatus.FAILED.value
            join_attempt.completed_at = datetime.now(timezone.utc)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event joining is locked"
            )
        
        # Ensure both datetimes are timezone-aware for comparison
        locked_at = event.join_locked_at
        if locked_at.tzinfo is None:
            locked_at = locked_at.replace(tzinfo=timezone.utc)
        
        time_since_lock = (join_start_time - locked_at).total_seconds()
        if time_since_lock > grace_period_seconds:
            join_attempt.status = JoinAttemptStatus.FAILED.value
            join_attempt.completed_at = datetime.now(timezone.utc)
            await db.commit()
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Event joining is locked"
            )


    # Check if device is already active in a DIFFERENT event
    result = await db.execute(
        select(EventParticipant, Event)
        .join(Event, EventParticipant.event_id == Event.id)
        .where(
            EventParticipant.device_id == device_id,
            EventParticipant.event_id != event.id,
            Event.status.in_(['waiting', 'active'])  # Only check active events
        )
        .limit(1)
    )
    existing_in_other_event = result.first()

    if existing_in_other_event:
        other_participant, other_event = existing_in_other_event
        # Mark join attempt as failed
        join_attempt.status = JoinAttemptStatus.FAILED.value
        join_attempt.completed_at = datetime.now(timezone.utc)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"This device is already in another active event: '{other_event.title}'. Please leave that event first or use a different device."
        )

    # Check for existing participant with same device fingerprint
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event.id,
            EventParticipant.device_id == device_id,
        )
    )
    existing = result.scalar_one_or_none()

    if existing:
        # Rejoin existing participant in the same event
        existing.last_heartbeat = datetime.now(timezone.utc)
        token = existing.session_token or secrets.token_urlsafe(32)
        existing.session_token = token
        
        # Mark join attempt as completed
        join_attempt.status = JoinAttemptStatus.COMPLETED.value
        join_attempt.completed_at = datetime.now(timezone.utc)
        await db.commit()

        return JoinEventResponse(
            event_id=event.id,
            device_id=existing.device_id,
            session_token=token,
            display_name=existing.display_name,
            is_rejoining=True,
        )

    # New participant - handle duplicate names
    base_name = request.display_name.strip()
    display_name = await _get_unique_display_name(db, event.id, base_name)

    # Determine initial join status based on event state
    from app.models import JoinStatus

    initial_status = JoinStatus.JOINED.value
    is_late = False

    # Check if event has active segments
    from app.models import Segment, SegmentStatus
    from app.ws.messages import QuizPhase

    result = await db.execute(
        select(Segment)
        .where(Segment.event_id == event.id)
        .where(Segment.status.in_([SegmentStatus.QUIZZING.value, SegmentStatus.RECORDING.value]))
        .limit(1)
    )
    active_segment = result.scalar_one_or_none()

    if active_segment and active_segment.status == SegmentStatus.QUIZZING.value:
        # Check the current quiz phase from game state
        game_state = hub.get_game_state(event.id)
        if game_state:
            current_phase = game_state.quiz_phase
            
            # If joining during leaderboard, allow them to wait for next question
            if current_phase in (QuizPhase.SHOWING_LEADERBOARD, QuizPhase.BETWEEN_QUESTIONS):
                initial_status = JoinStatus.WAITING_FOR_SEGMENT.value
                is_late = True
            # If joining during an active question or reveal, wait for next question
            elif current_phase in (QuizPhase.SHOWING_QUESTION, QuizPhase.REVEALING_ANSWER):
                initial_status = JoinStatus.WAITING_FOR_SEGMENT.value
                is_late = True
        else:
            # No game state available, default to waiting
            initial_status = JoinStatus.WAITING_FOR_SEGMENT.value
            is_late = True

    session_token = secrets.token_urlsafe(32)
    participant = EventParticipant(
        id=uuid4(),
        event_id=event.id,
        device_id=device_id,
        display_name=display_name,
        avatar_url=request.avatar_url,
        avatar_type=request.avatar_type,
        session_token=session_token,
        join_timestamp=datetime.now(timezone.utc),
        join_started_at=join_start_time,  # Record when join process started
        last_heartbeat=datetime.now(timezone.utc),
        join_status=initial_status,
        is_late_joiner=is_late,
    )
    db.add(participant)
    
    # Mark join attempt as completed
    join_attempt.status = JoinAttemptStatus.COMPLETED.value
    join_attempt.completed_at = datetime.now(timezone.utc)
    await db.commit()

    return JoinEventResponse(
        event_id=event.id,
        device_id=participant.device_id,
        session_token=session_token,
        display_name=participant.display_name,
        is_rejoining=False,
    )


@router.post("/events/join", response_model=JoinEventResponse)
async def join_event(
    request: JoinEventRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JoinEventResponse:
    """Join an event as anonymous participant (with queue and race condition protection)."""
    join_start_time = datetime.now(timezone.utc)
    
    # Parse device fingerprint
    try:
        device_id = UUID(request.device_fingerprint)
    except ValueError:
        device_id = uuid5(NAMESPACE_DNS, request.device_fingerprint)
    
    # Get event first (outside of queue to fail fast)
    result = await db.execute(select(Event).where(Event.join_code == request.code.upper()))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    
    # Use join queue to prevent race conditions for simultaneous scans
    async def execute_join_with_db(db_session: AsyncSession) -> JoinEventResponse:
        return await _execute_join(request, event, device_id, join_start_time, db_session)
    
    return await join_queue.enqueue_join(event.id, device_id, execute_join_with_db, db)


@router.get("/events/{event_id}/participants", response_model=list[EventParticipantResponse])
async def get_participants(
    event_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[EventParticipantResponse]:
    """Get all participants in an event."""
    result = await db.execute(
        select(EventParticipant)
        .where(EventParticipant.event_id == event_id)
        .order_by(EventParticipant.total_score.desc())
    )
    participants = result.scalars().all()
    return [EventParticipantResponse.model_validate(p) for p in participants]


from pydantic import BaseModel

class UpdateDisplayNameRequest(BaseModel):
    display_name: str


class RecoverParticipantRequest(BaseModel):
    display_name: str
    new_device_fingerprint: str


@router.post("/events/{event_id}/recover-participant")
async def recover_participant(
    event_id: UUID,
    request: RecoverParticipantRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JoinEventResponse:
    """
    Recover a participant's session when device identity is lost.
    Matches by display name and links to new device fingerprint.
    """
    # Find participant by display name in this event
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.event_id == event_id,
            EventParticipant.display_name == request.display_name.strip(),
        )
    )
    participant = result.scalar_one_or_none()

    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No participant found with that display name",
        )

    # Update device fingerprint
    new_device_id = UUID(request.new_device_fingerprint)
    participant.device_id = new_device_id
    participant.last_heartbeat = datetime.now(timezone.utc)

    # Generate new session token
    new_session_token = secrets.token_urlsafe(32)
    participant.session_token = new_session_token

    await db.commit()
    await db.refresh(participant)

    return JoinEventResponse(
        event_id=event_id,
        device_id=new_device_id,
        session_token=new_session_token,
        display_name=participant.display_name,
        is_rejoining=True,
    )


@router.patch("/events/{event_id}/participants/{participant_id}/name")
async def update_participant_name(
    event_id: UUID,
    participant_id: UUID,
    request: UpdateDisplayNameRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> EventParticipantResponse:
    """Update a participant's display name."""
    # Get participant
    result = await db.execute(
        select(EventParticipant).where(
            EventParticipant.id == participant_id,
            EventParticipant.event_id == event_id,
        )
    )
    participant = result.scalar_one_or_none()
    if not participant:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Participant not found"
        )

    old_name = participant.display_name
    # Generate unique name
    unique_name = await _get_unique_display_name(db, event_id, request.display_name.strip())
    participant.display_name = unique_name
    await db.commit()
    await db.refresh(participant)

    # Broadcast name change to all participants in the event
    from app.ws.messages import ParticipantNameChangedMessage
    await hub.broadcast_to_event(
        event_id,
        ParticipantNameChangedMessage(
            user_id=participant_id,
            old_name=old_name,
            new_name=unique_name,
        ).model_dump(mode="json"),
    )

    return EventParticipantResponse.model_validate(participant)


class JoinAsHostRequest(BaseModel):
    display_name: str
    avatar_url: str | None = None
    avatar_type: str | None = None


@router.post("/events/{event_id}/join-as-host")
async def join_event_as_host(
    event_id: UUID,
    request: JoinAsHostRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JoinEventResponse:
    """Allow event host to join their own event as an anonymous participant."""
    # Get event and verify user is host
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    # Verify current user is the event host
    if event.host_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail="Only the event host can join as participant"
        )

    if event.join_locked:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Event joining is locked")

    # Create participant linked to host user
    device_id = uuid4()
    unique_name = await _get_unique_display_name(db, event_id, request.display_name.strip())

    session_token = secrets.token_urlsafe(32)
    participant = EventParticipant(
        id=uuid4(),
        event_id=event_id,
        user_id=current_user.id,  # Link to host user so they can see Manage Event button
        display_name=unique_name,
        avatar_url=request.avatar_url,
        avatar_type=request.avatar_type,
        device_id=device_id,
        session_token=session_token,
        join_timestamp=datetime.now(timezone.utc),
        last_heartbeat=datetime.now(timezone.utc),
        join_status=JoinStatus.JOINED.value,
        is_late_joiner=False,
    )
    db.add(participant)
    await db.commit()
    await db.refresh(participant)

    return JoinEventResponse(
        event_id=event_id,
        device_id=device_id,
        session_token=session_token,
        display_name=participant.display_name,
        is_rejoining=False,
    )
