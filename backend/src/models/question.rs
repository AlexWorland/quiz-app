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
#[derive(Debug, Deserialize, Serialize)]
pub struct CreateQuestionRequest {
    pub question_text: String,
    pub correct_answer: String,
    pub order_index: Option<i32>,
}

/// Update question request
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateQuestionRequest {
    pub question_text: Option<String>,
    pub correct_answer: Option<String>,
    pub order_index: Option<i32>,
}

/// Bulk import question item
#[derive(Debug, Deserialize, Serialize, Clone)]
pub struct BulkQuestionItem {
    pub question_text: String,
    pub correct_answer: String,
}

/// Bulk import questions request
#[derive(Debug, Deserialize, Serialize)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;
    use chrono::Utc;

    #[test]
    fn test_question_to_question_response_conversion() {
        let question = Question {
            id: Uuid::new_v4(),
            segment_id: Uuid::new_v4(),
            question_text: "What is the capital of France?".to_string(),
            correct_answer: "Paris".to_string(),
            order_index: 1,
            is_ai_generated: Some(true),
            source_transcript: Some("Paris is the capital city of France".to_string()),
            quality_score: Some(0.95),
            generated_at: Some(Utc::now()),
            created_at: Some(Utc::now()),
        };

        let response: QuestionResponse = question.clone().into();

        assert_eq!(response.id, question.id);
        assert_eq!(response.segment_id, question.segment_id);
        assert_eq!(response.question_text, question.question_text);
        assert_eq!(response.correct_answer, question.correct_answer);
        assert_eq!(response.order_index, question.order_index);
        assert_eq!(response.is_ai_generated, question.is_ai_generated);
        assert_eq!(response.source_transcript, question.source_transcript);
        assert_eq!(response.quality_score, question.quality_score);
        assert_eq!(response.generated_at, question.generated_at);
        assert_eq!(response.created_at, question.created_at);
    }

    #[test]
    fn test_question_response_with_none_fields() {
        let question = Question {
            id: Uuid::new_v4(),
            segment_id: Uuid::new_v4(),
            question_text: "Test question".to_string(),
            correct_answer: "Answer".to_string(),
            order_index: 0,
            is_ai_generated: None,
            source_transcript: None,
            quality_score: None,
            generated_at: None,
            created_at: Some(Utc::now()),
        };

        let response: QuestionResponse = question.into();

        assert_eq!(response.is_ai_generated, None);
        assert_eq!(response.source_transcript, None);
        assert_eq!(response.quality_score, None);
        assert_eq!(response.generated_at, None);
    }

    #[test]
    fn test_create_question_request_validation() {
        let request = CreateQuestionRequest {
            question_text: "Valid question?".to_string(),
            correct_answer: "Valid answer".to_string(),
            order_index: Some(1),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: CreateQuestionRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.question_text, "Valid question?");
        assert_eq!(deserialized.correct_answer, "Valid answer");
        assert_eq!(deserialized.order_index, Some(1));
    }

    #[test]
    fn test_update_question_request_partial() {
        let request = UpdateQuestionRequest {
            question_text: Some("Updated question".to_string()),
            correct_answer: None,
            order_index: Some(2),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: UpdateQuestionRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.question_text, Some("Updated question".to_string()));
        assert_eq!(deserialized.correct_answer, None);
        assert_eq!(deserialized.order_index, Some(2));
    }

    #[test]
    fn test_bulk_import_questions_request() {
        let items = vec![
            BulkQuestionItem {
                question_text: "Question 1".to_string(),
                correct_answer: "Answer 1".to_string(),
            },
            BulkQuestionItem {
                question_text: "Question 2".to_string(),
                correct_answer: "Answer 2".to_string(),
            },
        ];

        let request = BulkImportQuestionsRequest {
            questions: items.clone(),
        };

        let json = serde_json::to_string(&request).unwrap();
        let deserialized: BulkImportQuestionsRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.questions.len(), 2);
        assert_eq!(deserialized.questions[0].question_text, "Question 1");
        assert_eq!(deserialized.questions[1].correct_answer, "Answer 2");
    }

    #[test]
    fn test_bulk_import_result() {
        let questions = vec![
            QuestionResponse {
                id: Uuid::new_v4(),
                segment_id: Uuid::new_v4(),
                question_text: "Imported question".to_string(),
                correct_answer: "Answer".to_string(),
                order_index: 0,
                is_ai_generated: Some(false),
                source_transcript: None,
                quality_score: None,
                generated_at: None,
                created_at: Some(Utc::now()),
            }
        ];

        let result = BulkImportResult {
            imported: 1,
            failed: 0,
            questions: questions.clone(),
        };

        assert_eq!(result.imported, 1);
        assert_eq!(result.failed, 0);
        assert_eq!(result.questions.len(), 1);
        assert_eq!(result.questions[0].question_text, "Imported question");
    }

    #[test]
    fn test_generated_answer_structure() {
        let answer = GeneratedAnswer {
            text: "Paris".to_string(),
            is_correct: true,
            display_order: 1,
        };

        let json = serde_json::to_string(&answer).unwrap();
        let deserialized: GeneratedAnswer = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.text, "Paris");
        assert_eq!(deserialized.is_correct, true);
        assert_eq!(deserialized.display_order, 1);
    }

    #[test]
    fn test_session_answers_with_generated_answers() {
        let answers = vec![
            GeneratedAnswer {
                text: "Paris".to_string(),
                is_correct: true,
                display_order: 1,
            },
            GeneratedAnswer {
                text: "London".to_string(),
                is_correct: false,
                display_order: 2,
            },
        ];

        let session_answers = SessionAnswers {
            id: Uuid::new_v4(),
            session_id: Uuid::new_v4(),
            question_id: Uuid::new_v4(),
            answers: sqlx::types::Json(answers.clone()),
            created_at: Some(Utc::now()),
        };

        assert_eq!(session_answers.answers.0.len(), 2);
        assert_eq!(session_answers.answers.0[0].text, "Paris");
        assert_eq!(session_answers.answers.0[0].is_correct, true);
        assert_eq!(session_answers.answers.0[1].text, "London");
        assert_eq!(session_answers.answers.0[1].is_correct, false);
    }

    #[test]
    fn test_presentation_transcript_structure() {
        let transcript = PresentationTranscript {
            id: Uuid::new_v4(),
            segment_id: Uuid::new_v4(),
            chunk_text: "This is a transcript chunk".to_string(),
            chunk_index: 5,
            timestamp_start: Some(10.5),
            timestamp_end: Some(15.2),
            created_at: Some(Utc::now()),
        };

        assert_eq!(transcript.chunk_index, 5);
        assert_eq!(transcript.timestamp_start, Some(10.5));
        assert_eq!(transcript.timestamp_end, Some(15.2));
    }

    #[test]
    fn test_leaderboard_entry_structure() {
        let entry = LeaderboardEntry {
            rank: 1,
            user_id: Uuid::new_v4(),
            username: "winner".to_string(),
            avatar_url: Some("https://example.com/avatar.jpg".to_string()),
            score: 1000,
        };

        assert_eq!(entry.rank, 1);
        assert_eq!(entry.username, "winner");
        assert_eq!(entry.score, 1000);
        assert!(entry.avatar_url.is_some());
    }

    #[test]
    fn test_question_ordering() {
        let mut questions = vec![
            Question {
                id: Uuid::new_v4(),
                segment_id: Uuid::new_v4(),
                question_text: "Question 2".to_string(),
                correct_answer: "Answer 2".to_string(),
                order_index: 1,
                is_ai_generated: None,
                source_transcript: None,
                quality_score: None,
                generated_at: None,
                created_at: Some(Utc::now()),
            },
            Question {
                id: Uuid::new_v4(),
                segment_id: Uuid::new_v4(),
                question_text: "Question 1".to_string(),
                correct_answer: "Answer 1".to_string(),
                order_index: 0,
                is_ai_generated: None,
                source_transcript: None,
                quality_score: None,
                generated_at: None,
                created_at: Some(Utc::now()),
            },
        ];

        questions.sort_by_key(|q| q.order_index);

        assert_eq!(questions[0].order_index, 0);
        assert_eq!(questions[0].question_text, "Question 1");
        assert_eq!(questions[1].order_index, 1);
        assert_eq!(questions[1].question_text, "Question 2");
    }
}