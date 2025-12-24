"""Tests for duplicate name handling."""

import pytest
from httpx import AsyncClient

from app.models import Event


@pytest.mark.asyncio
async def test_first_participant_keeps_original_name(
    client: AsyncClient, test_event: Event
):
    """First participant should keep their original display name."""
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "Alex",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "Alex"


@pytest.mark.asyncio
async def test_duplicate_name_gets_number_2(
    client: AsyncClient, test_event: Event
):
    """Second participant with same name should get " 2" appended."""
    # First participant
    await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "Alex",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    # Second participant with same name
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-2",
            "display_name": "Alex",
            "avatar_url": "😁",
            "avatar_type": "emoji",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "Alex 2"


@pytest.mark.asyncio
async def test_multiple_duplicates_increment_correctly(
    client: AsyncClient, test_event: Event
):
    """Multiple duplicates should get sequential numbers."""
    # Create 5 participants with same base name
    for i in range(5):
        response = await client.post(
            "/api/events/join",
            json={
                "code": test_event.join_code,
                "device_fingerprint": f"device-{i}",
                "display_name": "Jordan",
                "avatar_url": "😀",
                "avatar_type": "emoji",
            },
        )
        assert response.status_code == 200

        data = response.json()
        if i == 0:
            assert data["displayName"] == "Jordan"
        else:
            assert data["displayName"] == f"Jordan {i + 1}"


@pytest.mark.asyncio
async def test_whitespace_trimmed_before_duplicate_check(
    client: AsyncClient, test_event: Event
):
    """Leading/trailing whitespace should be trimmed before checking duplicates."""
    # First participant
    await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "Sam",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    # Second participant with whitespace
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-2",
            "display_name": "  Sam  ",
            "avatar_url": "😁",
            "avatar_type": "emoji",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "Sam 2"


@pytest.mark.asyncio
async def test_rejoining_participant_keeps_original_name(
    client: AsyncClient, test_event: Event
):
    """Rejoining participant should keep their original display name."""
    # Initial join
    first_response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "Taylor",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )
    assert first_response.status_code == 200
    assert first_response.json()["displayName"] == "Taylor"

    # Rejoin with same device
    rejoin_response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "DifferentName",  # Should be ignored
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    assert rejoin_response.status_code == 200
    data = rejoin_response.json()
    assert data["isRejoining"] is True
    assert data["displayName"] == "Taylor"  # Original name preserved


@pytest.mark.asyncio
async def test_case_sensitive_duplicate_check(
    client: AsyncClient, test_event: Event
):
    """Duplicate check should be case-sensitive."""
    # First participant
    await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "alex",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    # Second participant with different case - should be treated as different
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-2",
            "display_name": "Alex",
            "avatar_url": "😁",
            "avatar_type": "emoji",
        },
    )

    assert response.status_code == 200
    data = response.json()
    # Different case = different name, no numbering
    assert data["displayName"] == "Alex"


@pytest.mark.asyncio
async def test_special_characters_in_names(
    client: AsyncClient, test_event: Event
):
    """Names with special characters should handle duplicates correctly."""
    # First participant
    await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-1",
            "display_name": "José",
            "avatar_url": "😀",
            "avatar_type": "emoji",
        },
    )

    # Second participant with same name
    response = await client.post(
        "/api/events/join",
        json={
            "code": test_event.join_code,
            "device_fingerprint": "device-2",
            "display_name": "José",
            "avatar_url": "😁",
            "avatar_type": "emoji",
        },
    )

    assert response.status_code == 200
    data = response.json()
    assert data["displayName"] == "José 2"
