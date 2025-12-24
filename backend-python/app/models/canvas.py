"""Canvas stroke database model."""

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class CanvasStroke(Base):
    """Canvas stroke database model."""

    __tablename__ = "canvas_strokes"

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    event_id: Mapped[UUID] = mapped_column(ForeignKey("events.id"), index=True)
    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"))
    stroke_data: Mapped[dict] = mapped_column(JSONB)  # Contains points, color, width
    stroke_order: Mapped[int] = mapped_column(Integer, default=0)
    color: Mapped[str | None] = mapped_column(String(50), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
