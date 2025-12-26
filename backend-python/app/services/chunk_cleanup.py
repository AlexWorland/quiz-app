"""Cleanup service for old audio chunks."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.audio_chunk import AudioChunk
from app.services.audio_storage import AudioStorageService


async def cleanup_old_chunks(db: AsyncSession, hours_old: int = 24) -> int:
    """Delete audio chunks older than specified hours.
    
    Args:
        db: Database session
        hours_old: Age threshold in hours (default 24)
        
    Returns:
        Number of chunks cleaned up
    """
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours_old)
    
    result = await db.execute(
        select(AudioChunk).where(
            AudioChunk.created_at < cutoff,
            AudioChunk.is_finalized == True
        )
    )
    old_chunks = result.scalars().all()
    
    if not old_chunks:
        return 0
    
    storage = AudioStorageService()
    deleted_count = 0
    
    for chunk in old_chunks:
        try:
            # Attempt to delete from MinIO
            # Note: This would need actual delete method in AudioStorageService
            # For now, just delete from database
            await db.delete(chunk)
            deleted_count += 1
        except Exception as e:
            # Log but continue with other chunks
            print(f"Failed to delete chunk {chunk.id}: {e}")
    
    await db.commit()
    return deleted_count

