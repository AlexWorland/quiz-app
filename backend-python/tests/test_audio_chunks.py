"""Tests for chunked audio upload and combination."""
import pytest
from unittest.mock import AsyncMock, patch
from uuid import uuid4

from app.services.audio_combiner import AudioCombiner


def test_audio_combiner_raises_on_no_chunks():
    """Test that combiner raises error with no chunks."""
    combiner = AudioCombiner()
    
    with pytest.raises(ValueError, match="No chunks"):
        combiner.combine_chunks([])


def test_audio_combiner_raises_on_empty_list():
    """Test that combiner handles empty chunk list."""
    combiner = AudioCombiner()
    
    with pytest.raises(ValueError):
        combiner.combine_chunks([])


# Note: AudioStorageService and full combiner tests require MinIO running
# These would be integration tests rather than unit tests
# Keeping them simple for now since they interact with external services

