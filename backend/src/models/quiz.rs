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
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateQuizRequest {
    pub title: String,
    pub description: Option<String>,
    pub num_fake_answers: Option<i32>,
    pub time_per_question: Option<i32>,
    pub show_ai_generated_badge: Option<bool>,
}

/// Update quiz request
#[derive(Debug, Deserialize, Serialize)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::Question;
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_quiz_with_questions_creation() {
        let quiz = Quiz {
            id: Uuid::new_v4(),
            presenter_id: Uuid::new_v4(),
            title: "Test Quiz".to_string(),
            description: Some("A test quiz".to_string()),
            num_fake_answers: Some(2),
            time_per_question: Some(30),
            show_ai_generated_badge: Some(true),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        let questions = vec![
            Question {
                id: Uuid::new_v4(),
                segment_id: Uuid::new_v4(),
                question_text: "What is 2+2?".to_string(),
                correct_answer: "4".to_string(),
                order_index: 0,
                is_ai_generated: Some(false),
                source_transcript: None,
                quality_score: None,
                generated_at: None,
                created_at: Some(Utc::now()),
            }
        ];

        let quiz_with_questions = QuizWithQuestions {
            quiz: quiz.clone(),
            questions: questions.clone(),
        };

        assert_eq!(quiz_with_questions.quiz.id, quiz.id);
        assert_eq!(quiz_with_questions.questions.len(), 1);
        assert_eq!(quiz_with_questions.questions[0].question_text, "What is 2+2?");
    }

    #[test]
    fn test_create_quiz_request_validation() {
        let request = CreateQuizRequest {
            title: "Valid Quiz Title".to_string(),
            description: Some("Description".to_string()),
            num_fake_answers: Some(3),
            time_per_question: Some(60),
            show_ai_generated_badge: Some(false),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CreateQuizRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, "Valid Quiz Title");
        assert_eq!(deserialized.num_fake_answers, Some(3));
    }

    #[test]
    fn test_update_quiz_request_partial() {
        let request = UpdateQuizRequest {
            title: Some("New Title".to_string()),
            description: None,
            num_fake_answers: Some(5),
            time_per_question: None,
            show_ai_generated_badge: Some(true),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateQuizRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.title, Some("New Title".to_string()));
        assert_eq!(deserialized.description, None);
        assert_eq!(deserialized.num_fake_answers, Some(5));
    }

    #[test]
    fn test_quiz_list_response() {
        let quizzes = vec![
            Quiz {
                id: Uuid::new_v4(),
                presenter_id: Uuid::new_v4(),
                title: "Quiz 1".to_string(),
                description: None,
                num_fake_answers: None,
                time_per_question: None,
                show_ai_generated_badge: None,
                created_at: None,
                updated_at: None,
            }
        ];

        let response = QuizListResponse {
            quizzes: quizzes.clone(),
            total: 1,
        };

        assert_eq!(response.quizzes.len(), 1);
        assert_eq!(response.total, 1);
        assert_eq!(response.quizzes[0].title, "Quiz 1");
    }
}