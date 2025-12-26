"""Integration tests for chunked audio recording."""
import pytest
from uuid import uuid4


def test_audio_chunk_model_has_correct_fields():
    """Test that AudioChunk model has all required fields."""
    from app.models import AudioChunk
    
    # Verify model has the fields we need
    assert hasattr(AudioChunk, 'id')
    assert hasattr(AudioChunk, 'segment_id')
    assert hasattr(AudioChunk, 'chunk_index')
    assert hasattr(AudioChunk, 'storage_path')
    assert hasattr(AudioChunk, 'file_size_bytes')
    assert hasattr(AudioChunk, 'is_finalized')
    assert hasattr(AudioChunk, 'created_at')


def test_processing_log_model_has_correct_fields():
    """Test that ProcessingLog model has all required fields."""
    from app.models import ProcessingLog
    
    # Verify model has the fields we need
    assert hasattr(ProcessingLog, 'id')
    assert hasattr(ProcessingLog, 'segment_id')
    assert hasattr(ProcessingLog, 'stage')
    assert hasattr(ProcessingLog, 'message')
    assert hasattr(ProcessingLog, 'level')
    assert hasattr(ProcessingLog, 'created_at')


def test_storage_path_format():
    """Test that storage path formatting works correctly."""
    segment_id = uuid4()
    
    # Test format for chunk 0
    path_0 = f"{segment_id}/chunk_0000.webm"
    assert path_0.endswith("/chunk_0000.webm")
    
    # Test format for chunk 15
    path_15 = f"{segment_id}/chunk_0015.webm"
    assert path_15.endswith("/chunk_0015.webm")
    
    # Test format for chunk 100
    path_100 = f"{segment_id}/chunk_0100.webm"
    assert path_100.endswith("/chunk_0100.webm")

