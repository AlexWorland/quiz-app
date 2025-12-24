"""Tests for the question generation helper function."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4
from app.routes.segments import _generate_questions_for_transcript
from app.models import Event, Question
from app.services.ai.base import GeneratedQuestion


@pytest.fixture
def mock_event():
    """Create a mock event with questions_to_generate setting."""
    event = MagicMock(spec=Event)
    event.questions_to_generate = 5
    return event


@pytest.fixture
def mock_settings():
    """Create mock settings."""
    settings = MagicMock()
    settings.default_ai_provider = "openai"
    return settings


@pytest.fixture
def mock_db():
    """Create mock database session."""
    return AsyncMock()


@pytest.mark.asyncio
async def test_generate_questions_batch_mode(mock_db, mock_event, mock_settings):
    """Test question generation using batch mode (OpenAI)."""
    segment_id = uuid4()
    transcript = "This is a test transcript about Python programming and web development."
    
    # Mock the OpenAI provider's batch generation method
    mock_questions = [
        GeneratedQuestion(
            question_text=f"Question {i}?",
            correct_answer=f"Answer {i}",
            fake_answers=[f"Fake {i}a", f"Fake {i}b", f"Fake {i}c"],
            source_transcript=transcript[:500]
        )
        for i in range(5)
    ]
    
    with patch('app.services.ai.OpenAIProvider') as MockProvider:
        mock_provider_instance = MockProvider.return_value
        mock_provider_instance.generate_questions_batch = AsyncMock(return_value=mock_questions)
        
        # Call the helper function
        result = await _generate_questions_for_transcript(
            db=mock_db,
            segment_id=segment_id,
            transcript_text=transcript,
            event=mock_event,
            settings=mock_settings
        )
    
    # Assertions
    assert len(result) == 5
    assert all(isinstance(q, Question) for q in result)
    assert result[0].question_text == "Question 0?"
    assert result[0].is_ai_generated is True
    assert result[0].segment_id == segment_id
    
    # Verify batch method was called
    mock_provider_instance.generate_questions_batch.assert_called_once_with(
        transcript=transcript,
        num_questions=5,
        existing_questions=[]
    )


@pytest.mark.asyncio
async def test_generate_questions_fallback_to_chunking(mock_db, mock_event, mock_settings):
    """Test fallback to chunking mode when batch returns empty."""
    segment_id = uuid4()
    transcript = "This is a test transcript about Python programming."
    
    # Mock batch generation returning empty (simulating failure)
    mock_question_from_chunk = GeneratedQuestion(
        question_text="What is Python?",
        correct_answer="A programming language",
        fake_answers=["A snake", "A database", "An OS"],
        source_transcript=transcript[:500]
    )
    
    with patch('app.services.ai.OpenAIProvider') as MockProvider:
        mock_provider_instance = MockProvider.return_value
        mock_provider_instance.generate_questions_batch = AsyncMock(return_value=[])
        mock_provider_instance.analyze_and_generate_question = AsyncMock(return_value=mock_question_from_chunk)
        
        # Call the helper function
        result = await _generate_questions_for_transcript(
            db=mock_db,
            segment_id=segment_id,
            transcript_text=transcript,
            event=mock_event,
            settings=mock_settings
        )
    
    # Assertions - should have fallen back to chunking
    assert len(result) > 0
    assert result[0].question_text == "What is Python?"
    
    # Verify chunking method was called as fallback
    assert mock_provider_instance.analyze_and_generate_question.called


@pytest.mark.asyncio
async def test_generate_questions_claude_uses_chunking(mock_db, mock_event):
    """Test that Claude provider uses chunking mode (no batch method)."""
    segment_id = uuid4()
    transcript = "This is a test transcript."
    
    # Configure settings for Claude
    settings = MagicMock()
    settings.default_ai_provider = "claude"
    
    mock_question = GeneratedQuestion(
        question_text="Test question?",
        correct_answer="Test answer",
        fake_answers=["Fake 1", "Fake 2", "Fake 3"],
        source_transcript=transcript[:500]
    )
    
    with patch('app.services.ai.ClaudeProvider') as MockProvider:
        mock_provider_instance = MockProvider.return_value
        mock_provider_instance.analyze_and_generate_question = AsyncMock(return_value=mock_question)
        
        # Call the helper function
        result = await _generate_questions_for_transcript(
            db=mock_db,
            segment_id=segment_id,
            transcript_text=transcript,
            event=mock_event,
            settings=settings
        )
    
    # Assertions
    assert len(result) > 0
    assert result[0].question_text == "Test question?"
    
    # Verify chunking method was called (not batch)
    assert mock_provider_instance.analyze_and_generate_question.called


@pytest.mark.asyncio
async def test_generate_questions_respects_event_setting(mock_db, mock_settings):
    """Test that the helper respects the event's questions_to_generate setting."""
    segment_id = uuid4()
    transcript = "Test transcript."
    
    # Create event with custom question count
    event = MagicMock(spec=Event)
    event.questions_to_generate = 10
    
    mock_questions = [
        GeneratedQuestion(
            question_text=f"Q{i}",
            correct_answer=f"A{i}",
            fake_answers=[f"F{i}1", f"F{i}2", f"F{i}3"],
            source_transcript=transcript[:500]
        )
        for i in range(10)
    ]
    
    with patch('app.services.ai.OpenAIProvider') as MockProvider:
        mock_provider_instance = MockProvider.return_value
        mock_provider_instance.generate_questions_batch = AsyncMock(return_value=mock_questions)
        
        result = await _generate_questions_for_transcript(
            db=mock_db,
            segment_id=segment_id,
            transcript_text=transcript,
            event=event,
            settings=mock_settings
        )
    
    # Verify the correct number was requested
    mock_provider_instance.generate_questions_batch.assert_called_once_with(
        transcript=transcript,
        num_questions=10,
        existing_questions=[]
    )
    assert len(result) == 10

