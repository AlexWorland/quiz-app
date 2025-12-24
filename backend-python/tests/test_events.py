"""Event endpoint tests."""

import uuid

import pytest


async def create_test_user(client):
    """Helper to create a test user and return auth token."""
    username = f"testuser_{uuid.uuid4().hex[:8]}"
    response = await client.post(
        "/api/auth/register",
        json={"username": username, "password": "testpass123"},
    )
    return response.json()["token"]


@pytest.mark.anyio
async def test_list_events_unauthorized(client):
    """Test listing events without auth."""
    response = await client.get("/api/quizzes")
    assert response.status_code == 401


@pytest.mark.anyio
async def test_create_event(client):
    """Test creating an event."""
    token = await create_test_user(client)
    response = await client.post(
        "/api/quizzes",
        json={"title": "Test Quiz", "description": "A test quiz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["title"] == "Test Quiz"
    assert "join_code" in data
    assert len(data["join_code"]) == 6


@pytest.mark.anyio
async def test_list_events(client):
    """Test listing events for a user."""
    token = await create_test_user(client)

    # Create an event first
    await client.post(
        "/api/quizzes",
        json={"title": "My Quiz"},
        headers={"Authorization": f"Bearer {token}"},
    )

    # List events
    response = await client.get(
        "/api/quizzes",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["title"] == "My Quiz"


@pytest.mark.anyio
async def test_join_event_by_code(client):
    """Test joining an event by code."""
    token = await create_test_user(client)

    # Create an event
    create_response = await client.post(
        "/api/quizzes",
        json={"title": "Join Test Quiz"},
        headers={"Authorization": f"Bearer {token}"},
    )
    join_code = create_response.json()["join_code"]

    # Get event by code (public endpoint)
    response = await client.get(f"/api/events/join/{join_code}")
    assert response.status_code == 200
    assert response.json()["title"] == "Join Test Quiz"


@pytest.mark.anyio
async def test_join_event_invalid_code(client):
    """Test joining with invalid code."""
    response = await client.get("/api/events/join/INVALID")
    assert response.status_code == 404
