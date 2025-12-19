use serde::{Deserialize, Serialize};
use uuid::Uuid;
use crate::ws::hub::QuizPhase;

/// Message types for game WebSocket
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum GameMessage {
    #[serde(rename = "join")]
    Join {
        user_id: Uuid,
        session_code: String,
    },
    #[serde(rename = "answer")]
    Answer {
        question_id: Uuid,
        selected_answer: String,
        response_time_ms: i32,
    },
    #[serde(rename = "start_game")]
    StartGame,
    #[serde(rename = "next_question")]
    NextQuestion,
    #[serde(rename = "reveal_answer")]
    RevealAnswer,
    #[serde(rename = "show_leaderboard")]
    ShowLeaderboard,
    #[serde(rename = "end_game")]
    EndGame,
    #[serde(rename = "pass_presenter")]
    PassPresenter {
        next_presenter_user_id: Uuid,
    },
}

/// Server-sent messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ServerMessage {
    #[serde(rename = "connected")]
    Connected { participants: Vec<ParticipantMessage> },
    #[serde(rename = "participant_joined")]
    ParticipantJoined { user: ParticipantMessage },
    #[serde(rename = "participant_left")]
    ParticipantLeft { user_id: Uuid },
    #[serde(rename = "game_started")]
    GameStarted,
    #[serde(rename = "question")]
    Question {
        question_id: Uuid,
        question_number: i32,
        total_questions: i32,
        text: String,
        answers: Vec<String>,
        time_limit: i32,
    },
    #[serde(rename = "time_update")]
    TimeUpdate { remaining_seconds: i32 },
    #[serde(rename = "answer_received")]
    AnswerReceived { user_id: Uuid },
    #[serde(rename = "reveal")]
    Reveal {
        question_id: Uuid,
        question_number: i32,
        question_text: String,
        correct_answer: String,
        distribution: Vec<AnswerDistributionMessage>,
        segment_leaderboard: Vec<LeaderboardEntry>,
        event_leaderboard: Vec<LeaderboardEntry>,
    },
    #[serde(rename = "scores_update")]
    ScoresUpdate {
        scores: Vec<ScoreUpdate>,
    },
    #[serde(rename = "leaderboard")]
    Leaderboard {
        rankings: Vec<LeaderboardEntry>,
    },
    #[serde(rename = "game_ended")]
    GameEnded,
    #[serde(rename = "error")]
    Error { message: String },
    #[serde(rename = "processing_status")]
    ProcessingStatus {
        step: String,           // "transcribing", "generating", "ready"
        progress: Option<i32>,  // 0-100 percentage
        message: String,
    },
    #[serde(rename = "display_mode")]
    DisplayMode {
        mode: String,           // "leaderboard", "question_results", "quiz_progress", "final_results"
        data: serde_json::Value,
    },
    #[serde(rename = "phase_changed")]
    PhaseChanged {
        phase: QuizPhase,
        question_index: i32,
        total_questions: i32,
    },
    #[serde(rename = "all_answered")]
    AllAnswered {
        answer_count: usize,
        total_participants: usize,
    },
    #[serde(rename = "presenter_changed")]
    PresenterChanged {
        previous_presenter_id: Uuid,
        new_presenter_id: Uuid,
        new_presenter_name: String,
        segment_id: Uuid,
    },
    #[serde(rename = "segment_complete")]
    SegmentComplete {
        segment_id: Uuid,
        segment_title: String,
        presenter_name: String,
        segment_leaderboard: Vec<LeaderboardEntry>,
        event_leaderboard: Vec<LeaderboardEntry>,
        segment_winner: Option<LeaderboardEntry>,
        event_leader: Option<LeaderboardEntry>,
    },
    #[serde(rename = "event_complete")]
    EventComplete {
        event_id: Uuid,
        final_leaderboard: Vec<LeaderboardEntry>,
        winner: Option<LeaderboardEntry>,
        segment_winners: Vec<SegmentWinner>,
    },
}

/// Segment winner information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SegmentWinner {
    pub segment_id: Uuid,
    pub segment_title: String,
    pub winner_name: String,
    pub winner_score: i32,
}

/// Participant info in messages
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParticipantMessage {
    pub id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
}

/// Answer distribution in reveal message
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AnswerDistributionMessage {
    pub answer: String,
    pub count: i32,
    pub is_correct: bool,
}

/// Score update
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreUpdate {
    pub user_id: Uuid,
    pub username: String,
    pub score: i32,
    pub delta: i32,
}

/// Leaderboard entry
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub score: i32,
}

/// Audio WebSocket messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AudioMessage {
    #[serde(rename = "audio_chunk")]
    AudioChunk { data: String, timestamp: i64 }, // base64 encoded
    #[serde(rename = "audio_stop")]
    AudioStop,
}

/// Audio server messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum AudioServerMessage {
    #[serde(rename = "transcript_update")]
    TranscriptUpdate { text: String, is_final: bool },
    #[serde(rename = "question_generated")]
    QuestionGenerated {
        question: String,
        correct_answer: String,
        source_transcript: String,
    },
    #[serde(rename = "transcription_error")]
    TranscriptionError { error: String },
}

/// Canvas WebSocket messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanvasMessage {
    #[serde(rename = "draw_stroke")]
    DrawStroke {
        stroke: StrokeData,
    },
    #[serde(rename = "clear_canvas")]
    ClearCanvas,
}

/// Canvas server messages
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum CanvasServerMessage {
    #[serde(rename = "stroke_added")]
    StrokeAdded {
        user_id: Uuid,
        username: String,
        stroke: StrokeData,
    },
    #[serde(rename = "canvas_cleared")]
    CanvasCleared,
    #[serde(rename = "canvas_sync")]
    CanvasSync {
        strokes: Vec<StrokeData>,
    },
}

/// Stroke data structure
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StrokeData {
    pub points: Vec<Point>,
    pub color: String,
    pub width: f64,
}

/// Point in a stroke
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Point {
    pub x: f64,
    pub y: f64,
}

/// Flappy Bird input messages from clients
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FlappyInputMessage {
    #[serde(rename = "flap")]
    Flap {
        user_id: Uuid,
    },
}

/// Per-player Flappy Bird state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlappyPlayerState {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub y: f32,
    pub velocity: f32,
    pub alive: bool,
    pub score: i32,
}

/// Flappy Bird game state broadcast from server
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum FlappyServerMessage {
    #[serde(rename = "flappy_state")]
    FlappyState {
        players: Vec<FlappyPlayerState>,
        obstacle_x: f32,
        gap_y: f32,
    },
}
