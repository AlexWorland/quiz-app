"""OpenAI Whisper transcription service."""
import io
from openai import AsyncOpenAI
from app.config import get_settings

settings = get_settings()


class WhisperTranscriptionService:
    """Service for transcribing audio using OpenAI Whisper API."""

    def __init__(self):
        if not settings.openai_api_key:
            raise ValueError("OPENAI_API_KEY not configured")
        self.client = AsyncOpenAI(api_key=settings.openai_api_key)
    
    async def transcribe_audio(
        self, 
        audio_data: bytes, 
        filename: str = "audio.webm"
    ) -> str:
        """Transcribe audio using OpenAI Whisper API.
        
        Args:
            audio_data: Raw audio bytes
            filename: Filename with extension (helps Whisper detect format)
            
        Returns:
            Transcribed text
            
        Raises:
            ValueError: If audio data is empty
            Exception: If transcription fails
        """
        if len(audio_data) == 0:
            raise ValueError("Empty audio data")
            
        audio_file = io.BytesIO(audio_data)
        audio_file.name = filename
        
        transcript = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text",
            language="en"  # Can be made configurable
        )
        
        return transcript

