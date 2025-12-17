use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Question database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Question {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub question_text: String,
    pub correct_answer: String,
    pub order_index: i32,
    pub is_ai_generated: Option<bool>,
    pub source_transcript: Option<String>,
    pub generated_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Create question request
#[derive(Debug, Deserialize)]
pub struct CreateQuestionRequest {
    pub question_text: String,
    pub correct_answer: String,
    pub order_index: Option<i32>,
}

/// Update question request
#[derive(Debug, Deserialize)]
pub struct UpdateQuestionRequest {
    pub question_text: Option<String>,
    pub correct_answer: Option<String>,
    pub order_index: Option<i32>,
}

/// Generated answers for a question during a session
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GeneratedAnswer {
    pub text: String,
    pub is_correct: bool,
    pub display_order: i32,
}

/// Session answers (stored as JSONB)
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct SessionAnswers {
    pub id: Uuid,
    pub session_id: Uuid,
    pub question_id: Uuid,
    pub answers: sqlx::types::Json<Vec<GeneratedAnswer>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Presentation transcript chunk
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct PresentationTranscript {
    pub id: Uuid,
    pub quiz_id: Uuid,
    pub chunk_text: String,
    pub chunk_index: i32,
    pub timestamp_start: Option<f64>,
    pub timestamp_end: Option<f64>,
    pub created_at: Option<DateTime<Utc>>,
}
