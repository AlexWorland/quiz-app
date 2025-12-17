use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Quiz database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Quiz {
    pub id: Uuid,
    pub presenter_id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub show_ai_generated_badge: Option<bool>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// Quiz with questions
#[derive(Debug, Clone, Serialize)]
pub struct QuizWithQuestions {
    #[serde(flatten)]
    pub quiz: Quiz,
    pub questions: Vec<super::Question>,
}

/// Create quiz request
#[derive(Debug, Deserialize)]
pub struct CreateQuizRequest {
    pub title: String,
    pub description: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub show_ai_generated_badge: Option<bool>,
}

/// Update quiz request
#[derive(Debug, Deserialize)]
pub struct UpdateQuizRequest {
    pub title: Option<String>,
    pub description: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub show_ai_generated_badge: Option<bool>,
}

/// Quiz list response
#[derive(Debug, Serialize)]
pub struct QuizListResponse {
    pub quizzes: Vec<Quiz>,
    pub total: i64,
}
