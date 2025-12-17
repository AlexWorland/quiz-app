use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Question database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Question {
    pub id: Uuid,
    pub segment_id: Uuid,
    pub question_text: String,
    pub correct_answer: String,
    pub order_index: i32,
    pub is_ai_generated: Option<bool>,
    pub source_transcript: Option<String>,
    pub quality_score: Option<f64>,
    pub generated_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Question response
#[derive(Debug, Clone, Serialize)]
pub struct QuestionResponse {
    pub id: Uuid,
    pub segment_id: Uuid,
    pub question_text: String,
    pub correct_answer: String,
    pub order_index: i32,
    pub is_ai_generated: Option<bool>,
    pub source_transcript: Option<String>,
    pub quality_score: Option<f64>,
    pub generated_at: Option<DateTime<Utc>>,
    pub created_at: Option<DateTime<Utc>>,
}

impl From<Question> for QuestionResponse {
    fn from(q: Question) -> Self {
        Self {
            id: q.id,
            segment_id: q.segment_id,
            question_text: q.question_text,
            correct_answer: q.correct_answer,
            order_index: q.order_index,
            is_ai_generated: q.is_ai_generated,
            source_transcript: q.source_transcript,
            quality_score: q.quality_score,
            generated_at: q.generated_at,
            created_at: q.created_at,
        }
    }
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

/// Bulk import question item
#[derive(Debug, Deserialize)]
pub struct BulkQuestionItem {
    pub question_text: String,
    pub correct_answer: String,
}

/// Bulk import questions request
#[derive(Debug, Deserialize)]
pub struct BulkImportQuestionsRequest {
    pub questions: Vec<BulkQuestionItem>,
}

/// Bulk import result
#[derive(Debug, Serialize)]
pub struct BulkImportResult {
    pub imported: usize,
    pub failed: usize,
    pub questions: Vec<QuestionResponse>,
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
    pub segment_id: Uuid,
    pub chunk_text: String,
    pub chunk_index: i32,
    pub timestamp_start: Option<f64>,
    pub timestamp_end: Option<f64>,
    pub created_at: Option<DateTime<Utc>>,
}

/// Leaderboard entry
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct LeaderboardEntry {
    pub rank: i64,
    pub user_id: Uuid,
    pub username: String,
    pub avatar_url: Option<String>,
    pub score: i32,
}
