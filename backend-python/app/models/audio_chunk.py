"""Audio chunk database model."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class AudioChunk(Base):
    """Audio chunk metadata model."""
    
    __tablename__ = "audio_chunks"
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    segment_id: Mapped[UUID] = mapped_column(ForeignKey("segments.id"), index=True)
    chunk_index: Mapped[int] = mapped_column(Integer)  # 0, 1, 2, ...
    storage_path: Mapped[str] = mapped_column(String(500))  # MinIO path
    duration_seconds: Mapped[float | None] = mapped_column(nullable=True)
    file_size_bytes: Mapped[int] = mapped_column(Integer)
    is_finalized: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

