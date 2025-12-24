"""Join queue service for handling simultaneous join attempts."""

import asyncio
from collections import defaultdict
from datetime import datetime, timezone
from typing import Callable, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession


class JoinQueue:
    """Queue manager for sequential processing of simultaneous join attempts."""

    def __init__(self):
        # Event ID -> asyncio.Lock
        self._event_locks: dict[UUID, asyncio.Lock] = {}
        # Event ID -> list of (device_id, timestamp) for tracking
        self._active_joins: dict[UUID, list[tuple[UUID, datetime]]] = defaultdict(list)
    
    def _get_lock(self, event_id: UUID) -> asyncio.Lock:
        """Get or create a lock for an event."""
        if event_id not in self._event_locks:
            self._event_locks[event_id] = asyncio.Lock()
        return self._event_locks[event_id]
    
    async def enqueue_join(
        self,
        event_id: UUID,
        device_id: UUID,
        join_fn: Callable[[AsyncSession], Any],
        db: AsyncSession,
    ) -> Any:
        """
        Enqueue a join attempt and execute it sequentially.
        
        Args:
            event_id: The event being joined
            device_id: The device attempting to join
            join_fn: Async function to execute the join logic
            db: Database session
            
        Returns:
            Result from join_fn
        """
        lock = self._get_lock(event_id)
        join_time = datetime.now(timezone.utc)
        
        # Track this join attempt
        self._active_joins[event_id].append((device_id, join_time))
        
        try:
            async with lock:
                # Execute the join function within the lock
                result = await join_fn(db)
                return result
        finally:
            # Remove from active joins
            self._active_joins[event_id] = [
                (dev_id, ts) for dev_id, ts in self._active_joins[event_id]
                if dev_id != device_id
            ]
            
            # Clean up empty locks
            if not self._active_joins[event_id]:
                self._active_joins.pop(event_id, None)
                if event_id in self._event_locks:
                    # Don't remove the lock itself as it may be in use
                    pass
    
    def get_queue_size(self, event_id: UUID) -> int:
        """Get the current queue size for an event."""
        return len(self._active_joins.get(event_id, []))
    
    def is_device_queued(self, event_id: UUID, device_id: UUID) -> bool:
        """Check if a device is currently queued for an event."""
        return any(
            dev_id == device_id
            for dev_id, _ in self._active_joins.get(event_id, [])
        )


# Global join queue instance
join_queue = JoinQueue()

