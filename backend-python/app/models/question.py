"""Question and transcript database models."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Question(Base):
    """Question database model."""

    __tablename__ = "questions"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    segment_id: Mapped[UUID] = mapped_column(ForeignKey("segments.id"), index=True)
    question_text: Mapped[str] = mapped_column(Text)
    correct_answer: Mapped[str] = mapped_column(String(500))
    fake_answers: Mapped[list[str] | None] = mapped_column(JSONB, nullable=True)
    order_index: Mapped[int] = mapped_column(Integer, default=0)
    is_ai_generated: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    source_transcript: Mapped[str | None] = mapped_column(Text, nullable=True)
    quality_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    generated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    segment: Mapped["Segment"] = relationship(back_populates="questions")


class PresentationTranscript(Base):
    """Presentation transcript chunk database model."""

    __tablename__ = "presentation_transcripts"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    segment_id: Mapped[UUID] = mapped_column(ForeignKey("segments.id"), index=True)
    chunk_text: Mapped[str] = mapped_column(Text)
    chunk_index: Mapped[int] = mapped_column(Integer, default=0)
    timestamp_start: Mapped[float | None] = mapped_column(Float, nullable=True)
    timestamp_end: Mapped[float | None] = mapped_column(Float, nullable=True)
    created_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), server_default=func.now())


# Import at the bottom to avoid circular imports
from app.models.event import Segment  # noqa: E402, F401
