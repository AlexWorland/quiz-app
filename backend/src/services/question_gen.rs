use crate::error::{AppError, Result};
use crate::services::ai::{AIProvider, GeneratedQuestion};
use sqlx::PgPool;
use uuid::Uuid;

/// AI-based quality assessment result
#[derive(Debug, Clone)]
pub struct QualityAssessment {
    pub clarity_score: f64,
    pub answerability_score: f64,
    pub factual_accuracy_score: f64,
    pub overall_score: f64,
    pub issues: Vec<String>,
}

/// Question generation service for live presentations
pub struct QuestionGenerationService {
    pub db: PgPool,
    pub ai_provider: Box<dyn AIProvider>,
    pub enable_ai_quality_scoring: bool,
    pub num_fake_answers: usize,
}

impl QuestionGenerationService {
    pub fn new(db: PgPool, ai_provider: Box<dyn AIProvider>, enable_ai_quality_scoring: bool, num_fake_answers: usize) -> Self {
        Self {
            db,
            ai_provider,
            enable_ai_quality_scoring,
            num_fake_answers,
        }
    }

    /// Analyze transcript and determine if a question should be generated
    /// Returns the generated question if a complete concept is detected
    pub async fn analyze_transcript(
        &self,
        segment_id: Uuid,
        context: &str,
        new_content: &str,
    ) -> Result<Option<GeneratedQuestionWithScore>> {
        // Get existing transcript chunks for context
        let full_context = if context.is_empty() {
            new_content.to_string()
        } else {
            format!("{}\n{}", context, new_content)
        };

        // Fetch existing questions for this segment to avoid duplicates
        let existing_questions: Vec<String> = sqlx::query_scalar(
            "SELECT question_text FROM questions WHERE segment_id = $1"
        )
        .bind(segment_id)
        .fetch_all(&self.db)
        .await?;

        // Call AI provider to analyze and generate question
        if let Some(generated) = self
            .ai_provider
            .analyze_and_generate_question(context, new_content, &existing_questions, self.num_fake_answers)
            .await?
        {
            // Calculate heuristic quality score
            let heuristic_score = self.calculate_quality_score(&generated, &full_context).await?;

            // Optionally evaluate with AI if enabled
            let ai_assessment = if self.enable_ai_quality_scoring {
                self.evaluate_with_ai(&generated, &full_context).await?
            } else {
                None
            };

            // Blend scores if AI evaluation is available
            let quality_score = self.blend_quality_scores(heuristic_score, ai_assessment.clone()).await?;

            // Log AI assessment issues if available
            if let Some(assessment) = ai_assessment {
                if !assessment.issues.is_empty() {
                    tracing::info!(
                        "AI quality assessment found issues for question '{}': {:?}",
                        generated.question,
                        assessment.issues
                    );
                }
            }

            Ok(Some(GeneratedQuestionWithScore {
                question: generated.question,
                correct_answer: generated.correct_answer,
                topic_summary: generated.topic_summary,
                source_transcript: new_content.to_string(),
                quality_score,
                fake_answers: generated.fake_answers,
            }))
        } else {
            Ok(None)
        }
    }

    /// Evaluate question quality using AI provider
    async fn evaluate_with_ai(
        &self,
        question: &GeneratedQuestion,
        transcript_context: &str,
    ) -> Result<Option<QualityAssessment>> {
        self.ai_provider
            .evaluate_question_quality(&question.question, &question.correct_answer, transcript_context)
            .await
    }

    /// Blend heuristic and AI quality scores
    /// Uses 30% heuristic + 70% AI score when AI assessment is available
    /// Falls back to 100% heuristic when AI is unavailable
    async fn blend_quality_scores(
        &self,
        heuristic_score: f64,
        ai_assessment: Option<QualityAssessment>,
    ) -> Result<f64> {
        match ai_assessment {
            Some(ai) => {
                let blended = 0.3 * heuristic_score + 0.7 * ai.overall_score;
                tracing::debug!(
                    "Blended quality score: {:.2} (heuristic: {:.2}, AI: {:.2})",
                    blended,
                    heuristic_score,
                    ai.overall_score
                );
                Ok(blended)
            }
            None => Ok(heuristic_score),
        }
    }

    /// Calculate quality score for a generated question (0.0 to 1.0)
    /// 
    /// Current implementation uses heuristic-based scoring. This approach:
    /// - Is fast and doesn't require additional API calls
    /// - Works offline/without external dependencies
    /// - Provides reasonable quality filtering
    /// 
    /// Limitations:
    /// - Cannot detect subtle quality issues (ambiguity, poor phrasing)
    /// - Cannot verify factual accuracy beyond transcript matching
    /// - May miss nuanced quality problems that AI evaluation could catch
    /// 
    /// TODO: Future enhancement - AI-based quality evaluation
    /// - Use a separate AI call to evaluate question quality
    /// - Check for: clarity, ambiguity, appropriateness, answerability
    /// - Consider adding a feature flag: `ENABLE_AI_QUALITY_SCORING`
    /// - Could use a smaller/faster model for cost efficiency
    async fn calculate_quality_score(
        &self,
        question: &GeneratedQuestion,
        transcript: &str,
    ) -> Result<f64> {
        let mut score: f64 = 0.5; // Base score

        // Check question length (good questions are 10-100 chars)
        let q_len = question.question.len();
        if q_len >= 10 && q_len <= 100 {
            score += 0.1;
        } else if q_len < 10 {
            score -= 0.1; // Too short
        } else if q_len > 150 {
            score -= 0.05; // Too long
        }

        // Check answer length (good answers are 1-50 chars)
        let a_len = question.correct_answer.len();
        if a_len >= 1 && a_len <= 50 {
            score += 0.1;
        } else if a_len == 0 {
            score -= 0.2; // Empty answer
        } else if a_len > 100 {
            score -= 0.1; // Answer too long (likely not a good quiz answer)
        }

        // Check if question contains question words (indicates proper question format)
        let question_lower = question.question.to_lowercase();
        let has_question_word = question_lower.contains("what")
            || question_lower.contains("who")
            || question_lower.contains("when")
            || question_lower.contains("where")
            || question_lower.contains("why")
            || question_lower.contains("how")
            || question_lower.contains("which")
            || question_lower.contains("whose");
        if has_question_word {
            score += 0.1;
        }

        // Check if question ends with question mark
        if question.question.trim_end().ends_with('?') {
            score += 0.05;
        }

        // Check if answer is not too similar to question (avoids trivial questions)
        let answer_lower = question.correct_answer.to_lowercase();
        let question_words: Vec<&str> = question_lower.split_whitespace().collect();
        let answer_words: Vec<&str> = answer_lower.split_whitespace().collect();
        let common_words: usize = question_words.iter()
            .filter(|w| answer_words.contains(w) && w.len() > 3) // Only count words longer than 3 chars
            .count();
        let similarity_ratio = if question_words.len() > 0 {
            common_words as f64 / question_words.len() as f64
        } else {
            0.0
        };
        if similarity_ratio > 0.5 {
            score -= 0.15; // Answer too similar to question (likely trivial)
        }

        // Check if answer appears in transcript (higher confidence in correctness)
        let transcript_lower = transcript.to_lowercase();
        if transcript_lower.contains(&answer_lower) {
            score += 0.2;
        } else {
            // Answer not found in transcript - might be inferred or incorrect
            score -= 0.1;
        }

        // Basic grammatical check: question should not start with lowercase (unless it's a continuation)
        let first_char = question.question.chars().next().unwrap_or(' ');
        if first_char.is_lowercase() && !question_lower.starts_with("which") {
            score -= 0.05; // Likely incomplete or poorly formatted
        }

        // Log quality score for monitoring
        tracing::debug!(
            "Question quality score: {:.2} for question: '{}' (answer: '{}')",
            score.min(1.0).max(0.0),
            question.question,
            question.correct_answer
        );

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
        fake_answers: &[String],
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

        // Store fake answers in session_answers table
        let mut generated_answers = vec![
            crate::models::question::GeneratedAnswer {
                text: correct_answer.to_string(),
                is_correct: true,
                display_order: 0,
            }
        ];

        for (idx, fake) in fake_answers.iter().enumerate() {
            generated_answers.push(crate::models::question::GeneratedAnswer {
                text: fake.clone(),
                is_correct: false,
                display_order: (idx + 1) as i32,
            });
        }

        sqlx::query(
            "INSERT INTO session_answers (question_id, answers) VALUES ($1, $2)"
        )
        .bind(question_id)
        .bind(sqlx::types::Json(generated_answers))
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
    pub fake_answers: Vec<String>,
}
