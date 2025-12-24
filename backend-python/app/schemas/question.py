"""Question Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class CreateQuestionRequest(BaseModel):
    """Create question request."""

    question_text: str = Field(..., min_length=1)
    correct_answer: str = Field(..., min_length=1)
    order_index: int | None = None


class UpdateQuestionRequest(BaseModel):
    """Update question request."""

    question_text: str | None = None
    correct_answer: str | None = None
    order_index: int | None = None


class QuestionResponse(BaseModel):
    """Question response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    segment_id: UUID
    question_text: str
    correct_answer: str
    order_index: int
    is_ai_generated: bool | None = None
    source_transcript: str | None = None
    quality_score: float | None = None
    generated_at: datetime | None = None
    created_at: datetime | None = None


class BulkQuestionItem(BaseModel):
    """Single question for bulk import."""

    question_text: str
    correct_answer: str


class BulkImportQuestionsRequest(BaseModel):
    """Bulk import questions request."""

    questions: list[BulkQuestionItem]


class BulkImportResult(BaseModel):
    """Bulk import result."""

    imported: int
    failed: int
    questions: list[QuestionResponse]


# Leaderboard
class LeaderboardEntry(BaseModel):
    """Leaderboard entry."""

    rank: int
    user_id: UUID
    username: str
    avatar_url: str | None = None
    score: int
    is_late_joiner: bool = False
    response_time_ms: int | None = None
