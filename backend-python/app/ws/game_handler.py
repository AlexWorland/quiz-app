"""WebSocket game handler."""

import logging
from datetime import datetime, timezone
from typing import Iterable
from uuid import UUID

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import Event, EventParticipant, JoinStatus, Question, Segment, SegmentScore, SegmentStatus
from app.services.mega_quiz import (
    aggregate_event_questions,
    get_mega_quiz_metadata,
    should_emit_mega_quiz_ready,
)
from app.services.scoring import apply_score, calculate_speed_based_score
from app.ws.hub import hub
from app.ws.messages import (
    AdminSelectPresenterMessage,
    AnswerDistribution,
    AnswerReceivedMessage,
    ConnectedMessage,
    ErrorMessage,
    EventCompleteMessage,
    GameEndedMessage,
    GameStartedMessage,
    LeaderboardMessage,
    MegaQuizReadyMessage,
    MegaQuizStartedMessage,
    NoQuestionsGeneratedMessage,
    ParticipantInfo,
    ParticipantJoinedMessage,
    ParticipantLeftMessage,
    PhaseChangedMessage,
    QuestionMessage,
    QuizPhase,
    RevealMessage,
    SegmentCompleteMessage,
    SegmentWinner,
    PresenterChangedMessage,
    PresenterDisconnectedMessage,
    PresenterOverrideNeededMessage,
    PresenterPausedMessage,
    parse_client_message,
)

router = APIRouter()
settings = get_settings()


def _can_control_segment(event: Event, segment: Segment, user_id: UUID) -> bool:
    """Return True if the user is host or presenter for the segment."""
    return event.host_id == user_id or segment.presenter_user_id == user_id


async def _get_active_segment_with_event(
    db: AsyncSession, event_uuid: UUID
) -> Segment | None:
    """Fetch the first segment for an event that has at least one question."""
    result = await db.execute(
        select(Segment)
        .join(Event, Segment.event_id == Event.id)
        .join(Question, Question.segment_id == Segment.id)
        .where(Segment.event_id == event_uuid)
        .order_by(Segment.order_index)
    )
    segment = result.scalars().first()
    if segment:
        # Ensure event relationship is available
        await db.refresh(segment, attribute_names=["event"])
    return segment


def _build_question_payload(
    question_id: UUID,
    question_text: str,
    correct_answer: str,
    total_questions: int,
    time_limit: int,
    index: int,
) -> QuestionMessage:
    """Build a QuestionMessage for broadcasting."""
    return QuestionMessage(
        question_id=question_id,
        question_number=index + 1,
        total_questions=total_questions,
        text=question_text,
        answers=[correct_answer],
        time_limit=time_limit,
    )


def _build_reveal_payload(
    question: Question,
    question_index: int,
    answers: Iterable[str],
) -> RevealMessage:
    """Build a RevealMessage using the collected answers."""
    # Compute distribution counts
    counts: dict[str, int] = {}
    for answer in answers:
        counts[answer] = counts.get(answer, 0) + 1

    total = sum(counts.values()) or 1
    distribution = [
        AnswerDistribution(
            answer=answer,
            count=count,
            percentage=(count / total) * 100,
        )
        for answer, count in counts.items()
    ]

    return RevealMessage(
        question_id=question.id,
        question_number=question_index + 1,
        question_text=question.question_text,
        correct_answer=question.correct_answer,
        distribution=distribution,
        segment_leaderboard=[],
        event_leaderboard=[],
    )


def _calculate_response_time_ms(
    question_started_at: datetime | None, submitted_at: datetime
) -> int | None:
    """Return response time in ms; None when timing data missing."""
    if question_started_at is None:
        return None
    return max(0, int((submitted_at - question_started_at).total_seconds() * 1000))


async def _score_answer_submission(
    db: AsyncSession,
    session,
    participant_id: UUID,
    selected_answer: str,
    submitted_at: datetime,
) -> bool:
    """Score a participant's answer for the current question."""
    question_index = session.game_state.current_question_index
    questions = session.game_state.questions
    question_started_at = session.game_state.question_started_at
    segment_id = session.game_state.current_segment_id

    if (
        not questions
        or question_index >= len(questions)
        or question_started_at is None
        or segment_id is None
    ):
        return False

    question_data = questions[question_index]
    time_limit_ms = session.game_state.time_limit_seconds * 1000
    response_time_ms = _calculate_response_time_ms(question_started_at, submitted_at)
    if response_time_ms is None:
        return False

    is_correct = selected_answer == question_data["correct_answer"]
    delta_score = (
        calculate_speed_based_score(time_limit_ms, response_time_ms)
        if is_correct
        else 0
    )

    await apply_score(
        db,
        segment_id=segment_id,
        participant_id=participant_id,
        delta_score=delta_score,
        is_correct=is_correct,
        response_time_ms=response_time_ms,
    )
    return True


async def _apply_zero_scores_for_unanswered(
    db: AsyncSession, session
) -> None:
    """Assign zero scores to participants who did not answer the current question."""
    question_id = session.game_state.current_question_id
    segment_id = session.game_state.current_segment_id

    if not question_id or not segment_id:
        return

    if question_id in session.game_state.scored_question_ids:
        return

    answered_ids = set(session.game_state.answers_received.keys())
    participants = list(session.game_state.participants.values())
    has_changes = False

    for participant in participants:
        if participant.join_status == JoinStatus.SEGMENT_COMPLETE.value:
            continue

        if participant.user_id in answered_ids:
            continue

        await apply_score(
            db,
            segment_id=segment_id,
            participant_id=participant.user_id,
            delta_score=0,
            is_correct=False,
            response_time_ms=None,
            commit=False,
        )
        has_changes = True

        if participant.join_status == JoinStatus.WAITING_FOR_SEGMENT.value:
            participant.join_status = JoinStatus.ACTIVE_IN_QUIZ.value
            participant_row = await db.get(EventParticipant, participant.user_id)
            if participant_row:
                participant_row.join_status = JoinStatus.ACTIVE_IN_QUIZ.value

    if has_changes:
        await db.commit()

    session.game_state.scored_question_ids.add(question_id)


async def _get_event_leaderboard(db: AsyncSession, event_id: UUID, session=None) -> list[dict[str, Any]]:
    """Fetch event leaderboard ordered by score and response time."""
    from app.models import EventParticipant

    result = await db.execute(
        select(EventParticipant)
        .where(EventParticipant.event_id == event_id)
        .order_by(
            EventParticipant.total_score.desc(),
            EventParticipant.total_response_time_ms.asc(),
        )
    )
    participants = result.scalars().all()
    leaderboard = []
    
    # Get current connection status from hub session if available
    connected_participants = set()
    if session and hasattr(session.game_state, 'participants'):
        connected_participants = {
            p_id for p_id, p_info in session.game_state.participants.items() 
            if getattr(p_info, 'online', True)
        }
    
    for idx, participant in enumerate(participants):
        is_present = (
            len(connected_participants) == 0 or  # If no session info, assume all present
            participant.id in connected_participants
        )
        
        leaderboard.append(
            {
                "rank": idx + 1,
                "user_id": participant.id,
                "username": participant.display_name,
                "avatar_url": participant.avatar_url,
                "score": participant.total_score,
                "is_late_joiner": participant.is_late_joiner,
                "response_time_ms": participant.total_response_time_ms,
                "is_present": is_present,
            }
        )
    return leaderboard


async def _get_segment_leaderboard(db: AsyncSession, segment_id: UUID) -> list[dict[str, Any]]:
    """Fetch leaderboard for a segment."""
    from app.models import EventParticipant, SegmentScore

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
    leaderboard: list[dict[str, Any]] = []
    for idx, (score_row, participant) in enumerate(rows):
        leaderboard.append(
            {
                "rank": idx + 1,
                "user_id": participant.id,
                "username": participant.display_name,
                "avatar_url": participant.avatar_url,
                "score": score_row.score,
                "is_late_joiner": participant.is_late_joiner,
                "response_time_ms": score_row.total_response_time_ms,
            }
        )
    return leaderboard


async def _get_segment_winners(db: AsyncSession, event_id: UUID) -> list[SegmentWinner]:
    """Return winners for each completed segment."""
    result = await db.execute(
        select(SegmentScore, Segment, EventParticipant)
        .join(Segment, SegmentScore.segment_id == Segment.id)
        .join(EventParticipant, SegmentScore.participant_id == EventParticipant.id)
        .where(Segment.event_id == event_id)
        .where(Segment.status == SegmentStatus.COMPLETED.value)
        .order_by(Segment.order_index, SegmentScore.score.desc(), SegmentScore.total_response_time_ms.asc())
    )
    rows = result.all()
    winners: dict[UUID, SegmentWinner] = {}
    for score_row, segment_row, participant in rows:
        if segment_row.id in winners:
            continue
        winners[segment_row.id] = SegmentWinner(
            segment_id=segment_row.id,
            segment_title=segment_row.title or "Segment",
            winner_name=participant.display_name,
            winner_score=score_row.score,
        )
    return list(winners.values())


async def _maybe_emit_completion_payload(
    db: AsyncSession, event_id: UUID
) -> MegaQuizReadyMessage | EventCompleteMessage | None:
    """If all segments completed, return mega quiz ready or final event payload."""
    incomplete = await db.execute(
        select(Segment).where(Segment.event_id == event_id, Segment.status != SegmentStatus.COMPLETED.value)
    )
    if incomplete.first():
        return None

    metadata = await get_mega_quiz_metadata(db, event_id)
    leaderboard = await _get_event_leaderboard(db, event_id)

    if should_emit_mega_quiz_ready(metadata, settings.mega_quiz_single_segment_mode):
        return MegaQuizReadyMessage(
            event_id=event_id,
            available_questions=metadata.available_questions,
            current_leaderboard=leaderboard,
            is_single_segment=metadata.is_single_segment,
            single_segment_mode=settings.mega_quiz_single_segment_mode,
        )

    segment_winners = await _get_segment_winners(db, event_id)
    winner = leaderboard[0] if leaderboard else None

    return EventCompleteMessage(
        event_id=event_id,
        final_leaderboard=leaderboard,
        winner=winner,
        segment_winners=segment_winners,
    )


@router.websocket("/ws/event/{event_id}")
async def websocket_event(websocket: WebSocket, event_id: str):
    """WebSocket endpoint for quiz game events."""
    await websocket.accept()

    event_uuid = UUID(event_id)
    user_id: UUID | None = None

    try:
        while True:
            data = await websocket.receive_json()
            message = parse_client_message(data)

            if message is None:
                await websocket.send_json(
                    ErrorMessage(message="Unknown message type").model_dump()
                )
                continue

            msg_type = data.get("type")

            if msg_type == "join":
                user_id = message.user_id
                
                # Check if this is a reconnection
                connection_state = hub.get_connection_state(event_uuid, user_id)
                is_reconnection = connection_state == 'temporarily_disconnected'
                
                if is_reconnection:
                    await hub.reconnect(event_uuid, user_id, websocket)
                else:
                    await hub.connect(event_uuid, user_id, websocket)

                session = await hub.get_or_create_session(event_uuid)
                joined_at = datetime.now(timezone.utc)

                # Derive late-join status based on current quiz phase
                current_phase = session.game_state.quiz_phase
                question_started_at = session.game_state.question_started_at
                is_question_active = current_phase == QuizPhase.SHOWING_QUESTION and question_started_at is not None

                join_status = JoinStatus.JOINED.value
                is_late_joiner = False
                if is_question_active:
                    join_status = JoinStatus.WAITING_FOR_SEGMENT.value
                    is_late_joiner = True

                username = data.get("username", "Anonymous")
                avatar_url = data.get("avatar_url")

                # Try to hydrate from DB if participant exists
                async for db in get_db():
                    participant_row = await db.get(EventParticipant, user_id)
                    if participant_row:
                        username = participant_row.display_name
                        avatar_url = participant_row.avatar_url or avatar_url
                        join_status = participant_row.join_status or join_status
                        is_late_joiner = participant_row.is_late_joiner or is_late_joiner
                        joined_at = participant_row.join_timestamp or joined_at
                    break

                # Get existing participants
                state = hub.get_game_state(event_uuid)
                participants = list(state.participants.values()) if state else []

                # Send connected message
                await websocket.send_json(
                    ConnectedMessage(participants=participants).model_dump()
                )

                # If reconnecting, send state restoration
                if is_reconnection:
                    from app.ws.messages import StateRestoredMessage
                    
                    # Get participant's current score from database
                    your_score = 0
                    your_answer = None
                    async for db in get_db():
                        participant_row = await db.get(EventParticipant, user_id)
                        if participant_row:
                            your_score = participant_row.total_score
                        break
                    
                    # Check if participant has answered current question
                    if state and state.answers_received:
                        your_answer = state.answers_received.get(user_id)
                    
                    # Prepare minimal question data for reconnection
                    # Don't send full question with answers - that will come via normal question message if needed
                    question_text = None
                    answers = []
                    time_limit = None
                    question_started_at = None
                    current_question_id = state.current_question_id if state else None
                    
                    if state and state.quiz_phase == QuizPhase.SHOWING_QUESTION:
                        time_limit = state.time_limit_seconds
                        question_started_at = state.question_started_at
                    
                    # Send state restored message
                    await websocket.send_json(
                        StateRestoredMessage(
                            event_id=event_uuid,
                            segment_id=state.current_segment_id if state else None,
                            current_phase=state.quiz_phase if state else QuizPhase.NOT_STARTED,
                            current_question_id=current_question_id,
                            question_text=question_text,
                            answers=answers,
                            time_limit=time_limit,
                            question_started_at=question_started_at,
                            your_score=your_score,
                            your_answer=your_answer,
                            participants=[p.model_dump() for p in participants],
                        ).model_dump(mode="json")
                    )

                # Add participant and broadcast join
                participant = ParticipantInfo(
                    user_id=user_id,
                    username=username,
                    avatar_url=avatar_url,
                    join_status=join_status,
                    is_late_joiner=is_late_joiner,
                    joined_at=joined_at,
                )
                await hub.add_participant(event_uuid, participant)
                
                # Only broadcast participant_joined if not reconnecting (to avoid spam)
                if not is_reconnection:
                    await hub.broadcast(
                        event_uuid,
                        ParticipantJoinedMessage(user=participant).model_dump(),
                    )

                # Resume a paused quiz when it was waiting for participants
                session = await hub.get_or_create_session(event_uuid)
                if (
                    session.game_state.presenter_paused
                    and session.game_state.presenter_pause_reason == "no_participants"
                    and hub.get_participant_count(event_uuid) > 0
                    and session.game_state.questions
                ):
                    session.game_state.presenter_paused = False
                    session.game_state.presenter_pause_reason = None
                    session.game_state.quiz_phase = QuizPhase.SHOWING_QUESTION
                    session.game_state.question_started_at = datetime.now(timezone.utc)

                    question_index = session.game_state.current_question_index
                    questions = session.game_state.questions
                    total_questions = session.game_state.total_questions

                    if questions and question_index < len(questions):
                        current_question = questions[question_index]
                        session.game_state.current_question_id = current_question["id"]

                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.SHOWING_QUESTION,
                                question_index=question_index,
                                total_questions=total_questions,
                            ).model_dump(),
                        )

                        await hub.broadcast(
                            event_uuid,
                            _build_question_payload(
                                question_id=current_question["id"],
                                question_text=current_question["text"],
                                correct_answer=current_question["correct_answer"],
                                total_questions=total_questions,
                                time_limit=session.game_state.time_limit_seconds,
                                index=question_index,
                            ).model_dump(),
                        )

                # If the presenter reconnects while the quiz is paused, resume the current question
                if (
                    session.game_state.presenter_paused
                    and session.game_state.current_presenter_id == user_id
                ):
                    session.game_state.presenter_paused = False
                    session.game_state.presenter_pause_reason = None
                    session.game_state.quiz_phase = QuizPhase.SHOWING_QUESTION
                    session.game_state.question_started_at = datetime.now(timezone.utc)

                    question_index = session.game_state.current_question_index
                    questions = session.game_state.questions
                    total_questions = session.game_state.total_questions

                    if questions and question_index < len(questions):
                        current_question = questions[question_index]
                        session.game_state.current_question_id = current_question["id"]

                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.SHOWING_QUESTION,
                                question_index=question_index,
                                total_questions=total_questions,
                            ).model_dump(),
                        )

                        await hub.broadcast(
                            event_uuid,
                            _build_question_payload(
                                question_id=current_question["id"],
                                question_text=current_question["text"],
                                correct_answer=current_question["correct_answer"],
                                total_questions=total_questions,
                                time_limit=session.game_state.time_limit_seconds,
                                index=question_index,
                            ).model_dump(),
                        )

            elif msg_type == "pong" and user_id:
                # Handle heartbeat pong response
                hub.handle_pong(user_id)
                continue

            elif msg_type == "answer" and user_id:
                session = await hub.get_or_create_session(event_uuid)
                if message.question_id != session.game_state.current_question_id:
                    await websocket.send_json(
                        ErrorMessage(message="Stale answer for previous question").model_dump()
                    )
                    continue

                submission_time = datetime.now(timezone.utc)
                success, error_reason = await hub.record_answer(
                    event_uuid,
                    user_id,
                    message.selected_answer,
                    submitted_at=submission_time,
                )
                if success:
                    async for db in get_db():
                        await _score_answer_submission(
                            db,
                            session=session,
                            participant_id=user_id,
                            selected_answer=message.selected_answer,
                            submitted_at=submission_time,
                        )
                        break

                    await hub.broadcast(
                        event_uuid,
                        AnswerReceivedMessage(user_id=user_id).model_dump(),
                    )
                else:
                    # Send specific error message to user
                    error_messages = {
                        'duplicate': 'You have already submitted an answer for this question',
                        'too_late': 'Time expired. Your answer was not recorded',
                        'no_question': 'No active question to answer',
                        'no_session': 'Event session not found',
                        'late_join': 'You can start answering with the next question',
                        'paused': 'Quiz is paused while the presenter reconnects',
                    }
                    await websocket.send_json(
                        ErrorMessage(
                            message=error_messages.get(error_reason, 'Failed to record answer')
                        ).model_dump()
                    )

            elif msg_type == "start_mega_quiz":
                # Aggregate questions from all segments
                async for db in get_db():
                    question_count = message.question_count or 10
                    questions = await aggregate_event_questions(db, event_uuid, question_count)

                    if not questions:
                        await websocket.send_json(
                            ErrorMessage(message="No questions available for mega quiz").model_dump()
                        )
                        continue

                    # Broadcast mega quiz started
                    await hub.broadcast(
                        event_uuid,
                        MegaQuizStartedMessage(
                            event_id=event_uuid,
                            question_count=len(questions)
                        ).model_dump(),
                    )
                    break

            elif msg_type == "admin_select_presenter" and user_id:
                # Host override to assign presenter for a specific segment
                async for db in get_db():
                    from sqlalchemy import select, update
                    from app.models import Event, Segment, EventParticipant, User

                    message = AdminSelectPresenterMessage.model_validate(data)

                    # Verify host
                    event_result = await db.execute(select(Event).where(Event.id == event_uuid))
                    event = event_result.scalar_one_or_none()
                    if not event:
                        await websocket.send_json(
                            ErrorMessage(message="Event not found").model_dump()
                        )
                        break
                    if event.host_id != user_id:
                        await websocket.send_json(
                            ErrorMessage(message="Only the host can assign presenter").model_dump()
                        )
                        break

                    # Validate segment belongs to event
                    segment_result = await db.execute(
                        select(Segment).where(Segment.id == message.segment_id, Segment.event_id == event_uuid)
                    )
                    segment = segment_result.scalar_one_or_none()
                    if not segment:
                        await websocket.send_json(
                            ErrorMessage(message="Segment not found").model_dump()
                        )
                        break

                    # Lookup presenter display name (participant or user)
                    participant_result = await db.execute(
                        select(EventParticipant).where(
                            EventParticipant.event_id == event_uuid,
                            EventParticipant.user_id == message.presenter_user_id,
                        )
                    )
                    next_participant = participant_result.scalar_one_or_none()

                    user_result = await db.execute(select(User).where(User.id == message.presenter_user_id))
                    user_row = user_result.scalar_one_or_none()

                    new_presenter_name = (
                        next_participant.display_name
                        if next_participant
                        else (user_row.username if user_row else "Presenter")
                    )

                    # Update segment presenter
                    await db.execute(
                        update(Segment)
                        .where(Segment.id == message.segment_id)
                        .values(presenter_user_id=message.presenter_user_id)
                    )
                    await db.commit()

                    # Update GameState cache
                    session = await hub.get_or_create_session(event_uuid)
                    previous_presenter_id = session.game_state.current_presenter_id
                    session.game_state.current_segment_id = message.segment_id
                    session.game_state.current_presenter_id = message.presenter_user_id

                    await hub.broadcast(
                        event_uuid,
                        PresenterChangedMessage(
                            previous_presenter_id=previous_presenter_id or user_id,
                            new_presenter_id=message.presenter_user_id,
                            new_presenter_name=new_presenter_name,
                            segment_id=message.segment_id,
                        ).model_dump(),
                    )
                    break

            elif msg_type == "pass_presenter" and user_id:
                # Handle presenter handoff
                async for db in get_db():
                    from sqlalchemy import select, update
                    from app.models import Event, Segment, EventParticipant

                    next_presenter_id = message.next_presenter_user_id

                    # Get current segment
                    session = await hub.get_or_create_session(event_uuid)
                    current_segment_id = session.game_state.current_segment_id

                    if not current_segment_id:
                        await websocket.send_json(
                            ErrorMessage(message="No active segment to pass presenter").model_dump()
                        )
                        break

                    # Verify authorization (must be host or current presenter)
                    event_result = await db.execute(
                        select(Event).where(Event.id == event_uuid)
                    )
                    event = event_result.scalar_one_or_none()

                    segment_result = await db.execute(
                        select(Segment).where(Segment.id == current_segment_id)
                    )
                    segment = segment_result.scalar_one_or_none()

                    if not event or not segment:
                        await websocket.send_json(
                            ErrorMessage(message="Event or segment not found").model_dump()
                        )
                        break

                    is_host = event.host_id == user_id
                    is_current_presenter = segment.presenter_user_id == user_id

                    if not (is_host or is_current_presenter):
                        await websocket.send_json(
                            ErrorMessage(message="Only host or current presenter can pass presenter role").model_dump()
                        )
                        break

                    # Get next presenter info
                    participant_result = await db.execute(
                        select(EventParticipant).where(
                            EventParticipant.event_id == event_uuid,
                            EventParticipant.user_id == next_presenter_id,
                        )
                    )
                    next_participant = participant_result.scalar_one_or_none()

                    if not next_participant:
                        await websocket.send_json(
                            ErrorMessage(message="Next presenter not found in event").model_dump()
                        )
                        break

                    # Check if next presenter is currently connected
                    if next_presenter_id not in session.connections:
                        await websocket.send_json(
                            ErrorMessage(
                                message=f"Cannot pass presenter to {next_participant.display_name}. They are not currently connected to the event. Please select someone who is online."
                            ).model_dump()
                        )
                        break

                    # Update segment presenter
                    await db.execute(
                        update(Segment)
                        .where(Segment.id == current_segment_id)
                        .values(presenter_user_id=next_presenter_id)
                    )
                    await db.commit()

                    # Update GameState cache
                    session.game_state.current_presenter_id = next_presenter_id
                    session.game_state.current_segment_id = current_segment_id

                    # Broadcast presenter change
                    await hub.broadcast(
                        event_uuid,
                        PresenterChangedMessage(
                            previous_presenter_id=user_id,
                            new_presenter_id=next_presenter_id,
                            new_presenter_name=next_participant.display_name,
                            segment_id=current_segment_id
                        ).model_dump()
                    )
                    break

            elif msg_type == "skip_mega_quiz":
                async for db in get_db():
                    session = await hub.get_or_create_session(event_uuid)
                    final_lb = await _get_event_leaderboard(db, event_uuid, session)
                    segment_winners = await _get_segment_winners(db, event_uuid)
                    winner = final_lb[0] if final_lb else None

                    event_complete = EventCompleteMessage(
                        event_id=event_uuid,
                        final_leaderboard=final_lb,
                        winner=winner,
                        segment_winners=segment_winners,
                    )
                    session.game_state.quiz_phase = QuizPhase.EVENT_COMPLETE
                    session.game_state.presenter_paused = False
                    session.game_state.presenter_pause_reason = None

                    await hub.broadcast(event_uuid, event_complete.model_dump())
                    await hub.broadcast(
                        event_uuid,
                        PhaseChangedMessage(
                            phase=QuizPhase.EVENT_COMPLETE,
                            question_index=session.game_state.current_question_index,
                            total_questions=session.game_state.total_questions,
                        ).model_dump(),
                    )
                    break

            elif msg_type == "start_game" and user_id:
                async for db in get_db():
                    segment = await _get_active_segment_with_event(db, event_uuid)
                    if not segment:
                        await websocket.send_json(
                            ErrorMessage(message="No segment with questions available").model_dump()
                        )
                        break

                    if not _can_control_segment(segment.event, segment, user_id):
                        await websocket.send_json(
                            ErrorMessage(message="Only the host or presenter can start the quiz").model_dump()
                        )
                        break

                    # Load questions for the segment
                    q_result = await db.execute(
                        select(Question).where(Question.segment_id == segment.id).order_by(Question.order_index)
                    )
                    questions = q_result.scalars().all()
                    if not questions:
                        await websocket.send_json(
                            ErrorMessage(message="No questions found for this segment").model_dump()
                        )
                        break

                    session = await hub.get_or_create_session(event_uuid)
                    session.game_state.scored_question_ids.clear()
                    session.game_state.current_segment_id = segment.id
                    session.game_state.current_presenter_id = segment.presenter_user_id or user_id
                    session.game_state.questions = [
                        {"id": q.id, "text": q.question_text, "correct_answer": q.correct_answer} for q in questions
                    ]
                    session.game_state.total_questions = len(questions)
                    session.game_state.current_question_index = 0
                    session.game_state.current_question_id = questions[0].id
                    session.game_state.presenter_paused = False
                    session.game_state.presenter_pause_reason = None
                    session.game_state.quiz_phase = QuizPhase.SHOWING_QUESTION
                    session.game_state.time_limit_seconds = segment.event.time_per_question or session.game_state.time_limit_seconds
                    await hub.clear_answers(event_uuid)

                    # Pause if no connected participants (excluding current presenter)
                    presenter_id = session.game_state.current_presenter_id
                    connected_non_presenters = [
                        p for p in session.game_state.participants.values()
                        if p.user_id != presenter_id and p.online is not False
                    ]
                    no_connected_participants = len(connected_non_presenters) == 0

                    if no_connected_participants:
                        session.game_state.presenter_paused = True
                        session.game_state.presenter_pause_reason = "no_participants"
                        session.game_state.quiz_phase = QuizPhase.PRESENTER_PAUSED
                        session.game_state.question_started_at = None
                    else:
                        session.game_state.question_started_at = datetime.now(timezone.utc)

                    # Update segment status to reflect quiz in progress
                    segment.status = SegmentStatus.QUIZZING.value
                    segment.quiz_started_at = datetime.now(timezone.utc)
                    await db.flush()

                    time_limit = session.game_state.time_limit_seconds
                    await hub.broadcast(event_uuid, GameStartedMessage().model_dump())
                    if session.game_state.presenter_paused:
                        await hub.broadcast(
                            event_uuid,
                            PresenterPausedMessage(
                                presenter_id=session.game_state.current_presenter_id or user_id,
                                presenter_name=segment.presenter_name or "Presenter",
                                segment_id=segment.id,
                                question_index=session.game_state.current_question_index,
                                total_questions=session.game_state.total_questions,
                                reason="no_participants",
                            ).model_dump(),
                        )
                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.PRESENTER_PAUSED,
                                question_index=0,
                                total_questions=len(questions),
                            ).model_dump(),
                        )
                    else:
                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.SHOWING_QUESTION,
                                question_index=0,
                                total_questions=len(questions),
                            ).model_dump(),
                        )
                        await hub.broadcast(
                            event_uuid,
                            _build_question_payload(
                                question_id=questions[0].id,
                                question_text=questions[0].question_text,
                                correct_answer=questions[0].correct_answer,
                                total_questions=len(questions),
                                time_limit=time_limit,
                                index=0,
                            ).model_dump(),
                        )
                    break

            elif msg_type == "next_question" and user_id:
                session = await hub.get_or_create_session(event_uuid)
                # Ensure there is an active quiz
                if not session.game_state.questions:
                    await websocket.send_json(
                        ErrorMessage(message="No active quiz to advance").model_dump()
                    )
                    continue

                # Authorization check: host or presenter
                async for db in get_db():
                    event_row = await db.get(Event, event_uuid)
                    segment_id = session.game_state.current_segment_id
                    segment_row = await db.get(Segment, segment_id) if segment_id else None
                    if not event_row or not segment_row or not _can_control_segment(event_row, segment_row, user_id):
                        await websocket.send_json(
                            ErrorMessage(message="Only the host or presenter can change questions").model_dump()
                        )
                        break

                    await _apply_zero_scores_for_unanswered(db, session)

                    next_index = session.game_state.current_question_index + 1
                    questions = session.game_state.questions
                    if next_index >= len(questions):
                        session.game_state.quiz_phase = QuizPhase.SEGMENT_COMPLETE
                        await hub.broadcast(event_uuid, GameEndedMessage().model_dump())
                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.SEGMENT_COMPLETE,
                                question_index=session.game_state.current_question_index,
                                total_questions=len(questions),
                            ).model_dump(),
                        )

                        # Mark segment complete and broadcast results
                        if segment_id:
                            segment_row = await db.get(Segment, segment_id)
                            if segment_row:
                                segment_row.status = SegmentStatus.COMPLETED.value
                                segment_row.ended_at = datetime.now(timezone.utc)
                                await db.commit()

                                segment_lb = await _get_segment_leaderboard(db, segment_id)
                                event_lb = await _get_event_leaderboard(db, event_uuid, session)
                                await hub.broadcast(
                                    event_uuid,
                                    SegmentCompleteMessage(
                                        segment_id=segment_id,
                                        segment_title=segment_row.title or "Segment",
                                        presenter_name=segment_row.presenter_name,
                                        segment_leaderboard=segment_lb,
                                        event_leaderboard=event_lb,
                                        segment_winner=segment_lb[0] if segment_lb else None,
                                        event_leader=event_lb[0] if event_lb else None,
                                    ).model_dump(),
                                )

                                # If all segments complete, broadcast final event leaderboard
                                completion = await _maybe_emit_completion_payload(db, event_uuid)
                                if completion:
                                    session.game_state.quiz_phase = (
                                        QuizPhase.MEGA_QUIZ_READY
                                        if isinstance(completion, MegaQuizReadyMessage)
                                        else QuizPhase.EVENT_COMPLETE
                                    )

                                    await hub.broadcast(event_uuid, completion.model_dump())
                                    await hub.broadcast(
                                        event_uuid,
                                        PhaseChangedMessage(
                                            phase=session.game_state.quiz_phase,
                                            question_index=session.game_state.current_question_index,
                                            total_questions=session.game_state.total_questions,
                                        ).model_dump(),
                                    )
                        break

                    session.game_state.current_question_index = next_index
                    session.game_state.current_question_id = questions[next_index]["id"]
                    session.game_state.presenter_paused = False
                    session.game_state.quiz_phase = QuizPhase.SHOWING_QUESTION
                    session.game_state.question_started_at = datetime.now(timezone.utc)
                    await hub.clear_answers(event_uuid)

                    time_limit = session.game_state.time_limit_seconds
                    await hub.broadcast(
                        event_uuid,
                        PhaseChangedMessage(
                            phase=QuizPhase.SHOWING_QUESTION,
                            question_index=next_index,
                            total_questions=len(questions),
                        ).model_dump(),
                    )

                    await hub.broadcast(
                        event_uuid,
                        _build_question_payload(
                            question_id=questions[next_index]["id"],
                            question_text=questions[next_index]["text"],
                            correct_answer=questions[next_index]["correct_answer"],
                            total_questions=len(questions),
                            time_limit=time_limit,
                            index=next_index,
                        ).model_dump(),
                    )
                    break

            elif msg_type == "reveal_answer" and user_id:
                session = await hub.get_or_create_session(event_uuid)
                if not session.game_state.questions:
                    await websocket.send_json(ErrorMessage(message="No active question to reveal").model_dump())
                    continue

                current_index = session.game_state.current_question_index
                question_data = session.game_state.questions[current_index]
                question = Question(
                    id=question_data["id"],
                    segment_id=session.game_state.current_segment_id,
                    question_text=question_data["text"],
                    correct_answer=question_data["correct_answer"],
                    order_index=current_index,
                )

                # Authorization check
                async for db in get_db():
                    event_row = await db.get(Event, event_uuid)
                    segment_row = await db.get(Segment, session.game_state.current_segment_id)
                    if not event_row or not segment_row or not _can_control_segment(event_row, segment_row, user_id):
                        await websocket.send_json(
                            ErrorMessage(message="Only the host or presenter can reveal answers").model_dump()
                        )
                        break

                    session.game_state.quiz_phase = QuizPhase.REVEALING_ANSWER
                    await _apply_zero_scores_for_unanswered(db, session)
                    segment_lb = await _get_segment_leaderboard(db, segment_row.id) if segment_row else []
                    event_lb = await _get_event_leaderboard(db, event_uuid, session)

                    reveal_message = _build_reveal_payload(
                        question=question,
                        question_index=current_index,
                        answers=session.game_state.answers_received.values(),
                    )
                    reveal_message.segment_leaderboard = segment_lb
                    reveal_message.event_leaderboard = event_lb

                    await hub.broadcast(event_uuid, reveal_message.model_dump())
                    await hub.broadcast(
                        event_uuid,
                        PhaseChangedMessage(
                            phase=QuizPhase.REVEALING_ANSWER,
                            question_index=current_index,
                            total_questions=session.game_state.total_questions,
                        ).model_dump(),
                    )
                    break

            elif msg_type == "show_leaderboard" and user_id:
                session = await hub.get_or_create_session(event_uuid)
                async for db in get_db():
                    event_row = await db.get(Event, event_uuid)
                    segment_row = await db.get(Segment, session.game_state.current_segment_id) if session.game_state.current_segment_id else None
                    if not event_row or not segment_row or not _can_control_segment(event_row, segment_row, user_id):
                        await websocket.send_json(
                            ErrorMessage(message="Only the host or presenter can show leaderboard").model_dump()
                        )
                        break

                    await hub.broadcast(
                        event_uuid,
                        LeaderboardMessage(rankings=[]).model_dump(),
                    )
                    break

            elif msg_type == "end_game" and user_id:
                session = await hub.get_or_create_session(event_uuid)
                async for db in get_db():
                    event_row = await db.get(Event, event_uuid)
                    segment_row = await db.get(Segment, session.game_state.current_segment_id) if session.game_state.current_segment_id else None
                    if not event_row or not segment_row or not _can_control_segment(event_row, segment_row, user_id):
                        await websocket.send_json(
                            ErrorMessage(message="Only the host or presenter can end the quiz").model_dump()
                        )
                        break

                    await _apply_zero_scores_for_unanswered(db, session)

                    session.game_state.quiz_phase = QuizPhase.SEGMENT_COMPLETE
                    await hub.broadcast(event_uuid, GameEndedMessage().model_dump())
                    await hub.broadcast(
                        event_uuid,
                        PhaseChangedMessage(
                            phase=QuizPhase.SEGMENT_COMPLETE,
                            question_index=session.game_state.current_question_index,
                            total_questions=session.game_state.total_questions,
                        ).model_dump(),
                    )

                    # Persist segment completion
                    segment_row.status = SegmentStatus.COMPLETED.value
                    segment_row.ended_at = datetime.now(timezone.utc)
                    await db.commit()

                    # Broadcast segment completion payload
                    segment_lb = await _get_segment_leaderboard(db, segment_row.id)
                    event_lb = await _get_event_leaderboard(db, event_uuid, session)
                    await hub.broadcast(
                        event_uuid,
                        SegmentCompleteMessage(
                            segment_id=segment_row.id,
                            segment_title=segment_row.title or "Segment",
                            presenter_name=segment_row.presenter_name,
                            segment_leaderboard=segment_lb,
                            event_leaderboard=event_lb,
                            segment_winner=segment_lb[0] if segment_lb else None,
                            event_leader=event_lb[0] if event_lb else None,
                        ).model_dump(),
                    )

                    # If all segments are complete, emit final results
                    completion = await _maybe_emit_completion_payload(db, event_uuid)
                    if completion:
                        session.game_state.quiz_phase = (
                            QuizPhase.MEGA_QUIZ_READY
                            if isinstance(completion, MegaQuizReadyMessage)
                            else QuizPhase.EVENT_COMPLETE
                        )
                        await hub.broadcast(event_uuid, completion.model_dump())
                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=session.game_state.quiz_phase,
                                question_index=session.game_state.current_question_index,
                                total_questions=session.game_state.total_questions,
                            ).model_dump(),
                        )
                    break

    except WebSocketDisconnect:
        if user_id:
            # Check if disconnected user was the current presenter
            async for db in get_db():
                from sqlalchemy import select
                from app.models import Event, Segment, EventParticipant

                session = await hub.get_or_create_session(event_uuid)
                current_presenter_id = session.game_state.current_presenter_id
                current_segment_id = session.game_state.current_segment_id

                if current_presenter_id == user_id and current_segment_id:
                    # Get presenter name
                    participant_result = await db.execute(
                        select(EventParticipant).where(
                            EventParticipant.event_id == event_uuid,
                            EventParticipant.id == user_id
                        )
                    )
                    participant = participant_result.scalar_one_or_none()

                    if participant:
                        session.game_state.presenter_paused = True
                        session.game_state.presenter_pause_reason = "presenter_disconnected"
                        session.game_state.quiz_phase = QuizPhase.PRESENTER_PAUSED
                        session.game_state.question_started_at = None

                        await hub.broadcast(
                            event_uuid,
                            PresenterPausedMessage(
                                presenter_id=user_id,
                                presenter_name=participant.display_name,
                                segment_id=current_segment_id,
                                question_index=session.game_state.current_question_index,
                                total_questions=session.game_state.total_questions,
                                reason="presenter_disconnected",
                            ).model_dump(),
                        )

                        await hub.broadcast(
                            event_uuid,
                            PhaseChangedMessage(
                                phase=QuizPhase.PRESENTER_PAUSED,
                                question_index=session.game_state.current_question_index,
                                total_questions=session.game_state.total_questions,
                            ).model_dump(),
                        )

                        # Get event to find host
                        event_result = await db.execute(
                            select(Event).where(Event.id == event_uuid)
                        )
                        event = event_result.scalar_one_or_none()

                        if event and event.host_id:
                            await hub.send_to_user(
                                event_uuid,
                                event.host_id,
                                PresenterOverrideNeededMessage(
                                    presenter_id=user_id,
                                    presenter_name=participant.display_name,
                                    segment_id=current_segment_id,
                                ).model_dump(),
                            )
                            # Send notification to host only
                            await hub.send_to_user(
                                event_uuid,
                                event.host_id,
                                PresenterDisconnectedMessage(
                                    presenter_id=user_id,
                                    presenter_name=participant.display_name,
                                    segment_id=current_segment_id
                                ).model_dump()
                            )
                break

            await hub.disconnect(event_uuid, user_id)
            await hub.broadcast(
                event_uuid,
                ParticipantLeftMessage(user_id=user_id, online=False).model_dump(),
            )

            # If everyone disconnected during an active quiz, pause with reason
            session = await hub.get_or_create_session(event_uuid)
            if (
                session
                and session.game_state.quiz_phase not in {QuizPhase.NOT_STARTED, QuizPhase.EVENT_COMPLETE, QuizPhase.MEGA_QUIZ_READY}
                and hub.get_participant_count(event_uuid) == 0
            ):
                presenter_name = "Presenter"
                if "participant" in locals() and participant:
                    presenter_name = participant.display_name
                session.game_state.presenter_paused = True
                session.game_state.presenter_pause_reason = "all_disconnected"
                session.game_state.quiz_phase = QuizPhase.PRESENTER_PAUSED
                session.game_state.question_started_at = None
                await hub.broadcast(
                    event_uuid,
                    PresenterPausedMessage(
                        presenter_id=session.game_state.current_presenter_id or user_id,
                        presenter_name=presenter_name,
                        segment_id=session.game_state.current_segment_id or UUID(int=0),
                        question_index=session.game_state.current_question_index,
                        total_questions=session.game_state.total_questions,
                        reason="all_disconnected",
                    ).model_dump(),
                )
                await hub.broadcast(
                    event_uuid,
                    PhaseChangedMessage(
                        phase=QuizPhase.PRESENTER_PAUSED,
                        question_index=session.game_state.current_question_index,
                        total_questions=session.game_state.total_questions,
                    ).model_dump(),
                )
    except Exception:
        logging.exception("WebSocket handler failed for event %s", event_id)
        if user_id:
            await hub.disconnect(event_uuid, user_id)
