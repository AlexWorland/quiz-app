"""Segment routes."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_db
from uuid import UUID

from app.models import Event, Question, Segment, SegmentStatus
from app.schemas import CreateSegmentRequest, SegmentResponse, UpdateSegmentRequest
from app.ws.hub import hub
from app.ws.messages import NoQuestionsGeneratedMessage

router = APIRouter()
SEGMENT_RESUME_DEBOUNCE: dict[str, datetime] = {}


@router.post("/quizzes/{event_id}/questions", response_model=SegmentResponse, status_code=status.HTTP_201_CREATED)
async def create_segment(
    event_id: str,
    request: CreateSegmentRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Add a segment to an event."""
    result = await db.execute(select(Event).where(Event.id == event_id))
    event = result.scalar_one_or_none()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    if event.host_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    # Get next order index
    result = await db.execute(
        select(func.coalesce(func.max(Segment.order_index), -1) + 1)
        .where(Segment.event_id == event_id)
    )
    next_index = result.scalar() or 0

    segment = Segment(
        id=uuid4(),
        event_id=event.id,
        presenter_name=request.presenter_name,
        presenter_user_id=request.presenter_user_id,
        title=request.title,
        order_index=next_index,
    )
    db.add(segment)
    await db.flush()
    await db.commit()
    await db.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.get("/events/{event_id}/segments/{segment_id}", response_model=SegmentResponse)
async def get_segment(
    event_id: str,
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Fetch a single segment by id. Host or assigned presenter may access."""
    try:
        event_uuid = UUID(event_id)
        segment_uuid = UUID(segment_id)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid segment or event id")

    result = await db.execute(
        select(Segment)
        .join(Event, Segment.event_id == Event.id)
        .where(Segment.id == segment_uuid, Segment.event_id == event_uuid)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    # Eager load event to avoid lazy access
    await db.refresh(segment, attribute_names=["event"])

    is_host = str(segment.event.host_id) == str(current_user.id)  # type: ignore[attr-defined]
    is_presenter = str(segment.presenter_user_id) == str(current_user.id)

    if not (is_host or is_presenter):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not authorized")

    return SegmentResponse.model_validate(segment)


@router.put("/quizzes/{event_id}/questions/{segment_id}", response_model=SegmentResponse)
async def update_segment(
    event_id: str,
    segment_id: str,
    request: UpdateSegmentRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Update a segment."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    if request.presenter_name is not None:
        segment.presenter_name = request.presenter_name
    if request.title is not None:
        segment.title = request.title
    if request.status is not None:
        segment.status = request.status
    if request.previous_status is not None:
        segment.previous_status = request.previous_status

    await db.flush()
    return SegmentResponse.model_validate(segment)


@router.patch("/segments/{segment_id}", response_model=SegmentResponse)
async def patch_segment(
    segment_id: str,
    request: UpdateSegmentRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Patch a segment by ID."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    if request.presenter_name is not None:
        segment.presenter_name = request.presenter_name
    if request.title is not None:
        segment.title = request.title
    if request.status is not None:
        segment.status = request.status
    if request.previous_status is not None:
        segment.previous_status = request.previous_status

    await db.commit()
    await db.refresh(segment)
    return SegmentResponse.model_validate(segment)


@router.delete("/quizzes/{event_id}/questions/{segment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_segment(
    event_id: str,
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a segment."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")
    await db.delete(segment)


# Recording controls
@router.post("/segments/{segment_id}/recording/start", response_model=SegmentResponse)
async def start_recording(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Start recording for a segment."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    segment.status = SegmentStatus.RECORDING.value
    segment.recording_started_at = datetime.now(timezone.utc)
    await db.flush()
    return SegmentResponse.model_validate(segment)


@router.post("/segments/{segment_id}/recording/stop", response_model=SegmentResponse)
async def stop_recording(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Stop recording for a segment."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    segment.status = SegmentStatus.QUIZ_READY.value
    segment.recording_ended_at = datetime.now(timezone.utc)
    await db.flush()
    
    # Check if segment has questions - if not, broadcast no questions message
    question_result = await db.execute(
        select(Question).where(Question.segment_id == segment.id).limit(1)
    )
    has_questions = question_result.scalar_one_or_none() is not None
    
    if not has_questions:
        # Broadcast no questions generated message to all connected clients
        message = NoQuestionsGeneratedMessage(
            segment_id=UUID(segment_id),
            segment_title=segment.title,
            presenter_name=segment.presenter_name,
            reason="no_content_generated"
        )
        await hub.broadcast(UUID(str(segment.event_id)), message.model_dump())
    
    return SegmentResponse.model_validate(segment)


@router.post("/segments/{segment_id}/complete", response_model=SegmentResponse)
async def complete_segment(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Mark segment as completed (stores previous status for resume)."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    # Store previous status for resume capability
    segment.previous_status = segment.status
    segment.status = SegmentStatus.COMPLETED.value
    segment.ended_at = datetime.now(timezone.utc)
    await db.flush()
    return SegmentResponse.model_validate(segment)


@router.post("/segments/{segment_id}/resume", response_model=SegmentResponse)
async def resume_segment(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Resume an accidentally ended segment."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    if segment.status != SegmentStatus.COMPLETED.value:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Can only resume completed segments"
        )

    if not segment.previous_status:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No previous status available for resume"
        )

    now = datetime.now(timezone.utc)
    last = SEGMENT_RESUME_DEBOUNCE.get(segment_id)
    if last and (now - last).total_seconds() < 2:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Resume recently triggered. Please wait a moment."
        )
    SEGMENT_RESUME_DEBOUNCE[segment_id] = now

    # Check if any participants are connected to this event
    from app.models import EventParticipant
    participant_count = await db.scalar(
        select(func.count(EventParticipant.id))
        .where(EventParticipant.event_id == segment.event_id)
    )

    # Restore previous status
    segment.status = segment.previous_status
    segment.previous_status = None
    segment.ended_at = None
    await db.flush()

    # Return response with warning if no participants
    response = SegmentResponse.model_validate(segment)
    if participant_count == 0:
        # Add warning header (will be handled by frontend)
        from fastapi import Response
        return Response(
            content=response.model_dump_json(),
            media_type="application/json",
            headers={"X-Warning": "No participants in event. Wait for participants to join before continuing."}
        )

    return response


@router.post("/segments/{segment_id}/clear-resume", response_model=SegmentResponse)
async def clear_resume_state(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> SegmentResponse:
    """Clear resume state and keep segment completed."""
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    segment.previous_status = None
    await db.flush()
    return SegmentResponse.model_validate(segment)
