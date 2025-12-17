use crate::error::{AppError, Result};
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
    ) -> Result<Option<GeneratedQuestion>>;
}

/// Generated question from transcript analysis
#[derive(Debug, Clone)]
pub struct GeneratedQuestion {
    pub question: String,
    pub correct_answer: String,
    pub topic_summary: String,
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
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            // Not enough content to generate a question
            return Ok(None);
        }

        let client = Client::new();
        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{}\n\nThe new content is:\n\n{}\n\nIf this new content completes a clear topic or concept that can be tested with a quiz question, generate a multiple-choice question about it. Return your response as JSON with keys: question, correct_answer, topic_summary. If no good question can be generated, return null.",
            transcript_context, new_transcript
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
                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                }));
            }
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
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            return Ok(None);
        }

        let client = Client::new();
        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{}\n\nThe new content is:\n\n{}\n\nIf this new content completes a clear topic or concept that can be tested with a quiz question, generate a multiple-choice question about it. Return your response as JSON with keys: question, correct_answer, topic_summary. If no good question can be generated, return null.",
            transcript_context, new_transcript
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
                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                }));
            }
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
    ) -> Result<Option<GeneratedQuestion>> {
        if new_transcript.trim().len() < 50 {
            return Ok(None);
        }

        let client = Client::new();

        let prompt = format!(
            "You are analyzing a live presentation transcript. The previous context was:\n\n{ctx}\n\n\
             The new content is:\n\n{new}\n\n\
             If this new content completes a clear topic or concept that can be tested with a quiz question, \
             generate a multiple-choice question about it.\n\n\
             Return your response strictly as JSON with keys: question, correct_answer, topic_summary.\n\
             If no good question can be generated, return null.",
            ctx = transcript_context,
            new = new_transcript
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
                return Ok(Some(GeneratedQuestion {
                    question: question.to_string(),
                    correct_answer: answer.to_string(),
                    topic_summary: parsed
                        .get("topic_summary")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_string(),
                }));
            }
        }

        Ok(None)
    }
}
