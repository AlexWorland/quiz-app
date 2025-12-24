"""Event and Segment database models."""

from datetime import datetime
from enum import Enum
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class EventMode(str, Enum):
    """Event modes."""

    LISTEN_ONLY = "listen_only"
    NORMAL = "normal"


class EventStatus(str, Enum):
    """Event statuses."""

    WAITING = "waiting"
    ACTIVE = "active"
    FINISHED = "finished"


class SegmentStatus(str, Enum):
    """Segment statuses."""

    PENDING = "pending"
    RECORDING = "recording"
    RECORDING_PAUSED = "recording_paused"
    QUIZ_READY = "quiz_ready"
    QUIZZING = "quizzing"
    COMPLETED = "completed"


class Event(Base):
    """Event database model."""

    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    host_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    join_code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    mode: Mapped[str] = mapped_column(String(50), default=EventMode.LISTEN_ONLY.value)
    status: Mapped[str] = mapped_column(String(50), default=EventStatus.WAITING.value)
    num_fake_answers: Mapped[int] = mapped_column(Integer, default=3)
    time_per_question: Mapped[int] = mapped_column(Integer, default=30)
    question_gen_interval_seconds: Mapped[int | None] = mapped_column(Integer, nullable=True)
    join_locked: Mapped[bool] = mapped_column(Boolean, default=False)
    join_locked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    segments: Mapped[list["Segment"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )
    participants: Mapped[list["EventParticipant"]] = relationship(
        back_populates="event", cascade="all, delete-orphan"
    )


class Segment(Base):
    """Segment database model."""

    __tablename__ = "segments"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("events.id"), index=True)
    presenter_name: Mapped[str] = mapped_column(String(255))
    presenter_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    status: Mapped[str] = mapped_column(String(50), default=SegmentStatus.PENDING.value)
    recording_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recording_ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    quiz_started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    previous_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    event: Mapped["Event"] = relationship(back_populates="segments")
    questions: Mapped[list["Question"]] = relationship(
        back_populates="segment", cascade="all, delete-orphan"
    )


# Import at the bottom to avoid circular imports
from app.models.participant import EventParticipant  # noqa: E402, F401
from app.models.question import Question  # noqa: E402, F401
