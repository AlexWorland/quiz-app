"""AI provider base protocol."""

from dataclasses import dataclass
from typing import Protocol


@dataclass
class GeneratedQuestion:
    """A generated question with fake answers."""

    question_text: str
    correct_answer: str
    fake_answers: list[str]
    source_transcript: str


@dataclass
class QualityAssessment:
    """Quality assessment for a generated question."""

    clarity_score: float  # 0-1
    answerability_score: float  # 0-1
    factual_accuracy_score: float  # 0-1
    overall_score: float  # Average of above
    issues: list[str]


class AIProvider(Protocol):
    """Protocol for AI providers."""

    async def generate_fake_answers(
        self,
        question: str,
        correct_answer: str,
        num_fakes: int = 3,
    ) -> list[str]:
        """Generate fake answers for a question."""
        ...

    async def analyze_and_generate_question(
        self,
        transcript: str,
        previous_transcript: str | None = None,
        existing_questions: list[str] | None = None,
    ) -> GeneratedQuestion | None:
        """Analyze transcript and generate a question if appropriate."""
        ...

    async def evaluate_question_quality(
        self,
        question: str,
        correct_answer: str,
        source_transcript: str | None = None,
    ) -> QualityAssessment | None:
        """Evaluate the quality of a generated question."""
        ...
