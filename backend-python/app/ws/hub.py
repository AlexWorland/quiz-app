"""WebSocket Hub - manages connections and game state."""

import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Set
from uuid import UUID

from fastapi import WebSocket

from app.config import get_settings
from app.ws.messages import ParticipantInfo, QuizPhase
from app.ws.heartbeat import heartbeat_manager

settings = get_settings()


@dataclass
class GameState:
    """Game state for an event."""

    event_id: UUID
    current_segment_id: UUID | None = None
    current_presenter_id: UUID | None = None
    current_question_id: UUID | None = None
    current_question_index: int = 0
    question_started_at: datetime | None = None
    time_limit_seconds: int = 30
    quiz_phase: QuizPhase = QuizPhase.NOT_STARTED
    presenter_paused: bool = False
    presenter_pause_reason: str | None = None
    # Pending presenter - selected but not yet started presentation
    pending_presenter_id: UUID | None = None
    pending_presenter_name: str | None = None
    # Cached questions for the active segment; each entry contains id, text, and correct_answer.
    questions: list[dict[str, Any]] = field(default_factory=list)
    participants: dict[UUID, ParticipantInfo] = field(default_factory=dict)
    answers_received: dict[UUID, str] = field(default_factory=dict)
    total_questions: int = 0
    scored_question_ids: Set[UUID] = field(default_factory=set)


@dataclass
class EventSession:
    """An event's WebSocket session."""

    event_id: UUID
    connections: dict[UUID, WebSocket] = field(default_factory=dict)
    game_state: GameState = field(default_factory=lambda: GameState(event_id=UUID(int=0)))
    # Track participant connection states: 'connected', 'temporarily_disconnected', 'disconnected'
    connection_states: dict[UUID, str] = field(default_factory=dict)

    def __post_init__(self):
        self.game_state = GameState(event_id=self.event_id)


class Hub:
    """Central hub for managing WebSocket connections."""

    def __init__(self):
        self.event_sessions: dict[UUID, EventSession] = {}
        self._lock = asyncio.Lock()

    def _get_or_create_session_unsafe(self, event_id: UUID) -> EventSession:
        """Get or create an event session. Must be called with lock held."""
        if event_id not in self.event_sessions:
            self.event_sessions[event_id] = EventSession(event_id=event_id)
        return self.event_sessions[event_id]

    async def get_or_create_session(self, event_id: UUID) -> EventSession:
        """Get or create an event session."""
        async with self._lock:
            return self._get_or_create_session_unsafe(event_id)

    async def connect(
        self, event_id: UUID, user_id: UUID, websocket: WebSocket
    ) -> EventSession:
        """Connect a user to an event session."""
        async with self._lock:
            session = self._get_or_create_session_unsafe(event_id)
            session.connections[user_id] = websocket
            session.connection_states[user_id] = 'connected'
            
            # Start heartbeat tracking for this connection
            await heartbeat_manager.start_heartbeat(user_id, websocket)
            
            return session

    async def disconnect(self, event_id: UUID, user_id: UUID, permanent: bool = False) -> None:
        """
        Disconnect a user from an event session.
        
        Args:
            event_id: Event to disconnect from
            user_id: User to disconnect
            permanent: If True, mark as permanently disconnected. If False, mark as temporarily disconnected.
        """
        async with self._lock:
            if event_id in self.event_sessions:
                session = self.event_sessions[event_id]
                session.connections.pop(user_id, None)
                
                # Update connection state
                if permanent:
                    session.connection_states[user_id] = 'disconnected'
                else:
                    session.connection_states[user_id] = 'temporarily_disconnected'
                
                # Stop heartbeat tracking
                heartbeat_manager.stop_heartbeat(user_id)
                
                participant = session.game_state.participants.get(user_id)
                if participant:
                    participant.online = False

    async def add_participant(
        self, event_id: UUID, participant: ParticipantInfo
    ) -> None:
        """Add a participant to an event."""
        async with self._lock:
            session = self._get_or_create_session_unsafe(event_id)
            participant.online = True
            session.game_state.participants[participant.user_id] = participant

    async def broadcast(self, event_id: UUID, message: dict[str, Any]) -> None:
        """Broadcast a message to all connections in an event."""
        # Get connections to broadcast to (read operation, can be outside lock for better performance)
        if event_id not in self.event_sessions:
            return

        session = self.event_sessions[event_id]
        # Create a snapshot of connections to avoid holding lock during network I/O
        async with self._lock:
            connections = dict(session.connections.items())
        
        disconnected = []
        for user_id, websocket in connections.items():
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(user_id)

        # Handle disconnections (this acquires lock internally)
        for user_id in disconnected:
            await self.disconnect(event_id, user_id)

    async def broadcast_to_event(self, event_id: UUID, message: dict[str, Any]) -> None:
        """Alias for broadcast - broadcasts a message to all connections in an event."""
        await self.broadcast(event_id, message)

    async def send_to_user(
        self, event_id: UUID, user_id: UUID, message: dict[str, Any]
    ) -> None:
        """Send a message to a specific user."""
        if event_id not in self.event_sessions:
            return

        session = self.event_sessions[event_id]
        websocket = session.connections.get(user_id)
        if websocket:
            try:
                await websocket.send_json(message)
            except Exception:
                await self.disconnect(event_id, user_id)

    def get_game_state(self, event_id: UUID) -> GameState | None:
        """Get the game state for an event."""
        session = self.event_sessions.get(event_id)
        return session.game_state if session else None

    async def update_game_state(
        self, event_id: UUID, **updates: Any
    ) -> GameState | None:
        """Update the game state for an event."""
        session = self.event_sessions.get(event_id)
        if not session:
            return None

        for key, value in updates.items():
            if hasattr(session.game_state, key):
                setattr(session.game_state, key, value)

        return session.game_state

    async def record_answer(
        self, event_id: UUID, user_id: UUID, answer: str, submitted_at: datetime | None = None
    ) -> tuple[bool, str | None]:
        """Record a participant's answer.

        Returns:
            Tuple of (success: bool, error_reason: str | None)
            error_reason can be: 'duplicate', 'too_late', 'no_question', or None
        """
        session = self.event_sessions.get(event_id)
        if not session:
            return False, 'no_session'

        if session.game_state.presenter_paused:
            return False, 'paused'

        # Check if a question is active
        if not session.game_state.question_started_at:
            return False, 'no_question'

        # Late joiners cannot answer a question that started before they joined
        participant = session.game_state.participants.get(user_id)
        if participant and participant.joined_at and session.game_state.question_started_at:
            if participant.joined_at > session.game_state.question_started_at:
                return False, 'late_join'

        # Don't allow duplicate answers
        if user_id in session.game_state.answers_received:
            return False, 'duplicate'

        # Validate timing - answer must be submitted within time limit
        submission_time = submitted_at or datetime.now(timezone.utc)
        elapsed = (submission_time - session.game_state.question_started_at).total_seconds()
        elapsed_ms = int(elapsed * 1000)
        time_limit_ms = int(session.game_state.time_limit_seconds * 1000)
        grace_ms = max(settings.answer_timeout_grace_ms, 0)

        if elapsed_ms >= time_limit_ms + grace_ms:
            return False, 'too_late'

        session.game_state.answers_received[user_id] = answer
        return True, None

    async def clear_answers(self, event_id: UUID) -> None:
        """Clear all answers for the current question."""
        session = self.event_sessions.get(event_id)
        if session:
            session.game_state.answers_received.clear()

    def get_participant_count(self, event_id: UUID) -> int:
        """Get the number of connected participants in an event."""
        session = self.event_sessions.get(event_id)
        return len(session.connections) if session else 0

    def get_participant_info(self, event_id: UUID, user_id: UUID) -> ParticipantInfo | None:
        session = self.event_sessions.get(event_id)
        if not session:
            return None
        return session.game_state.participants.get(user_id)

    def get_answer_count(self, event_id: UUID) -> int:
        """Get the number of answers received for current question."""
        session = self.event_sessions.get(event_id)
        return len(session.game_state.answers_received) if session else 0

    def handle_pong(self, user_id: UUID) -> None:
        """
        Handle a pong message from a participant.
        
        Args:
            user_id: Participant who sent the pong
        """
        heartbeat_manager.record_pong(user_id)

    async def reconnect(self, event_id: UUID, user_id: UUID, websocket: WebSocket) -> EventSession:
        """
        Reconnect a participant who was temporarily disconnected.
        
        Args:
            event_id: Event to reconnect to
            user_id: User reconnecting
            websocket: New WebSocket connection
            
        Returns:
            The event session
        """
        async with self._lock:
            session = self._get_or_create_session_unsafe(event_id)
            session.connections[user_id] = websocket
            session.connection_states[user_id] = 'connected'
            
            # Restart heartbeat tracking
            await heartbeat_manager.start_heartbeat(user_id, websocket)
            
            # Mark participant as online
            participant = session.game_state.participants.get(user_id)
            if participant:
                participant.online = True
            
            return session

    async def cleanup_stale_connections(self) -> dict[UUID, list[UUID]]:
        """
        Find and mark stale connections as temporarily disconnected.
        
        Returns:
            Dictionary of event_id -> list of stale participant IDs
        """
        stale_by_event: dict[UUID, list[UUID]] = {}
        stale_participants = await heartbeat_manager.cleanup_stale_connections()
        
        for event_id, session in self.event_sessions.items():
            event_stale = []
            for participant_id in stale_participants:
                if participant_id in session.connections:
                    # Mark as temporarily disconnected
                    await self.disconnect(event_id, participant_id, permanent=False)
                    event_stale.append(participant_id)
            
            if event_stale:
                stale_by_event[event_id] = event_stale
        
        return stale_by_event

    def get_connection_state(self, event_id: UUID, user_id: UUID) -> str | None:
        """
        Get the connection state for a participant.
        
        Args:
            event_id: Event ID
            user_id: User ID
            
        Returns:
            Connection state ('connected', 'temporarily_disconnected', 'disconnected') or None
        """
        session = self.event_sessions.get(event_id)
        if not session:
            return None
        return session.connection_states.get(user_id)


# Global hub instance
hub = Hub()
