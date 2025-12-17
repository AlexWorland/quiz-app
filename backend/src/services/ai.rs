use crate::error::{AppError, Result};
use crate::services::question_gen::QualityAssessment;
use reqwest::Client;
use serde_json::json;

/// AI provider trait for generating fake answers
#[async_trait::async_trait]
pub trait AIProvider: Send + Sync {
    /// Generate fake answers for a question
    async fn generate_fake_answers(
        &self,
        question: &str,
        correct_answer: &str,
        num_answers: usize,
    ) -> Result<Vec<String>>;

    /// Analyze transcript and generate question if topic is complete
    async fn analyze_and_generate_question(
        &self,
        transcript_context: &str,
        new_transcript: &str,
        existing_questions: &[String],
        num_fake_answers: usize,
    ) -> Result<Option<GeneratedQuestion>>;

    /// Evaluate question quality using AI (optional, returns None if not implemented)
    async fn evaluate_question_quality(
        &self,
        question: &str,
        correct_answer: &str,
        transcript_context: &str,
    ) -> Result<Option<QualityAssessment>>;
}

/// Generated question from transcript analysis
#[derive(Debug, Clone)]
pub struct GeneratedQuestion {
    pub question: String,
    pub correct_answer: String,
    pub topic_summary: String,
    pub fake_answers: Vec<String>,
}

/// Claude AI provider implementation
pub struct ClaudeProvider {
    api_key: String,
}

impl ClaudeProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl AIProvider for ClaudeProvider {
    async fn generate_fake_answers(
        &self,
        question: &str,
        correct_answer: &str,
        num_answers: usize,
    ) -> Result<Vec<String>> {
        let client = Client::new();
        let prompt = format!(
            "Generate {} plausible but incorrect answers for this question: \"{}\"\n\nThe correct answer is: \"{}\"\n\nReturn only the answers, one per line, without numbering or bullets.",
            num_answers, question, correct_answer
        );

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": "claude-3-sonnet-20240229",
                "max_tokens": 500,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Claude API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Claude API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Claude response: {}", e)))?;

        let content = json
            .pointer("/content/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let answers: Vec<String> = content
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .take(num_answers)
            .collect();

        Ok(answers)
    }

    async fn analyze_and_generate_question(
        &self,
        transcript_context: &str,
        new_transcript: &str,
        existing_questions: &[String],
        num_fake_answers: usize,
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            // Not enough content to generate a question
            return Ok(None);
        }

        let client = Client::new();

        let existing_questions_section = if !existing_questions.is_empty() {
            let questions_list = existing_questions
                .iter()
                .map(|q| format!("- {}", q))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "\n\nQuestions already generated for this segment (do not repeat these or ask similar questions):\n{}",
                questions_list
            )
        } else {
            String::new()
        };

        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{}\n\nThe new content is:\n\n{}{}\n\nIf this new content completes a clear topic or concept that can be tested with a quiz question, generate a multiple-choice question about it. Return your response as JSON with keys: question, correct_answer, topic_summary, fake_answers. The fake_answers array should contain exactly {} plausible but incorrect answers. If no good question can be generated, return null.",
            transcript_context, new_transcript, existing_questions_section, num_fake_answers
        );

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": "claude-3-sonnet-20240229",
                "max_tokens": 1000,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Claude API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Claude API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Claude response: {}", e)))?;

        let content = json
            .pointer("/content/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        // Try to parse JSON from response
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            if parsed.is_null() {
                return Ok(None);
            }

            if let (Some(question), Some(answer)) = (
                parsed.get("question").and_then(|v| v.as_str()),
                parsed.get("correct_answer").and_then(|v| v.as_str()),
            ) {
                let fake_answers = parsed
                    .get("fake_answers")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    fake_answers,
                }));
            }
        }

        Ok(None)
    }

    async fn evaluate_question_quality(
        &self,
        question: &str,
        correct_answer: &str,
        transcript_context: &str,
    ) -> Result<Option<QualityAssessment>> {
        let client = Client::new();
        let prompt = format!(
            "Evaluate this quiz question for quality. Score each dimension 0.0-1.0:\n\n\
             Question: {}\n\
             Correct Answer: {}\n\
             Source Context: {}\n\n\
             Evaluate:\n\
             1. Clarity: Is the question unambiguous and well-phrased?\n\
             2. Answerability: Can the question be answered from the context?\n\
             3. Factual Accuracy: Is the correct answer actually correct?\n\n\
             Return JSON only: {{\"clarity\": X.X, \"answerability\": X.X, \"factual_accuracy\": X.X, \"issues\": [\"issue1\", \"issue2\"]}}",
            question, correct_answer, transcript_context
        );

        let response = client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", &self.api_key)
            .header("anthropic-version", "2023-06-01")
            .json(&json!({
                "model": "claude-3-5-haiku-20241022",
                "max_tokens": 500,
                "messages": [{
                    "role": "user",
                    "content": prompt
                }]
            }))
            .send()
            .await;

        let response = match response {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Claude AI quality evaluation failed: {}", e);
                return Ok(None);
            }
        };

        if !response.status().is_success() {
            tracing::warn!("Claude AI quality evaluation returned error: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = match response.json().await {
            Ok(j) => j,
            Err(e) => {
                tracing::warn!("Failed to parse Claude quality evaluation response: {}", e);
                return Ok(None);
            }
        };

        let content = json
            .pointer("/content/0/text")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            let clarity = parsed.get("clarity").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let answerability = parsed.get("answerability").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let factual_accuracy = parsed.get("factual_accuracy").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let issues = parsed
                .get("issues")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let overall_score = (clarity + answerability + factual_accuracy) / 3.0;

            return Ok(Some(QualityAssessment {
                clarity_score: clarity,
                answerability_score: answerability,
                factual_accuracy_score: factual_accuracy,
                overall_score,
                issues,
            }));
        }

        Ok(None)
    }
}

/// OpenAI provider implementation
pub struct OpenAIProvider {
    api_key: String,
}

impl OpenAIProvider {
    pub fn new(api_key: String) -> Self {
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl AIProvider for OpenAIProvider {
    async fn generate_fake_answers(
        &self,
        question: &str,
        correct_answer: &str,
        num_answers: usize,
    ) -> Result<Vec<String>> {
        let client = Client::new();
        let prompt = format!(
            "Generate {} plausible but incorrect answers for this question: \"{}\"\n\nThe correct answer is: \"{}\"\n\nReturn only the answers, one per line, without numbering or bullets.",
            num_answers, question, correct_answer
        );

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&json!({
                "model": "gpt-4",
                "messages": [{
                    "role": "user",
                    "content": prompt
                }],
                "max_tokens": 500
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("OpenAI API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "OpenAI API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse OpenAI response: {}", e)))?;

        let content = json
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let answers: Vec<String> = content
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .take(num_answers)
            .collect();

        Ok(answers)
    }

    async fn analyze_and_generate_question(
        &self,
        transcript_context: &str,
        new_transcript: &str,
        existing_questions: &[String],
        num_fake_answers: usize,
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            return Ok(None);
        }

        let client = Client::new();

        let existing_questions_section = if !existing_questions.is_empty() {
            let questions_list = existing_questions
                .iter()
                .map(|q| format!("- {}", q))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "\n\nQuestions already generated for this segment (do not repeat these or ask similar questions):\n{}",
                questions_list
            )
        } else {
            String::new()
        };

        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{}\n\nThe new content is:\n\n{}{}\n\nIf this new content completes a clear topic or concept that can be tested with a quiz question, generate a multiple-choice question about it. Return your response as JSON with keys: question, correct_answer, topic_summary, fake_answers. The fake_answers array should contain exactly {} plausible but incorrect answers. If no good question can be generated, return null.",
            transcript_context, new_transcript, existing_questions_section, num_fake_answers
        );

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&json!({
                "model": "gpt-4",
                "messages": [{
                    "role": "user",
                    "content": prompt
                }],
                "max_tokens": 1000,
                "response_format": { "type": "json_object" }
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("OpenAI API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "OpenAI API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse OpenAI response: {}", e)))?;

        let content = json
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            if parsed.is_null() {
                return Ok(None);
            }

            if let (Some(question), Some(answer)) = (
                parsed.get("question").and_then(|v| v.as_str()),
                parsed.get("correct_answer").and_then(|v| v.as_str()),
            ) {
                let fake_answers = parsed
                    .get("fake_answers")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    fake_answers,
                }));
            }
        }

        Ok(None)
    }

    async fn evaluate_question_quality(
        &self,
        question: &str,
        correct_answer: &str,
        transcript_context: &str,
    ) -> Result<Option<QualityAssessment>> {
        let client = Client::new();
        let prompt = format!(
            "Evaluate this quiz question for quality. Score each dimension 0.0-1.0:\n\n\
             Question: {}\n\
             Correct Answer: {}\n\
             Source Context: {}\n\n\
             Evaluate:\n\
             1. Clarity: Is the question unambiguous and well-phrased?\n\
             2. Answerability: Can the question be answered from the context?\n\
             3. Factual Accuracy: Is the correct answer actually correct?\n\n\
             Return JSON only: {{\"clarity\": X.X, \"answerability\": X.X, \"factual_accuracy\": X.X, \"issues\": [\"issue1\", \"issue2\"]}}",
            question, correct_answer, transcript_context
        );

        let response = client
            .post("https://api.openai.com/v1/chat/completions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .json(&json!({
                "model": "gpt-4o-mini",
                "messages": [{
                    "role": "user",
                    "content": prompt
                }],
                "max_tokens": 500,
                "response_format": { "type": "json_object" }
            }))
            .send()
            .await;

        let response = match response {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("OpenAI quality evaluation failed: {}", e);
                return Ok(None);
            }
        };

        if !response.status().is_success() {
            tracing::warn!("OpenAI quality evaluation returned error: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = match response.json().await {
            Ok(j) => j,
            Err(e) => {
                tracing::warn!("Failed to parse OpenAI quality evaluation response: {}", e);
                return Ok(None);
            }
        };

        let content = json
            .pointer("/choices/0/message/content")
            .and_then(|v| v.as_str())
            .unwrap_or("{}");

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            let clarity = parsed.get("clarity").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let answerability = parsed.get("answerability").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let factual_accuracy = parsed.get("factual_accuracy").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let issues = parsed
                .get("issues")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let overall_score = (clarity + answerability + factual_accuracy) / 3.0;

            return Ok(Some(QualityAssessment {
                clarity_score: clarity,
                answerability_score: answerability,
                factual_accuracy_score: factual_accuracy,
                overall_score,
                issues,
            }));
        }

        Ok(None)
    }
}

/// Ollama local LLM provider
pub struct OllamaProvider {
    base_url: String,
    model: String,
}

impl OllamaProvider {
    pub fn new(base_url: String, model: String) -> Self {
        Self { base_url, model }
    }
}

#[async_trait::async_trait]
impl AIProvider for OllamaProvider {
    async fn generate_fake_answers(
        &self,
        question: &str,
        correct_answer: &str,
        num_answers: usize,
    ) -> Result<Vec<String>> {
        let client = Client::new();

        let prompt = format!(
            "Generate {num} plausible but incorrect answers for this question: \"{q}\"\n\n\
             The correct answer is: \"{a}\".\n\n\
             Return only the answers, one per line, without numbering or bullets.",
            num = num_answers,
            q = question,
            a = correct_answer
        );

        // Ollama generate API
        let url = format!("{}/api/generate", self.base_url.trim_end_matches('/'));

        let response = client
            .post(&url)
            .json(&json!({
                "model": self.model,
                "prompt": prompt,
                "stream": false
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Ollama API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Ollama API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Ollama response: {}", e)))?;

        // Ollama's /generate response typically has a 'response' field with the text
        let content = json
            .get("response")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let answers: Vec<String> = content
            .lines()
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .take(num_answers)
            .collect();

        Ok(answers)
    }

    async fn analyze_and_generate_question(
        &self,
        transcript_context: &str,
        new_transcript: &str,
        existing_questions: &[String],
        num_fake_answers: usize,
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            return Ok(None);
        }

        let client = Client::new();

        let existing_questions_section = if !existing_questions.is_empty() {
            let questions_list = existing_questions
                .iter()
                .map(|q| format!("- {}", q))
                .collect::<Vec<_>>()
                .join("\n");
            format!(
                "\n\nQuestions already generated for this segment (do not repeat these or ask similar questions):\n{}",
                questions_list
            )
        } else {
            String::new()
        };

        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{ctx}\n\n\
             The new content is:\n\n{new}{existing}\n\n\
             If this new content completes a clear topic or concept that can be tested with a quiz question, \
             generate a multiple-choice question about it.\n\n\
             Return your response strictly as JSON with keys: question, correct_answer, topic_summary, fake_answers.\n\
             The fake_answers array should contain exactly {num_fake} plausible but incorrect answers.\n\
             If no good question can be generated, return null.",
            ctx = transcript_context,
            new = new_transcript,
            existing = existing_questions_section,
            num_fake = num_fake_answers
        );

        let url = format!("{}/api/generate", self.base_url.trim_end_matches('/'));

        let response = client
            .post(&url)
            .json(&json!({
                "model": self.model,
                "prompt": prompt,
                "stream": false
            }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Ollama API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Ollama API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Ollama response: {}", e)))?;

        let content = json
            .get("response")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            if parsed.is_null() {
                return Ok(None);
            }

            if let (Some(question), Some(answer)) = (
                parsed.get("question").and_then(|v| v.as_str()),
                parsed.get("correct_answer").and_then(|v| v.as_str()),
            ) {
                let fake_answers = parsed
                    .get("fake_answers")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default();

                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                    fake_answers,
                }));
            }
        }

        Ok(None)
    }

    async fn evaluate_question_quality(
        &self,
        question: &str,
        correct_answer: &str,
        transcript_context: &str,
    ) -> Result<Option<QualityAssessment>> {
        let client = Client::new();
        let prompt = format!(
            "Evaluate this quiz question for quality. Score each dimension 0.0-1.0:\n\n\
             Question: {}\n\
             Correct Answer: {}\n\
             Source Context: {}\n\n\
             Evaluate:\n\
             1. Clarity: Is the question unambiguous and well-phrased?\n\
             2. Answerability: Can the question be answered from the context?\n\
             3. Factual Accuracy: Is the correct answer actually correct?\n\n\
             Return JSON only: {{\"clarity\": X.X, \"answerability\": X.X, \"factual_accuracy\": X.X, \"issues\": [\"issue1\", \"issue2\"]}}",
            question, correct_answer, transcript_context
        );

        let url = format!("{}/api/generate", self.base_url.trim_end_matches('/'));

        let response = client
            .post(&url)
            .json(&json!({
                "model": self.model,
                "prompt": prompt,
                "stream": false
            }))
            .send()
            .await;

        let response = match response {
            Ok(r) => r,
            Err(e) => {
                tracing::warn!("Ollama quality evaluation failed: {}", e);
                return Ok(None);
            }
        };

        if !response.status().is_success() {
            tracing::warn!("Ollama quality evaluation returned error: {}", response.status());
            return Ok(None);
        }

        let json: serde_json::Value = match response.json().await {
            Ok(j) => j,
            Err(e) => {
                tracing::warn!("Failed to parse Ollama quality evaluation response: {}", e);
                return Ok(None);
            }
        };

        let content = json
            .get("response")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(content) {
            let clarity = parsed.get("clarity").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let answerability = parsed.get("answerability").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let factual_accuracy = parsed.get("factual_accuracy").and_then(|v| v.as_f64()).unwrap_or(0.5);
            let issues = parsed
                .get("issues")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                })
                .unwrap_or_default();

            let overall_score = (clarity + answerability + factual_accuracy) / 3.0;

            return Ok(Some(QualityAssessment {
                clarity_score: clarity,
                answerability_score: answerability,
                factual_accuracy_score: factual_accuracy,
                overall_score,
                issues,
            }));
        }

        Ok(None)
    }
}
