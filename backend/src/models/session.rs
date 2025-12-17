use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Game session status
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum SessionStatus {
    Waiting,
    Active,
    Finished,
}

impl ToString for SessionStatus {
    fn to_string(&self) -> String {
        match self {
            SessionStatus::Waiting => "waiting".to_string(),
            SessionStatus::Active => "active".to_string(),
            SessionStatus::Finished => "finished".to_string(),
        }
    }
}

impl From<String> for SessionStatus {
    fn from(s: String) -> Self {
        match s.as_str() {
            "active" => SessionStatus::Active,
            "finished" => SessionStatus::Finished,
            _ => SessionStatus::Waiting,
        }
    }
}

/// Game session database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct GameSession {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub join_code: String,
    pub status: String,
    pub current_question_index: Option<i32>,
    pub question_started_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Session participant
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionParticipant {
    pub id: Uuid,
    pub session_id: Uuid,
    pub user_id: Uuid,
    pub total_score: Option<i32>,
    pub joined_at: Option<DateTime<Utc>>,
}

/// Question response from a participant
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Response {
    pub id: Uuid,
    pub session_id: Uuid,
    pub question_id: Uuid,
    pub user_id: Uuid,
    pub selected_answer: String,
    pub is_correct: bool,
    pub response_time_ms: i32,
    pub points_earned: i32,
    pub created_at: Option<DateTime<Utc>>,
}

/// Create session request
#[derive(Debug, Deserialize)]
pub struct CreateSessionRequest {
    pub quiz_id: Uuid,
}

/// Session response with details
#[derive(Debug, Serialize)]
pub struct SessionResponse {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub join_code: String,
    pub status: String,
    pub current_question_index: i32,
    pub participants: Vec<ParticipantInfo>,
}

/// Participant info for session response
#[derive(Debug, Clone, Serialize)]
pub struct ParticipantInfo {
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub total_score: i32,
}

/// Join session request
#[derive(Debug, Deserialize)]
pub struct JoinSessionRequest {
    // User is identified by auth token
}

/// Submit answer request
#[derive(Debug, Deserialize)]
pub struct SubmitAnswerRequest {
    pub question_id: Uuid,
    pub selected_answer: String,
    pub response_time_ms: i32,
}

/// Leaderboard entry
#[derive(Debug, Clone, Serialize)]
pub struct LeaderboardEntry {
    pub rank: i32,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub total_score: i32,
}

/// Answer distribution for results
#[derive(Debug, Clone, Serialize)]
pub struct AnswerDistribution {
    pub answer: String,
    pub count: i32,
    pub is_correct: bool,
}
