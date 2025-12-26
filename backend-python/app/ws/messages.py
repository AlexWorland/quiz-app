"""WebSocket message type definitions."""

from datetime import datetime
from enum import Enum
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, Field


class QuizPhase(str, Enum):
    """Quiz phase states."""

    NOT_STARTED = "not_started"
    SHOWING_QUESTION = "showing_question"
    REVEALING_ANSWER = "revealing_answer"
    SHOWING_LEADERBOARD = "showing_leaderboard"
    BETWEEN_QUESTIONS = "between_questions"
    SEGMENT_COMPLETE = "segment_complete"
    MEGA_QUIZ_READY = "mega_quiz_ready"
    MEGA_QUIZ = "mega_quiz"
    EVENT_COMPLETE = "event_complete"
    PRESENTER_PAUSED = "presenter_paused"


# Client -> Server messages
class JoinMessage(BaseModel):
    type: str = "join"
    user_id: UUID
    session_code: str


class AnswerMessage(BaseModel):
    type: str = "answer"
    question_id: UUID
    selected_answer: str
    response_time_ms: int


class StartGameMessage(BaseModel):
    type: str = "start_game"


class NextQuestionMessage(BaseModel):
    type: str = "next_question"


class RevealAnswerMessage(BaseModel):
    type: str = "reveal_answer"


class ShowLeaderboardMessage(BaseModel):
    type: str = "show_leaderboard"


class EndGameMessage(BaseModel):
    type: str = "end_game"


class PassPresenterMessage(BaseModel):
    type: str = "pass_presenter"
    next_presenter_user_id: UUID


class StartMegaQuizMessage(BaseModel):
    type: str = "start_mega_quiz"
    question_count: int | None = None


class SkipMegaQuizMessage(BaseModel):
    type: str = "skip_mega_quiz"


class AdminSelectPresenterMessage(BaseModel):
    type: str = "admin_select_presenter"
    presenter_user_id: UUID
    segment_id: UUID


class SelectPresenterMessage(BaseModel):
    """Host or current presenter selects the next presenter."""
    type: str = "select_presenter"
    presenter_user_id: UUID


class StartPresentationMessage(BaseModel):
    """Presenter starts their presentation (creates segment + starts recording)."""
    type: str = "start_presentation"
    title: str | None = None


class ResumeSegmentMessage(BaseModel):
    """Resume an existing segment."""
    type: str = "resume_segment"
    segment_id: UUID


# Server -> Client messages
class ParticipantInfo(BaseModel):
    user_id: UUID
    username: str
    avatar_url: str | None = None
    join_status: str | None = None
    is_late_joiner: bool = False
    joined_at: datetime | None = None
    online: bool = True


class ConnectedMessage(BaseModel):
    type: str = "connected"
    participants: list[ParticipantInfo]


class ParticipantJoinedMessage(BaseModel):
    type: str = "participant_joined"
    user: ParticipantInfo


class ParticipantLeftMessage(BaseModel):
    type: str = "participant_left"
    user_id: UUID
    online: bool = False


class GameStartedMessage(BaseModel):
    type: str = "game_started"


class GameEndedMessage(BaseModel):
    type: str = "game_ended"


class QuestionMessage(BaseModel):
    type: str = "question"
    question_id: UUID
    question_number: int
    total_questions: int
    text: str
    answers: list[str]
    time_limit: int


class TimeUpdateMessage(BaseModel):
    type: str = "time_update"
    remaining_seconds: int


class AnswerReceivedMessage(BaseModel):
    type: str = "answer_received"
    user_id: UUID


class AnswerDistribution(BaseModel):
    answer: str
    count: int
    percentage: float


class RevealMessage(BaseModel):
    type: str = "reveal"
    question_id: UUID
    question_number: int
    question_text: str
    correct_answer: str
    distribution: list[AnswerDistribution]
    segment_leaderboard: list[dict[str, Any]]
    event_leaderboard: list[dict[str, Any]]


class LeaderboardMessage(BaseModel):
    type: str = "leaderboard"
    rankings: list[dict[str, Any]]


class PhaseChangedMessage(BaseModel):
    type: str = "phase_changed"
    phase: QuizPhase
    question_index: int
    total_questions: int


class AllAnsweredMessage(BaseModel):
    type: str = "all_answered"
    answer_count: int
    total_participants: int


class ErrorMessage(BaseModel):
    type: str = "error"
    message: str


class MegaQuizReadyMessage(BaseModel):
    type: str = "mega_quiz_ready"
    event_id: UUID
    available_questions: int
    current_leaderboard: list[dict[str, Any]]
    is_single_segment: bool = False
    single_segment_mode: Literal["remix", "skip"] | None = None


class MegaQuizStartedMessage(BaseModel):
    type: str = "mega_quiz_started"
    event_id: UUID
    question_count: int


class SegmentCompleteMessage(BaseModel):
    type: str = "segment_complete"
    segment_id: UUID
    segment_title: str
    presenter_name: str
    segment_leaderboard: list[dict[str, Any]]
    event_leaderboard: list[dict[str, Any]]
    segment_winner: dict[str, Any] | None = None
    event_leader: dict[str, Any] | None = None


class SegmentWinner(BaseModel):
    segment_id: UUID
    segment_title: str
    winner_name: str
    winner_score: int


class EventCompleteMessage(BaseModel):
    type: str = "event_complete"
    event_id: UUID
    final_leaderboard: list[dict[str, Any]]
    winner: dict[str, Any] | None = None
    segment_winners: list[SegmentWinner] = Field(default_factory=list)


class PresenterChangedMessage(BaseModel):
    type: str = "presenter_changed"
    previous_presenter_id: UUID
    new_presenter_id: UUID
    new_presenter_name: str
    segment_id: UUID


class PresenterDisconnectedMessage(BaseModel):
    type: str = "presenter_disconnected"
    presenter_id: UUID
    presenter_name: str
    segment_id: UUID


class PresenterPausedMessage(BaseModel):
    type: str = "presenter_paused"
    presenter_id: UUID
    presenter_name: str
    segment_id: UUID
    question_index: int
    total_questions: int
    reason: str | None = None


class PresenterOverrideNeededMessage(BaseModel):
    type: str = "presenter_override_needed"
    presenter_id: UUID
    presenter_name: str
    segment_id: UUID


class NoQuestionsGeneratedMessage(BaseModel):
    type: str = "no_questions_generated"
    segment_id: UUID
    segment_title: str | None = None
    presenter_name: str
    reason: str = "insufficient_content"


class ParticipantNameChangedMessage(BaseModel):
    type: str = "participant_name_changed"
    user_id: UUID
    old_name: str
    new_name: str


class JoinLockStatusChangedMessage(BaseModel):
    type: str = "join_lock_status_changed"
    event_id: UUID
    join_locked: bool
    locked_at: datetime | None = None
    message: str


class QuizGeneratingMessage(BaseModel):
    """Notify clients quiz generation started."""
    type: Literal["quiz_generating"] = "quiz_generating"
    segment_id: UUID


class QuizReadyMessage(BaseModel):
    """Notify clients quiz is ready."""
    type: Literal["quiz_ready"] = "quiz_ready"
    segment_id: UUID
    questions_count: int
    auto_start: bool = True


class ProcessingStatusMessage(BaseModel):
    """Real-time processing status for host."""
    type: Literal["processing_status"] = "processing_status"
    segment_id: UUID
    stage: str
    message: str


class StateRestoredMessage(BaseModel):
    type: str = "state_restored"
    event_id: UUID
    segment_id: UUID | None
    current_phase: QuizPhase
    current_question_id: UUID | None = None
    question_text: str | None = None
    answers: list[str] = Field(default_factory=list)
    time_limit: int | None = None
    question_started_at: datetime | None = None
    your_score: int = 0
    your_answer: str | None = None
    participants: list[dict[str, Any]] = Field(default_factory=list)


class PongMessage(BaseModel):
    type: str = "pong"


class PresenterSelectedMessage(BaseModel):
    """Notify all clients that a presenter has been selected."""
    type: str = "presenter_selected"
    presenter_id: UUID
    presenter_name: str
    is_first_presenter: bool = False


class PresentationStartedMessage(BaseModel):
    """Notify all clients that a presentation has started."""
    type: str = "presentation_started"
    segment_id: UUID
    presenter_id: UUID
    presenter_name: str


class WaitingForPresenterMessage(BaseModel):
    """Notify participants they are waiting for presenter selection."""
    type: str = "waiting_for_presenter"
    event_id: UUID
    participant_count: int


def parse_client_message(data: dict[str, Any]) -> BaseModel | None:
    """Parse a client message based on its type."""
    msg_type = data.get("type")
    parsers = {
        "join": JoinMessage,
        "answer": AnswerMessage,
        "start_game": StartGameMessage,
        "next_question": NextQuestionMessage,
        "reveal_answer": RevealAnswerMessage,
        "show_leaderboard": ShowLeaderboardMessage,
        "end_game": EndGameMessage,
        "pass_presenter": PassPresenterMessage,
        "admin_select_presenter": AdminSelectPresenterMessage,
        "start_mega_quiz": StartMegaQuizMessage,
        "skip_mega_quiz": SkipMegaQuizMessage,
        "select_presenter": SelectPresenterMessage,
        "start_presentation": StartPresentationMessage,
        "resume_segment": ResumeSegmentMessage,
        "pong": PongMessage,
    }
    parser = parsers.get(msg_type)
    if parser:
        return parser.model_validate(data)
    return None
