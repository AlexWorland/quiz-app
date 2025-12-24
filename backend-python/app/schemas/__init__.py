"""Pydantic schemas."""

from app.schemas.auth import (
    AuthResponse,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)
from app.schemas.event import (
    CreateEventRequest,
    CreateSegmentRequest,
    EventParticipantResponse,
    EventResponse,
    JoinEventRequest,
    JoinEventResponse,
    JoinLockResponse,
    QrCodeResponse,
    SegmentResponse,
    UpdateEventRequest,
    UpdateSegmentRequest,
)
from app.schemas.question import (
    BulkImportQuestionsRequest,
    BulkImportResult,
    BulkQuestionItem,
    CreateQuestionRequest,
    LeaderboardEntry,
    QuestionResponse,
    UpdateQuestionRequest,
)

__all__ = [
    # Auth
    "RegisterRequest",
    "LoginRequest",
    "UpdateProfileRequest",
    "UserResponse",
    "AuthResponse",
    # Event
    "CreateEventRequest",
    "UpdateEventRequest",
    "EventResponse",
    "CreateSegmentRequest",
    "UpdateSegmentRequest",
    "SegmentResponse",
    "JoinEventRequest",
    "JoinEventResponse",
    "JoinLockResponse",
    "EventParticipantResponse",
    "QrCodeResponse",
    # Question
    "CreateQuestionRequest",
    "UpdateQuestionRequest",
    "QuestionResponse",
    "BulkQuestionItem",
    "BulkImportQuestionsRequest",
    "BulkImportResult",
    "LeaderboardEntry",
]
