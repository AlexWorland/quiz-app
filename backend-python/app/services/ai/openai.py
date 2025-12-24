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

    async def generate_fake_answers(
        self,
        question: str,
        correct_answer: str,
        num_fakes: int = 3,
    ) -> list[str]:
        """Generate plausible fake answers."""
        response = await self.client.chat.completions.create(
            model="gpt-4",
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
            model="gpt-4",
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
