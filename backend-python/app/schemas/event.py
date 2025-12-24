"""Event and Segment Pydantic schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


# Event schemas
class CreateEventRequest(BaseModel):
    """Create event request."""

    title: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    mode: str | None = None  # "listen_only" or "normal"
    num_fake_answers: int | None = Field(None, ge=1, le=5)
    time_per_question: int | None = Field(None, ge=5, le=300)
    question_gen_interval_seconds: int | None = Field(None, ge=10, le=300)


class UpdateEventRequest(BaseModel):
    """Update event request."""

    title: str | None = None
    description: str | None = None
    status: str | None = None
    num_fake_answers: int | None = None
    time_per_question: int | None = None
    question_gen_interval_seconds: int | None = None


class EventResponse(BaseModel):
    """Event response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    host_id: UUID
    title: str
    description: str | None = None
    join_code: str
    mode: str
    status: str
    num_fake_answers: int
    time_per_question: int
    question_gen_interval_seconds: int | None = None
    join_locked: bool
    join_locked_at: datetime | None = None
    created_at: datetime


# Segment schemas
class CreateSegmentRequest(BaseModel):
    """Create segment request."""

    presenter_name: str = Field(..., min_length=1, max_length=255)
    presenter_user_id: UUID | None = None
    title: str | None = None


class UpdateSegmentRequest(BaseModel):
    """Update segment request."""

    presenter_name: str | None = None
    title: str | None = None
    status: str | None = None
    previous_status: str | None = None


class SegmentResponse(BaseModel):
    """Segment response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    presenter_name: str
    presenter_user_id: UUID | None = None
    title: str | None = None
    order_index: int
    status: str
    recording_started_at: datetime | None = None
    recording_ended_at: datetime | None = None
    quiz_started_at: datetime | None = None
    previous_status: str | None = None
    ended_at: datetime | None = None
    created_at: datetime


# Join event schemas
class JoinEventRequest(BaseModel):
    """Join event request (anonymous)."""

    code: str
    device_fingerprint: str = Field(..., alias="deviceFingerprint")
    display_name: str
    avatar_url: str | None = None
    avatar_type: str | None = None

    model_config = ConfigDict(populate_by_name=True)


class JoinEventResponse(BaseModel):
    """Join event response."""

    event_id: UUID = Field(..., alias="eventId")
    device_id: UUID = Field(..., alias="deviceId")
    session_token: str = Field(..., alias="sessionToken")
    display_name: str = Field(..., alias="displayName")
    is_rejoining: bool = Field(..., alias="isRejoining")

    model_config = ConfigDict(populate_by_name=True, by_alias=True)


class JoinLockResponse(BaseModel):
    """Join lock status response."""

    join_locked: bool
    join_locked_at: datetime | None = None
    message: str


# Participant schemas
class EventParticipantResponse(BaseModel):
    """Event participant response."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    event_id: UUID
    display_name: str
    avatar_url: str | None = None
    avatar_type: str | None = None
    total_score: int
    join_status: str
    is_late_joiner: bool


# QR code
class QrCodeResponse(BaseModel):
    """QR code response."""

    qr_code: str  # SVG string
    join_url: str
    join_code: str
    participant_count: int
