use crate::error::{AppError, Result};
use crate::services::ai::{AIProvider, GeneratedQuestion};
use sqlx::PgPool;
use uuid::Uuid;

/// Question generation service for live presentations
pub struct QuestionGenerationService {
    pub db: PgPool,
    pub ai_provider: Box<dyn AIProvider>,
}

impl QuestionGenerationService {
    pub fn new(db: PgPool, ai_provider: Box<dyn AIProvider>) -> Self {
        Self { db, ai_provider }
    }

    /// Analyze transcript and determine if a question should be generated
    /// Returns the generated question if a complete concept is detected
    pub async fn analyze_transcript(
        &self,
        _segment_id: Uuid,
        context: &str,
        new_content: &str,
    ) -> Result<Option<GeneratedQuestionWithScore>> {
        // Get existing transcript chunks for context
        let full_context = if context.is_empty() {
            new_content.to_string()
        } else {
            format!("{}\n{}", context, new_content)
        };

        // Call AI provider to analyze and generate question
        if let Some(generated) = self
            .ai_provider
            .analyze_and_generate_question(context, new_content)
            .await?
        {
            // Calculate quality score
            let quality_score = self.calculate_quality_score(&generated, &full_context).await?;

            Ok(Some(GeneratedQuestionWithScore {
                question: generated.question,
                correct_answer: generated.correct_answer,
                topic_summary: generated.topic_summary,
                source_transcript: new_content.to_string(),
                quality_score,
            }))
        } else {
            Ok(None)
        }
    }

    /// Calculate quality score for a generated question (0.0 to 1.0)
    async fn calculate_quality_score(
        &self,
        question: &GeneratedQuestion,
        transcript: &str,
    ) -> Result<f64> {
        // Simple heuristic-based scoring
        // In production, this could use another AI call to evaluate quality
        
        let mut score: f64 = 0.5; // Base score

        // Check question length (good questions are 10-100 chars)
        let q_len = question.question.len();
        if q_len >= 10 && q_len <= 100 {
            score += 0.1;
        }

        // Check answer length (good answers are 1-50 chars)
        let a_len = question.correct_answer.len();
        if a_len >= 1 && a_len <= 50 {
            score += 0.1;
        }

        // Check if question contains question words
        let question_lower = question.question.to_lowercase();
        if question_lower.contains("what")
            || question_lower.contains("who")
            || question_lower.contains("when")
            || question_lower.contains("where")
            || question_lower.contains("why")
            || question_lower.contains("how")
        {
            score += 0.1;
        }

        // Check if answer appears in transcript (higher confidence)
        if transcript.to_lowercase().contains(&question.correct_answer.to_lowercase()) {
            score += 0.2;
        }

        Ok(score.min(1.0).max(0.0))
    }

    /// Store transcript chunk in database
    pub async fn store_transcript_chunk(
        &self,
        segment_id: Uuid,
        chunk_text: &str,
        chunk_index: i32,
        timestamp_start: Option<f64>,
        timestamp_end: Option<f64>,
    ) -> Result<()> {
        sqlx::query(
            r#"
            INSERT INTO transcripts (segment_id, chunk_text, chunk_index, timestamp_start, timestamp_end)
            VALUES ($1, $2, $3, $4, $5)
            "#,
        )
        .bind(segment_id)
        .bind(chunk_text)
        .bind(chunk_index)
        .bind(timestamp_start)
        .bind(timestamp_end)
        .execute(&self.db)
        .await?;

        Ok(())
    }

    /// Store generated question in database
    pub async fn store_question(
        &self,
        segment_id: Uuid,
        question: &str,
        correct_answer: &str,
        source_transcript: &str,
        quality_score: f64,
    ) -> Result<Uuid> {
        // Get next order index
        let next_index: (i64,) = sqlx::query_as(
            "SELECT COALESCE(MAX(order_index), -1) + 1 FROM questions WHERE segment_id = $1"
        )
        .bind(segment_id)
        .fetch_one(&self.db)
        .await?;

        let question_id = Uuid::new_v4();

        sqlx::query(
            r#"
            INSERT INTO questions (id, segment_id, question_text, correct_answer, order_index, 
                                  is_ai_generated, source_transcript, quality_score, generated_at)
            VALUES ($1, $2, $3, $4, $5, true, $6, $7, NOW())
            "#,
        )
        .bind(question_id)
        .bind(segment_id)
        .bind(question)
        .bind(correct_answer)
        .bind(next_index.0 as i32)
        .bind(source_transcript)
        .bind(quality_score)
        .execute(&self.db)
        .await?;

        Ok(question_id)
    }

    /// Get count of "good" questions (quality > threshold)
    pub async fn get_good_question_count(
        &self,
        segment_id: Uuid,
        threshold: f64,
    ) -> Result<i64> {
        let count: (i64,) = sqlx::query_as(
            "SELECT COUNT(*) FROM questions WHERE segment_id = $1 AND quality_score > $2"
        )
        .bind(segment_id)
        .bind(threshold)
        .fetch_one(&self.db)
        .await?;

        Ok(count.0)
    }
}

/// Generated question data with quality score
#[derive(Debug, Clone)]
pub struct GeneratedQuestionWithScore {
    pub question: String,
    pub correct_answer: String,
    pub topic_summary: String,
    pub source_transcript: String,
    pub quality_score: f64,
}
