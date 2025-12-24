"""Tests for event join functionality including device enforcement."""

import pytest
from uuid import uuid4


@pytest.mark.anyio
async def test_join_event_success(client, test_event):
    """Test successful event join."""
    device_fingerprint = str(uuid4())
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["eventId"] == str(test_event.id)
    assert data["deviceId"] == device_fingerprint
    assert "sessionToken" in data
    assert data["displayName"] == "Test User"
    assert data["isRejoining"] == False


@pytest.mark.anyio
async def test_join_event_rejoin_same_device(client, test_event):
    """Test rejoining event with same device fingerprint."""
    device_fingerprint = str(uuid4())

    # First join
    response1 = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response1.status_code == 200
    first_token = response1.json()["sessionToken"]

    # Second join with same device
    response2 = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device_fingerprint,
            "display_name": "Different Name",  # Should be ignored
            "avatar_url": "🎉",
            "avatar_type": "emoji",
        },
    )
    assert response2.status_code == 200
    data = response2.json()
    assert data["isRejoining"] == True
    assert data["displayName"] == "Test User"  # Original name preserved
    assert data["deviceId"] == device_fingerprint


@pytest.mark.anyio
async def test_device_enforcement_blocks_multiple_events(client, test_session, test_user):
    """Test that single device cannot join multiple active events."""
    from app.models import Event

    # Create two events
    event1 = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Event 1",
        join_code="EVENT1",
        mode="normal",
        status="active",
        join_locked=False,
    )
    event2 = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Event 2",
        join_code="EVENT2",
        mode="normal",
        status="active",
        join_locked=False,
    )
    test_session.add_all([event1, event2])
    await test_session.commit()
    await test_session.refresh(event1)
    await test_session.refresh(event2)

    device_fingerprint = str(uuid4())

    # Join first event - should succeed
    response1 = await client.post(
        "/api/events/join",
        json={
            "code": "EVENT1",
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response1.status_code == 200

    # Try to join second event with same device - should fail
    response2 = await client.post(
        "/api/events/join",
        json={
            "code": "EVENT2",
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response2.status_code == 409
    error_data = response2.json()
    assert "already in another active event" in error_data["detail"]
    assert "Event 1" in error_data["detail"]


@pytest.mark.anyio
async def test_device_enforcement_allows_finished_events(client, test_session, test_user):
    """Test that device can join new event after previous event finished."""
    from app.models import Event

    # Create two events, first one finished
    event1 = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Finished Event",
        join_code="EVENT1",
        mode="normal",
        status="finished",  # Finished event
        join_locked=False,
    )
    event2 = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="New Event",
        join_code="EVENT2",
        mode="normal",
        status="active",  # Active event
        join_locked=False,
    )
    test_session.add_all([event1, event2])
    await test_session.commit()
    await test_session.refresh(event1)
    await test_session.refresh(event2)

    device_fingerprint = str(uuid4())

    # Join finished event
    response1 = await client.post(
        "/api/events/join",
        json={
            "code": "EVENT1",
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response1.status_code == 200

    # Join new event - should succeed since first event is finished
    response2 = await client.post(
        "/api/events/join",
        json={
            "code": "EVENT2",
            "device_fingerprint": device_fingerprint,
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response2.status_code == 200


@pytest.mark.anyio
async def test_join_event_not_found(client):
    """Test joining non-existent event."""
    response = await client.post(
        "/api/events/join",
        json={
            "code": "INVALID",
            "device_fingerprint": str(uuid4()),
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_join_locked_event(client, test_session, test_user):
    """Test joining event with join lock enabled."""
    from app.models import Event

    locked_event = Event(
        id=uuid4(),
        host_id=test_user.id,
        title="Locked Event",
        join_code="LOCKED",
        mode="normal",
        status="active",
        join_locked=True,  # Locked
    )
    test_session.add(locked_event)
    await test_session.commit()

    response = await client.post(
        "/api/events/join",
        json={
            "code": "LOCKED",
            "device_fingerprint": str(uuid4()),
            "display_name": "Test User",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response.status_code == 403
    assert "locked" in response.json()["detail"].lower()


@pytest.mark.anyio
async def test_unique_display_name_generation(client, test_event):
    """Test that duplicate display names get numbered suffixes."""
    device1 = str(uuid4())
    device2 = str(uuid4())
    device3 = str(uuid4())

    # First user with name "Alex"
    response1 = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device1,
            "display_name": "Alex",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert response1.status_code == 200
    assert response1.json()["displayName"] == "Alex"

    # Second user with name "Alex" should get "Alex 2"
    response2 = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device2,
            "display_name": "Alex",
            "avatar_url": "🎉",
            "avatar_type": "emoji",
        },
    )
    assert response2.status_code == 200
    assert response2.json()["displayName"] == "Alex 2"

    # Third user with name "Alex" should get "Alex 3"
    response3 = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": device3,
            "display_name": "Alex",
            "avatar_url": "🚀",
            "avatar_type": "emoji",
        },
    )
    assert response3.status_code == 200
    assert response3.json()["displayName"] == "Alex 3"
