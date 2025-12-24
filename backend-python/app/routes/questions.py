"""Question routes."""

from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth import CurrentUser
from app.database import get_db
from app.models import Event, Question, Segment
from app.schemas import (
    BulkImportQuestionsRequest,
    BulkImportResult,
    CreateQuestionRequest,
    QuestionResponse,
    UpdateQuestionRequest,
)

router = APIRouter()


@router.get("/segments/{segment_id}/questions", response_model=list[QuestionResponse])
async def get_questions(
    segment_id: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> list[QuestionResponse]:
    """Get all questions for a segment."""
    result = await db.execute(
        select(Question)
        .where(Question.segment_id == segment_id)
        .order_by(Question.order_index)
    )
    questions = result.scalars().all()
    return [QuestionResponse.model_validate(q) for q in questions]


@router.post("/segments/{segment_id}/questions", response_model=QuestionResponse, status_code=status.HTTP_201_CREATED)
async def create_question(
    segment_id: str,
    request: CreateQuestionRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QuestionResponse:
    """Create a question for a segment."""
    # Verify ownership
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    # Get next order index if not specified
    order_index = request.order_index
    if order_index is None:
        result = await db.execute(
            select(func.coalesce(func.max(Question.order_index), -1) + 1)
            .where(Question.segment_id == segment_id)
        )
        order_index = result.scalar() or 0

    question = Question(
        id=uuid4(),
        segment_id=segment.id,
        question_text=request.question_text,
        correct_answer=request.correct_answer,
        order_index=order_index,
        is_ai_generated=False,
    )
    db.add(question)
    await db.flush()
    return QuestionResponse.model_validate(question)


@router.post("/segments/{segment_id}/questions/bulk", response_model=BulkImportResult)
async def bulk_import_questions(
    segment_id: str,
    request: BulkImportQuestionsRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> BulkImportResult:
    """Bulk import questions for a segment."""
    # Verify ownership
    result = await db.execute(
        select(Segment).join(Event).where(Segment.id == segment_id, Event.host_id == current_user.id)
    )
    segment = result.scalar_one_or_none()
    if not segment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Segment not found")

    # Get starting order index
    result = await db.execute(
        select(func.coalesce(func.max(Question.order_index), -1) + 1)
        .where(Question.segment_id == segment_id)
    )
    start_index = result.scalar() or 0

    imported_questions = []
    for i, item in enumerate(request.questions):
        question = Question(
            id=uuid4(),
            segment_id=segment.id,
            question_text=item.question_text,
            correct_answer=item.correct_answer,
            order_index=start_index + i,
            is_ai_generated=False,
        )
        db.add(question)
        imported_questions.append(question)

    await db.flush()

    return BulkImportResult(
        imported=len(imported_questions),
        failed=0,
        questions=[QuestionResponse.model_validate(q) for q in imported_questions],
    )


@router.put("/questions/{question_id}", response_model=QuestionResponse)
async def update_question(
    question_id: str,
    request: UpdateQuestionRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> QuestionResponse:
    """Update a question."""
    result = await db.execute(
        select(Question)
        .join(Segment)
        .join(Event)
        .where(Question.id == question_id, Event.host_id == current_user.id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")

    if request.question_text is not None:
        question.question_text = request.question_text
    if request.correct_answer is not None:
        question.correct_answer = request.correct_answer
    if request.order_index is not None:
        question.order_index = request.order_index

    await db.flush()
    return QuestionResponse.model_validate(question)


@router.delete("/questions/{question_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_question(
    question_id: str,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> None:
    """Delete a question."""
    result = await db.execute(
        select(Question)
        .join(Segment)
        .join(Event)
        .where(Question.id == question_id, Event.host_id == current_user.id)
    )
    question = result.scalar_one_or_none()
    if not question:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Question not found")
    await db.delete(question)
