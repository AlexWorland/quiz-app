"""OpenAI AI provider using official SDK."""

import json

from openai import AsyncOpenAI

from app.config import get_settings
from app.services.ai.base import GeneratedQuestion, QualityAssessment

settings = get_settings()


class OpenAIProvider:
    """OpenAI AI provider."""

    def __init__(self, api_key: str | None = None):
        self.client = AsyncOpenAI(api_key=api_key or settings.openai_api_key)
        self.model = settings.openai_model

    async def generate_fake_answers(
        self,
        question: str,
        correct_answer: str,
        num_fakes: int = 3,
    ) -> list[str]:
        """Generate plausible fake answers."""
        response = await self.client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": f"""Generate {num_fakes} plausible but incorrect answers.
Question: {question}
Correct Answer: {correct_answer}
Return JSON: {{"answers": ["fake1", "fake2", "fake3"]}}""",
                }
            ],
        )

        try:
            content = response.choices[0].message.content
            data = json.loads(content)
            return data.get("answers", [])[:num_fakes]
        except (json.JSONDecodeError, IndexError):
            return [f"Option {i+1}" for i in range(num_fakes)]

    async def analyze_and_generate_question(
        self,
        transcript: str,
        previous_transcript: str | None = None,
        existing_questions: list[str] | None = None,
    ) -> GeneratedQuestion | None:
        """Analyze transcript and generate a question."""
        if len(transcript) < 50:
            return None

        existing_str = "\n".join(existing_questions) if existing_questions else "None"

        response = await self.client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze transcript and generate quiz question.
Transcript: {transcript}
Existing questions: {existing_str}
Return JSON: {{"question": "...", "correct_answer": "...", "fake_answers": ["...", "...", "..."]}}
Or if no good question: {{"skip": true}}""",
                }
            ],
        )

        try:
            content = response.choices[0].message.content
            data = json.loads(content)
            if data.get("skip"):
                return None
            return GeneratedQuestion(
                question_text=data["question"],
                correct_answer=data["correct_answer"],
                fake_answers=data.get("fake_answers", []),
                source_transcript=transcript,
            )
        except (json.JSONDecodeError, KeyError):
            return None

    async def generate_questions_batch(
        self,
        transcript: str,
        num_questions: int = 5,
        existing_questions: list[str] | None = None,
    ) -> list[GeneratedQuestion]:
        """Generate multiple questions from transcript in a single API call.
        
        Uses GPT-5.2-thinking's reasoning capabilities to generate a coherent
        set of questions covering the entire transcript.
        
        Args:
            transcript: Full transcript text
            num_questions: Number of questions to generate
            existing_questions: Previously generated questions to avoid duplicates
            
        Returns:
            List of GeneratedQuestion objects
        """
        if len(transcript) < 50:
            return []
        
        existing_str = "\n".join(existing_questions) if existing_questions else "None"
        
        response = await self.client.chat.completions.create(
            model=self.model,
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": f"""Analyze this presentation transcript and generate exactly {num_questions} quiz questions.

Transcript:
{transcript}

Previously generated questions (avoid duplicates):
{existing_str}

Requirements:
- Generate exactly {num_questions} questions
- Questions should test factual knowledge and key concepts from the transcript
- Each question needs a correct answer and 3 plausible fake answers
- Questions should be diverse and cover different parts of the content
- Fake answers should be similar in style/length to correct answers
- Questions should be clear, unambiguous, and answerable from the transcript

Return JSON format:
{{
  "questions": [
    {{
      "question": "What is...?",
      "correct_answer": "The answer",
      "fake_answers": ["Wrong 1", "Wrong 2", "Wrong 3"]
    }},
    ...
  ]
}}

If the transcript doesn't contain enough content for {num_questions} questions, generate as many good questions as possible (minimum 1).""",
                }
            ],
            max_tokens=4096,
        )
        
        try:
            content = response.choices[0].message.content
            data = json.loads(content)
            questions_data = data.get("questions", [])
            
            return [
                GeneratedQuestion(
                    question_text=q["question"],
                    correct_answer=q["correct_answer"],
                    fake_answers=q.get("fake_answers", []),
                    source_transcript=transcript[:500],
                )
                for q in questions_data
            ]
        except (json.JSONDecodeError, KeyError) as e:
            # Log error but don't crash - return empty list to fallback to chunking
            import logging
            logging.error(f"Failed to parse batch question generation response: {e}")
            return []

    async def evaluate_question_quality(
        self,
        question: str,
        correct_answer: str,
        source_transcript: str | None = None,
    ) -> QualityAssessment | None:
        """Evaluate question quality."""
        response = await self.client.chat.completions.create(
            model="gpt-4o-mini",
            response_format={"type": "json_object"},
            messages=[
                {
                    "role": "user",
                    "content": f"""Evaluate quiz question quality (scores 0-1).
Question: {question}
Answer: {correct_answer}
Source: {source_transcript or 'N/A'}
Return: {{"clarity": 0.9, "answerability": 0.8, "factual_accuracy": 0.95, "issues": []}}""",
                }
            ],
        )

        try:
            content = response.choices[0].message.content
            data = json.loads(content)
            return QualityAssessment(
                clarity_score=data.get("clarity", 0.5),
                answerability_score=data.get("answerability", 0.5),
                factual_accuracy_score=data.get("factual_accuracy", 0.5),
                overall_score=(
                    data.get("clarity", 0.5)
                    + data.get("answerability", 0.5)
                    + data.get("factual_accuracy", 0.5)
                ) / 3,
                issues=data.get("issues", []),
            )
        except (json.JSONDecodeError, KeyError):
            return None
