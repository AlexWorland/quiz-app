"""Claude AI provider using official Anthropic SDK."""

import json

from anthropic import AsyncAnthropic

from app.config import get_settings
from app.services.ai.base import GeneratedQuestion, QualityAssessment

settings = get_settings()


class ClaudeProvider:
    """Claude AI provider."""

    def __init__(self, api_key: str | None = None):
        self.client = AsyncAnthropic(api_key=api_key or settings.anthropic_api_key)

    async def generate_fake_answers(
        self,
        question: str,
        correct_answer: str,
        num_fakes: int = 3,
    ) -> list[str]:
        """Generate plausible fake answers."""
        prompt = f"""Generate {num_fakes} plausible but incorrect answers for this quiz question.
The answers should be similar in style and length to the correct answer.

Question: {question}
Correct Answer: {correct_answer}

Return ONLY a JSON array of fake answers, like: ["fake1", "fake2", "fake3"]"""

        response = await self.client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            content = response.content[0].text
            return json.loads(content)
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

        prompt = f"""Analyze this transcript and generate a quiz question if there's a clear fact or concept.

Transcript: {transcript}

Existing questions (avoid duplicates):
{existing_str}

If a good question can be generated, return JSON:
{{"question": "...", "correct_answer": "...", "fake_answers": ["...", "...", "..."]}}

If no good question can be made, return: {{"skip": true}}"""

        response = await self.client.messages.create(
            model="claude-3-sonnet-20240229",
            max_tokens=512,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            content = response.content[0].text
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
        prompt = f"""Evaluate this quiz question for quality.

Question: {question}
Correct Answer: {correct_answer}
Source: {source_transcript or 'N/A'}

Return JSON with scores 0-1:
{{"clarity": 0.9, "answerability": 0.8, "factual_accuracy": 0.95, "issues": []}}"""

        response = await self.client.messages.create(
            model="claude-3-5-haiku-20241022",
            max_tokens=256,
            messages=[{"role": "user", "content": prompt}],
        )

        try:
            content = response.content[0].text
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
