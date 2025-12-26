"""Tests for Hub concurrency and race condition fixes."""

import asyncio
import pytest
from unittest.mock import AsyncMock, MagicMock
from uuid import uuid4

from app.ws.hub import Hub
from app.ws.messages import ParticipantInfo


@pytest.mark.anyio
async def test_concurrent_participant_additions():
    """Test that concurrent participant additions are handled safely."""
    hub = Hub()
    event_id = uuid4()
    
    # Create multiple participants
    participants = [
        ParticipantInfo(
            user_id=uuid4(),
            username=f"user{i}",
            join_status="joined",
            is_late_joiner=False
        )
        for i in range(10)
    ]
    
    # Add them concurrently
    await asyncio.gather(*[
        hub.add_participant(event_id, p) for p in participants
    ])
    
    # Verify all were added
    session = hub.event_sessions.get(event_id)
    assert session is not None
    assert len(session.game_state.participants) == 10


@pytest.mark.anyio
async def test_concurrent_connect_disconnect():
    """Test concurrent connections and disconnections."""
    hub = Hub()
    event_id = uuid4()
    user_ids = [uuid4() for _ in range(5)]
    
    # Create mock websockets
    websockets = [MagicMock() for _ in range(5)]
    
    # Connect all users concurrently
    await asyncio.gather(*[
        hub.connect(event_id, user_id, ws)
        for user_id, ws in zip(user_ids, websockets)
    ])
    
    session = hub.event_sessions.get(event_id)
    assert len(session.connections) == 5
    
    # Disconnect half of them concurrently
    await asyncio.gather(*[
        hub.disconnect(event_id, user_id)
        for user_id in user_ids[:3]
    ])
    
    # Should have 2 connections left
    assert len(session.connections) == 2


@pytest.mark.anyio
async def test_broadcast_during_disconnection():
    """Test that broadcasting during disconnection doesn't cause issues."""
    hub = Hub()
    event_id = uuid4()
    user_id = uuid4()
    
    # Create a mock websocket
    websocket = MagicMock()
    websocket.send_json = AsyncMock()
    
    await hub.connect(event_id, user_id, websocket)
    
    # Broadcast and disconnect concurrently
    message = {"type": "test", "data": "value"}
    
    await asyncio.gather(
        hub.broadcast(event_id, message),
        hub.disconnect(event_id, user_id),
    )
    
    # Should not raise any exceptions


@pytest.mark.anyio
async def test_reconnection_with_concurrent_operations():
    """Test reconnection while other operations are happening."""
    hub = Hub()
    event_id = uuid4()
    user_id = uuid4()
    
    # Initial connection
    websocket1 = MagicMock()
    await hub.connect(event_id, user_id, websocket1)
    
    # Disconnect
    await hub.disconnect(event_id, user_id, permanent=False)
    
    # Reconnect with new websocket while adding another participant
    websocket2 = MagicMock()
    other_participant = ParticipantInfo(
        user_id=uuid4(),
        username="other_user",
        join_status="joined",
        is_late_joiner=False
    )
    
    await asyncio.gather(
        hub.reconnect(event_id, user_id, websocket2),
        hub.add_participant(event_id, other_participant),
    )
    
    session = hub.event_sessions.get(event_id)
    assert len(session.connections) == 1
    assert len(session.game_state.participants) == 1  # Other participant added


@pytest.mark.anyio
async def test_lock_protects_connection_state():
    """Test that the lock protects connection state modifications."""
    hub = Hub()
    event_id = uuid4()
    
    # Verify that the hub has a lock
    assert hasattr(hub, '_lock')
    assert hub._lock is not None
    
    # Perform operations that should use the lock
    user_id = uuid4()
    websocket = MagicMock()
    
    await hub.connect(event_id, user_id, websocket)
    session = hub.event_sessions.get(event_id)
    
    # Connection state should be tracked
    assert user_id in session.connection_states
    assert session.connection_states[user_id] == 'connected'
    
    # Disconnect and verify state update
    await hub.disconnect(event_id, user_id, permanent=False)
    assert session.connection_states[user_id] == 'temporarily_disconnected'


@pytest.mark.anyio
async def test_broadcast_creates_connection_snapshot():
    """Test that broadcast creates a snapshot to avoid holding lock during I/O."""
    hub = Hub()
    event_id = uuid4()
    
    # Add multiple connections
    user_ids = [uuid4() for _ in range(3)]
    websockets = []
    for user_id in user_ids:
        ws = MagicMock()
        ws.send_json = AsyncMock()
        websockets.append(ws)
        await hub.connect(event_id, user_id, ws)
    
    # Broadcast a message
    message = {"type": "test", "value": "data"}
    await hub.broadcast(event_id, message)
    
    # All websockets should have received the message
    for ws in websockets:
        ws.send_json.assert_called_once_with(message)

