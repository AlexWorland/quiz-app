"""Tests for Whisper transcription service."""
import pytest
from unittest.mock import AsyncMock, patch

from app.services.transcription import WhisperTranscriptionService


@pytest.mark.anyio
async def test_whisper_transcribe_success():
    """Test successful transcription."""
    service = WhisperTranscriptionService()
    
    with patch.object(service.client.audio.transcriptions, 'create', 
                     new_callable=AsyncMock) as mock_create:
        mock_create.return_value = "This is a test transcript"
        
        result = await service.transcribe_audio(
            b"fake audio data",
            filename="test.webm"
        )
        
        assert result == "This is a test transcript"
        mock_create.assert_called_once()


@pytest.mark.anyio
async def test_whisper_empty_audio_fails():
    """Test that empty audio raises error."""
    service = WhisperTranscriptionService()
    
    with pytest.raises(ValueError, match="Empty audio"):
        await service.transcribe_audio(b"", filename="test.webm")


@pytest.mark.anyio
async def test_whisper_sets_correct_parameters():
    """Test that Whisper API is called with correct parameters."""
    service = WhisperTranscriptionService()
    
    with patch.object(service.client.audio.transcriptions, 'create',
                     new_callable=AsyncMock) as mock_create:
        mock_create.return_value = "Transcribed text"
        
        await service.transcribe_audio(
            b"audio data here",
            filename="recording.webm"
        )
        
        call_args = mock_create.call_args
        assert call_args.kwargs['model'] == "whisper-1"
        assert call_args.kwargs['response_format'] == "text"
        assert call_args.kwargs['language'] == "en"

