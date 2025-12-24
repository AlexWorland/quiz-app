"""Authentication endpoint tests."""

import uuid

import pytest


@pytest.mark.anyio
async def test_register_user(client):
    """Test user registration."""
    unique_username = f"testuser_{uuid.uuid4().hex[:8]}"
    response = await client.post(
        "/api/auth/register",
        json={
            "username": unique_username,
            "password": "testpass123",
            "avatar_url": "https://example.com/avatar.png",
            "avatar_type": "custom",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert "token" in data
    assert data["user"]["username"] == unique_username


@pytest.mark.anyio
async def test_register_missing_fields(client):
    """Test registration with missing required fields."""
    response = await client.post(
        "/api/auth/register",
        json={"username": "test"},  # Missing password
    )
    assert response.status_code == 422  # Validation error


@pytest.mark.anyio
async def test_login_missing_fields(client):
    """Test login with missing fields."""
    response = await client.post(
        "/api/auth/login",
        json={"username": "test"},  # Missing password
    )
    assert response.status_code == 422


@pytest.mark.anyio
async def test_get_me_unauthorized(client):
    """Test getting profile without auth."""
    response = await client.get("/api/auth/me")
    assert response.status_code == 401  # Unauthorized - no auth header
