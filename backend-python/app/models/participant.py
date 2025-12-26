"""Event participant database model."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Integer, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class JoinStatus(str, Enum):
    """Participant join statuses."""

    JOINED = "joined"
    WAITING_FOR_SEGMENT = "waiting_for_segment"
    ACTIVE_IN_QUIZ = "active_in_quiz"
    SEGMENT_COMPLETE = "segment_complete"


class EventParticipant(Base):
    """Event participant database model."""

    __tablename__ = "event_participants"
    __table_args__ = (UniqueConstraint("event_id", "device_id", name="uq_event_device"),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("events.id"), index=True)
    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )  # Nullable for anonymous participants
    total_score: Mapped[int] = mapped_column(Integer, default=0)
    joined_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    display_name: Mapped[str] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    avatar_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    is_late_joiner: Mapped[bool] = mapped_column(Boolean, default=False)
    total_response_time_ms: Mapped[int] = mapped_column(BigInteger, default=0)
    device_id: Mapped[UUID] = mapped_column(index=True)
    session_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    join_timestamp: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_heartbeat: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    join_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    join_status: Mapped[str] = mapped_column(
        String(50), default=JoinStatus.JOINED.value
    )

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="participants")


class SegmentScore(Base):
    """Per-segment scoring for participants."""

    __tablename__ = "segment_scores"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    segment_id: Mapped[UUID] = mapped_column(ForeignKey("segments.id"), index=True)
    participant_id: Mapped[UUID] = mapped_column(
        ForeignKey("event_participants.id"), index=True
    )
    score: Mapped[int] = mapped_column(Integer, default=0)
    questions_answered: Mapped[int] = mapped_column(Integer, default=0)
    questions_correct: Mapped[int] = mapped_column(Integer, default=0)
    total_response_time_ms: Mapped[int] = mapped_column(BigInteger, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Import at the bottom to avoid circular imports
from app.models.event import Event  # noqa: E402, F401
