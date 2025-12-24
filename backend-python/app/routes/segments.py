"""Segment routes."""

from datetime import datetime, timezone
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_db
from uuid import UUID

from app.models import Event, Question, Segment, SegmentStatus, AudioChunk, ProcessingLog
from app.schemas import CreateSegmentRequest, SegmentResponse, UpdateSegmentRequest
from app.services.audio_storage import AudioStorageService
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


@router.post("/segments/{segment_id}/transcribe")
async def transcribe_and_generate_questions(
    segment_id: str,
    audio_file: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Transcribe audio and generate quiz questions."""
    from app.services.transcription import WhisperTranscriptionService
    from app.services.ai import ClaudeProvider, OpenAIProvider
    from app.models import PresentationTranscript
    from app.ws.messages import QuizGeneratingMessage, QuizReadyMessage
    from app.config import get_settings
    
    settings = get_settings()
    
    # Verify authorization
    result = await db.execute(
        select(Segment).join(Event).where(
            Segment.id == segment_id,
            Event.host_id == current_user.id
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Broadcast: generation started (triggers Flappy Bird)
    await hub.broadcast(
        segment.event_id,
        QuizGeneratingMessage(segment_id=UUID(segment_id)).model_dump()
    )
    
    # Read and transcribe audio
    audio_data = await audio_file.read()
    if len(audio_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio file")
    
    whisper = WhisperTranscriptionService()
    try:
        transcript_text = await whisper.transcribe_audio(
            audio_data, 
            filename=audio_file.filename or "recording.webm"
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Transcription failed: {str(e)}"
        )
    
    if len(transcript_text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Transcript too short. Please record more content."
        )
    
    # Save transcript
    transcript = PresentationTranscript(
        id=uuid4(),
        segment_id=UUID(segment_id),
        chunk_text=transcript_text,
        chunk_index=0,
    )
    db.add(transcript)
    await db.flush()
    
    # Get event for questions_to_generate setting
    event_result = await db.execute(
        select(Event).where(Event.id == segment.event_id)
    )
    event = event_result.scalar_one()
    
    # Generate questions using new helper function
    questions_generated = await _generate_questions_for_transcript(
        db=db,
        segment_id=UUID(segment_id),
        transcript_text=transcript_text,
        event=event,
        settings=settings
    )
    
    # Add generated questions to database
    for question in questions_generated:
        db.add(question)
    
    if len(questions_generated) == 0:
        raise HTTPException(
            status_code=400,
            detail="Could not generate questions. Try presenting more factual content."
        )
    
    await db.commit()
    
    # Update segment status
    segment.status = SegmentStatus.QUIZ_READY.value
    await db.commit()
    
    # Broadcast: quiz ready (triggers navigation)
    await hub.broadcast(
        segment.event_id,
        QuizReadyMessage(
            segment_id=UUID(segment_id),
            questions_count=len(questions_generated),
            auto_start=True
        ).model_dump()
    )
    
    return {
        "success": True,
        "transcript_length": len(transcript_text),
        "questions_generated": len(questions_generated),
        "segment_id": segment_id,
    }


def _split_transcript(text: str, chunk_size: int = 500) -> list[str]:
    """Split transcript into overlapping chunks."""
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size // 2):
        chunk = ' '.join(words[i:i + chunk_size])
        if len(chunk) > 100:
            chunks.append(chunk)
    return chunks if chunks else [text]


async def _generate_questions_for_transcript(
    db: AsyncSession,
    segment_id: UUID,
    transcript_text: str,
    event: Event,
    settings
) -> list[Question]:
    """Generate questions from transcript using batch or chunking mode.
    
    Args:
        db: Database session
        segment_id: Segment UUID
        transcript_text: Full transcript
        event: Event object (for questions_to_generate setting)
        settings: App settings
        
    Returns:
        List of generated Question objects (not yet committed to DB)
    """
    from app.services.ai import OpenAIProvider, ClaudeProvider
    
    ai_provider = (
        OpenAIProvider() 
        if settings.default_ai_provider == "openai" 
        else ClaudeProvider()
    )
    
    questions_generated = []
    num_questions = event.questions_to_generate
    
    # Use batch generation for OpenAI if available
    if settings.default_ai_provider == "openai" and hasattr(ai_provider, 'generate_questions_batch'):
        # Batch mode: send entire transcript in one call
        generated_questions = await ai_provider.generate_questions_batch(
            transcript=transcript_text,
            num_questions=num_questions,
            existing_questions=[]
        )
        
        for idx, generated in enumerate(generated_questions):
            question = Question(
                id=uuid4(),
                segment_id=segment_id,
                question_text=generated.question_text,
                correct_answer=generated.correct_answer,
                fake_answers=generated.fake_answers,
                order_index=idx,
                is_ai_generated=True,
                source_transcript=generated.source_transcript,
            )
            questions_generated.append(question)
    
    # Fallback: Use chunking approach for Claude/Ollama or if batch fails
    if not questions_generated:
        existing_questions = []
        chunks = _split_transcript(transcript_text, chunk_size=500)
        
        for chunk in chunks:
            generated = await ai_provider.analyze_and_generate_question(
                transcript=chunk,
                existing_questions=[q.question_text for q in existing_questions]
            )
            
            if generated:
                question = Question(
                    id=uuid4(),
                    segment_id=segment_id,
                    question_text=generated.question_text,
                    correct_answer=generated.correct_answer,
                    fake_answers=generated.fake_answers,
                    order_index=len(questions_generated),
                    is_ai_generated=True,
                    source_transcript=chunk[:500],
                )
                questions_generated.append(question)
                existing_questions.append(question)
    
    return questions_generated


@router.post("/segments/{segment_id}/audio-chunk")
async def upload_audio_chunk(
    segment_id: str,
    chunk_index: int,
    audio_chunk: UploadFile,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Upload a 1-minute audio chunk during recording.
    
    Args:
        segment_id: Segment UUID
        chunk_index: Chunk number (0-based)
        audio_chunk: Audio file (WebM format)
        
    Returns:
        Chunk metadata and storage confirmation
    """
    # Verify authorization
    result = await db.execute(
        select(Segment).join(Event).where(
            Segment.id == segment_id,
            Event.host_id == current_user.id
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Read chunk data
    chunk_data = await audio_chunk.read()
    if len(chunk_data) == 0:
        raise HTTPException(status_code=400, detail="Empty audio chunk")
    
    # Store in MinIO
    storage = AudioStorageService()
    storage_path = await storage.store_chunk(
        UUID(segment_id),
        chunk_index,
        chunk_data
    )
    
    # Save metadata to database
    audio_chunk_model = AudioChunk(
        id=uuid4(),
        segment_id=UUID(segment_id),
        chunk_index=chunk_index,
        storage_path=storage_path,
        file_size_bytes=len(chunk_data),
    )
    db.add(audio_chunk_model)
    
    # Log upload
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='chunk_upload',
        message=f"Chunk {chunk_index} uploaded ({len(chunk_data)} bytes)",
        level='info'
    )
    db.add(log)
    
    await db.commit()
    
    return {
        "chunk_index": chunk_index,
        "storage_path": storage_path,
        "file_size": len(chunk_data),
        "success": True
    }


@router.post("/segments/{segment_id}/finalize-and-transcribe")
async def finalize_recording_and_generate(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> dict:
    """Finalize recording, combine chunks, transcribe, and generate questions."""
    from app.services.audio_combiner import AudioCombiner
    from app.services.transcription import WhisperTranscriptionService
    from app.services.ai import OpenAIProvider, ClaudeProvider
    from app.models import PresentationTranscript
    from app.ws.messages import QuizGeneratingMessage, QuizReadyMessage
    from app.config import get_settings
    from sqlalchemy import update
    
    settings = get_settings()
    
    # Verify authorization
    result = await db.execute(
        select(Segment).join(Event).where(
            Segment.id == segment_id,
            Event.host_id == current_user.id
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Broadcast: generation started
    await hub.broadcast(
        segment.event_id,
        QuizGeneratingMessage(segment_id=UUID(segment_id)).model_dump()
    )
    
    # Log: Starting combination
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='combining',
        message="Retrieving and combining audio chunks"
    )
    db.add(log)
    await db.flush()
    
    # Retrieve all chunks for this segment
    chunks_result = await db.execute(
        select(AudioChunk)
        .where(AudioChunk.segment_id == segment_id)
        .order_by(AudioChunk.chunk_index)
    )
    chunks = chunks_result.scalars().all()
    
    if not chunks:
        raise HTTPException(
            status_code=400,
            detail="No audio chunks found. Please record audio first."
        )
    
    # Check for missing chunks
    expected_indices = set(range(max(c.chunk_index for c in chunks) + 1))
    actual_indices = {c.chunk_index for c in chunks}
    missing = expected_indices - actual_indices
    
    if missing:
        log = ProcessingLog(
            id=uuid4(),
            segment_id=UUID(segment_id),
            stage='combining',
            message=f"Warning: Missing chunks {sorted(missing)}. Proceeding with available chunks.",
            level='warning'
        )
        db.add(log)
        await db.flush()
    
    # Retrieve chunk data from MinIO
    storage = AudioStorageService()
    chunk_data_list = []
    for chunk in chunks:
        try:
            chunk_data = await storage.retrieve_chunk(chunk.storage_path)
            chunk_data_list.append(chunk_data)
        except Exception as e:
            log = ProcessingLog(
                id=uuid4(),
                segment_id=UUID(segment_id),
                stage='combining',
                message=f"Failed to retrieve chunk {chunk.chunk_index}: {str(e)}",
                level='error'
            )
            db.add(log)
            await db.flush()
            raise HTTPException(
                status_code=500,
                detail=f"Failed to retrieve chunk {chunk.chunk_index}"
            )
    
    # Combine chunks
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='combining',
        message=f"Combining {len(chunks)} chunks"
    )
    db.add(log)
    await db.flush()
    
    combiner = AudioCombiner()
    try:
        combined_audio = combiner.combine_chunks(chunk_data_list)
    except Exception as e:
        log = ProcessingLog(
            id=uuid4(),
            segment_id=UUID(segment_id),
            stage='combining',
            message=f"Failed to combine chunks: {str(e)}",
            level='error'
        )
        db.add(log)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Failed to combine audio: {str(e)}")
    
    # Log: Starting transcription
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='transcribing',
        message=f"Transcribing {len(combined_audio)} bytes"
    )
    db.add(log)
    await db.flush()
    
    # Transcribe
    whisper = WhisperTranscriptionService()
    try:
        transcript_text = await whisper.transcribe_audio(
            combined_audio,
            filename="combined.webm"
        )
    except Exception as e:
        log = ProcessingLog(
            id=uuid4(),
            segment_id=UUID(segment_id),
            stage='transcribing',
            message=f"Transcription failed: {str(e)}",
            level='error'
        )
        db.add(log)
        await db.commit()
        raise HTTPException(status_code=500, detail=f"Transcription failed: {str(e)}")
    
    if len(transcript_text.strip()) < 50:
        raise HTTPException(
            status_code=400,
            detail="Transcript too short. Please record more content."
        )
    
    # Save transcript
    transcript = PresentationTranscript(
        id=uuid4(),
        segment_id=UUID(segment_id),
        chunk_text=transcript_text,
        chunk_index=0,
    )
    db.add(transcript)
    await db.flush()
    
    # Log: Starting question generation
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='generating',
        message=f"Generating questions from {len(transcript_text)} char transcript"
    )
    db.add(log)
    await db.flush()
    
    # Get event for questions_to_generate setting
    event_result = await db.execute(
        select(Event).where(Event.id == segment.event_id)
    )
    event = event_result.scalar_one()
    
    # Generate questions using new helper function
    questions_generated = await _generate_questions_for_transcript(
        db=db,
        segment_id=UUID(segment_id),
        transcript_text=transcript_text,
        event=event,
        settings=settings
    )
    
    # Add generated questions to database
    for question in questions_generated:
        db.add(question)
    
    if len(questions_generated) == 0:
        log = ProcessingLog(
            id=uuid4(),
            segment_id=UUID(segment_id),
            stage='generating',
            message="No questions generated - transcript may lack factual content",
            level='warning'
        )
        db.add(log)
        await db.commit()
        raise HTTPException(
            status_code=400,
            detail="Could not generate questions. Try presenting more factual content."
        )
    
    # Log: Complete
    log = ProcessingLog(
        id=uuid4(),
        segment_id=UUID(segment_id),
        stage='complete',
        message=f"Generated {len(questions_generated)} questions"
    )
    db.add(log)
    
    await db.commit()
    
    # Update segment
    segment.status = SegmentStatus.QUIZ_READY.value
    await db.commit()
    
    # Mark chunks as finalized
    await db.execute(
        update(AudioChunk)
        .where(AudioChunk.segment_id == segment_id)
        .values(is_finalized=True)
    )
    await db.commit()
    
    # Broadcast: ready
    await hub.broadcast(
        segment.event_id,
        QuizReadyMessage(
            segment_id=UUID(segment_id),
            questions_count=len(questions_generated),
            auto_start=True
        ).model_dump()
    )
    
    # Cleanup chunks from MinIO after successful processing
    try:
        await storage.delete_segment_chunks(UUID(segment_id))
    except Exception as e:
        # Log but don't fail - cleanup is non-critical
        log = ProcessingLog(
            id=uuid4(),
            segment_id=UUID(segment_id),
            stage='cleanup',
            message=f"Chunk cleanup warning: {str(e)}",
            level='warning'
        )
        db.add(log)
        await db.commit()
    
    return {
        "success": True,
        "chunks_processed": len(chunks),
        "transcript_length": len(transcript_text),
        "questions_generated": len(questions_generated),
    }


@router.get("/segments/{segment_id}/processing-logs")
async def get_processing_logs(
    segment_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[dict]:
    """Get processing logs for a segment (host only)."""
    # Verify authorization
    result = await db.execute(
        select(Segment).join(Event).where(
            Segment.id == segment_id,
            Event.host_id == current_user.id
        )
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=404, detail="Segment not found")
    
    # Get logs
    logs_result = await db.execute(
        select(ProcessingLog)
        .where(ProcessingLog.segment_id == segment_id)
        .order_by(ProcessingLog.created_at.desc())
        .limit(100)
    )
    logs = logs_result.scalars().all()
    
    return [{
        "stage": log.stage,
        "message": log.message,
        "level": log.level,
        "created_at": log.created_at.isoformat()
    } for log in logs]



