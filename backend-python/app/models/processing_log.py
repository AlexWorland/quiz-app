"""Processing log model for host visibility."""
from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class ProcessingLog(Base):
    """Processing log entries for audio processing."""
    
    __tablename__ = "processing_logs"
    
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    segment_id: Mapped[UUID] = mapped_column(ForeignKey("segments.id"), index=True)
    stage: Mapped[str] = mapped_column(String(50))  # 'chunk_upload', 'combining', 'transcribing', 'generating'
    message: Mapped[str] = mapped_column(Text)
    level: Mapped[str] = mapped_column(String(20), default='info')  # 'info', 'warning', 'error'
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

