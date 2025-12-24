"""WebSocket heartbeat management for connection tracking."""

import asyncio
from datetime import datetime, timezone
from typing import TYPE_CHECKING
from uuid import UUID

if TYPE_CHECKING:
    from fastapi import WebSocket

# Heartbeat configuration
HEARTBEAT_INTERVAL = 15  # Send ping every 15 seconds
GRACE_PERIOD = 30  # Mark offline after 30 seconds without pong
CLEANUP_INTERVAL = 60  # Clean up stale connections every 60 seconds


class HeartbeatManager:
    """Manages WebSocket heartbeats for connection tracking."""

    def __init__(self):
        self._active_heartbeats: dict[UUID, datetime] = {}
        self._heartbeat_tasks: dict[UUID, asyncio.Task] = {}

    async def start_heartbeat(
        self,
        participant_id: UUID,
        websocket: "WebSocket",
    ) -> None:
        """
        Start sending heartbeat pings to a WebSocket connection.
        
        Args:
            participant_id: Unique participant identifier
            websocket: WebSocket connection to ping
        """
        self._active_heartbeats[participant_id] = datetime.now(timezone.utc)
        
        async def heartbeat_loop():
            try:
                while True:
                    await asyncio.sleep(HEARTBEAT_INTERVAL)
                    await websocket.send_json({"type": "ping"})
            except (asyncio.CancelledError, Exception):
                # Heartbeat stopped or connection closed
                pass

        task = asyncio.create_task(heartbeat_loop())
        self._heartbeat_tasks[participant_id] = task

    def record_pong(self, participant_id: UUID) -> None:
        """
        Record that a pong was received from a participant.
        
        Args:
            participant_id: Participant who sent the pong
        """
        self._active_heartbeats[participant_id] = datetime.now(timezone.utc)

    def stop_heartbeat(self, participant_id: UUID) -> None:
        """
        Stop heartbeat tracking for a participant.
        
        Args:
            participant_id: Participant to stop tracking
        """
        if participant_id in self._heartbeat_tasks:
            self._heartbeat_tasks[participant_id].cancel()
            del self._heartbeat_tasks[participant_id]
        
        self._active_heartbeats.pop(participant_id, None)

    def get_last_heartbeat(self, participant_id: UUID) -> datetime | None:
        """
        Get the last heartbeat time for a participant.
        
        Args:
            participant_id: Participant to check
            
        Returns:
            Last heartbeat timestamp or None if not tracked
        """
        return self._active_heartbeats.get(participant_id)

    def is_connection_healthy(self, participant_id: UUID) -> bool:
        """
        Check if a connection is healthy (received pong within grace period).
        
        Args:
            participant_id: Participant to check
            
        Returns:
            True if connection is healthy, False otherwise
        """
        last_heartbeat = self.get_last_heartbeat(participant_id)
        if not last_heartbeat:
            return False
        
        time_since_heartbeat = (datetime.now(timezone.utc) - last_heartbeat).total_seconds()
        return time_since_heartbeat <= GRACE_PERIOD

    async def cleanup_stale_connections(self) -> list[UUID]:
        """
        Find and return participants with stale connections.
        
        Returns:
            List of participant IDs with stale connections
        """
        stale_participants = []
        now = datetime.now(timezone.utc)
        
        for participant_id, last_heartbeat in list(self._active_heartbeats.items()):
            time_since_heartbeat = (now - last_heartbeat).total_seconds()
            if time_since_heartbeat > GRACE_PERIOD:
                stale_participants.append(participant_id)
        
        return stale_participants


# Global heartbeat manager instance
heartbeat_manager = HeartbeatManager()

