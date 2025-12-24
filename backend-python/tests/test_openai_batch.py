"""Tests for OpenAI batch question generation."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from app.services.ai.openai import OpenAIProvider
from app.services.ai.base import GeneratedQuestion


@pytest.fixture
def openai_provider():
    """Create OpenAI provider with mocked API key."""
    with patch('app.services.ai.openai.settings') as mock_settings:
        mock_settings.openai_api_key = "test-key"
        mock_settings.openai_model = "gpt-5.2-thinking"
        return OpenAIProvider()


@pytest.mark.asyncio
async def test_generate_questions_batch_success(openai_provider):
    """Test successful batch question generation."""
    # Mock response
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = """
    {
        "questions": [
            {
                "question": "What is Python?",
                "correct_answer": "A programming language",
                "fake_answers": ["A snake", "A database", "An operating system"]
            },
            {
                "question": "What is FastAPI?",
                "correct_answer": "A Python web framework",
                "fake_answers": ["A database", "A testing tool", "A cloud service"]
            }
        ]
    }
    """
    
    openai_provider.client.chat.completions.create = AsyncMock(return_value=mock_response)
    
    # Call batch generation
    result = await openai_provider.generate_questions_batch(
        transcript="Python is a programming language. FastAPI is a web framework.",
        num_questions=2
    )
    
    # Assertions
    assert len(result) == 2
    assert isinstance(result[0], GeneratedQuestion)
    assert result[0].question_text == "What is Python?"
    assert result[0].correct_answer == "A programming language"
    assert len(result[0].fake_answers) == 3
    assert result[1].question_text == "What is FastAPI?"


@pytest.mark.asyncio
async def test_generate_questions_batch_short_transcript(openai_provider):
    """Test batch generation with short transcript returns empty list."""
    result = await openai_provider.generate_questions_batch(
        transcript="Short",
        num_questions=5
    )
    
    assert result == []


@pytest.mark.asyncio
async def test_generate_questions_batch_parse_error(openai_provider):
    """Test batch generation handles JSON parse errors gracefully."""
    # Mock response with invalid JSON
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = "Invalid JSON"
    
    openai_provider.client.chat.completions.create = AsyncMock(return_value=mock_response)
    
    # Call batch generation
    result = await openai_provider.generate_questions_batch(
        transcript="This is a valid transcript with enough content to generate questions.",
        num_questions=3
    )
    
    # Should return empty list on error
    assert result == []


@pytest.mark.asyncio
async def test_generate_questions_batch_uses_configured_model(openai_provider):
    """Test that batch generation uses the configured model."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"questions": []}'
    
    mock_create = AsyncMock(return_value=mock_response)
    openai_provider.client.chat.completions.create = mock_create
    
    # Use a longer transcript to ensure the method is called
    await openai_provider.generate_questions_batch(
        transcript="Test transcript for model verification with enough content to pass the length check.",
        num_questions=2
    )
    
    # Verify the model parameter
    assert mock_create.called
    call_args = mock_create.call_args
    assert call_args[1]['model'] == "gpt-5.2-thinking"


@pytest.mark.asyncio
async def test_generate_questions_batch_respects_num_questions(openai_provider):
    """Test that batch generation requests the correct number of questions."""
    mock_response = MagicMock()
    mock_response.choices = [MagicMock()]
    mock_response.choices[0].message.content = '{"questions": []}'
    
    mock_create = AsyncMock(return_value=mock_response)
    openai_provider.client.chat.completions.create = mock_create
    
    num_questions = 7
    # Use a longer transcript to ensure the method is called
    await openai_provider.generate_questions_batch(
        transcript="Long transcript for testing question count with enough content to pass validation.",
        num_questions=num_questions
    )
    
    # Verify the prompt includes the requested number
    assert mock_create.called
    call_args = mock_create.call_args
    prompt = call_args[1]['messages'][0]['content']
    assert f"exactly {num_questions} quiz questions" in prompt

