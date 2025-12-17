use crate::error::{AppError, Result};
use reqwest::Client;

/// Speech-to-text provider trait
#[async_trait::async_trait]
pub trait TranscriptionProvider: Send + Sync {
    /// Transcribe audio bytes
    async fn transcribe(&self, audio_data: Vec<u8>) -> Result<String>;

    /// Stream transcription for real-time processing
    async fn stream_transcribe(&self, audio_data: Vec<u8>) -> Result<TranscriptionResult>;
}

/// Transcription result
#[derive(Debug, Clone)]
pub struct TranscriptionResult {
    pub text: String,
    pub is_final: bool,
    pub confidence: Option<f32>,
}

/// OpenAI Whisper provider
pub struct WhisperProvider {
    api_key: String,
}

impl WhisperProvider {
    pub fn new(api_key: String) -> Self {
        if api_key.is_empty() {
            tracing::error!("WhisperProvider created with empty API key");
            panic!("WhisperProvider requires a non-empty API key");
        }
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl TranscriptionProvider for WhisperProvider {
    async fn transcribe(&self, audio_data: Vec<u8>) -> Result<String> {
        // Simple non-streaming Whisper transcription
        let client = Client::new();

        let form = reqwest::multipart::Form::new()
            .text("model", "whisper-1")
            .part(
                "file",
                reqwest::multipart::Part::bytes(audio_data)
                    .file_name("audio.webm")
                    .mime_str("audio/webm")
                    .map_err(|e| AppError::Internal(format!("Failed to build multipart: {}", e)))?,
            );

        let response = client
            .post("https://api.openai.com/v1/audio/transcriptions")
            .header("Authorization", format!("Bearer {}", self.api_key))
            .multipart(form)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Whisper API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Whisper API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Whisper response: {}", e)))?;

        let transcript = json
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(transcript)
    }

    async fn stream_transcribe(&self, audio_data: Vec<u8>) -> Result<TranscriptionResult> {
        // Pseudo-streaming implementation
        // 
        // Why pseudo-streaming?
        // OpenAI's Whisper API does not support WebSocket-based streaming transcription.
        // The API only accepts complete audio files via multipart/form-data POST requests.
        // 
        // Current behavior:
        // - Accepts audio chunks as they arrive
        // - Makes a complete API call for each chunk
        // - Returns result as "final" (since Whisper doesn't provide interim results)
        // 
        // Limitations:
        // - Not true real-time streaming (each chunk requires a full API round-trip)
        // - No interim/partial results (Whisper API doesn't support this)
        // - Higher latency compared to true streaming providers
        // 
        // TODO: Future enhancement - True streaming transcription
        // To implement real streaming, consider:
        // 1. Using a provider with WebSocket support (e.g., Deepgram Streaming API, AssemblyAI Streaming)
        // 2. Maintaining WebSocket connections for low-latency streaming
        // 3. Handling interim results and final results separately
        // 4. Buffering audio chunks appropriately for the provider's requirements
        // 
        // References:
        // - OpenAI Whisper API: https://platform.openai.com/docs/guides/speech-to-text
        // - Deepgram Streaming: https://developers.deepgram.com/docs/streaming-overview
        // - AssemblyAI Streaming: https://www.assemblyai.com/docs/guides/streaming
        let text = self.transcribe(audio_data).await?;
        Ok(TranscriptionResult {
            text,
            is_final: true,
            confidence: None,
        })
    }
}

/// Deepgram provider
pub struct DeepgramProvider {
    api_key: String,
}

impl DeepgramProvider {
    pub fn new(api_key: String) -> Self {
        if api_key.is_empty() {
            tracing::error!("DeepgramProvider created with empty API key");
            panic!("DeepgramProvider requires a non-empty API key");
        }
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl TranscriptionProvider for DeepgramProvider {
    async fn transcribe(&self, audio_data: Vec<u8>) -> Result<String> {
        let client = Client::new();
        let response = client
            .post("https://api.deepgram.com/v1/listen")
            .header("Authorization", format!("Token {}", self.api_key))
            .header("Content-Type", "audio/webm")
            .body(audio_data)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Deepgram API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Deepgram API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Deepgram response: {}", e)))?;

        let transcript = json
            .pointer("/results/channels/0/alternatives/0/transcript")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(transcript)
    }

    async fn stream_transcribe(&self, audio_data: Vec<u8>) -> Result<TranscriptionResult> {
        // Deepgram streaming implementation
        // 
        // Note: This implementation uses Deepgram's REST API with streaming parameters,
        // but it's still pseudo-streaming since we're making HTTP POST requests per chunk.
        // 
        // For true streaming with Deepgram:
        // - Use Deepgram's WebSocket API (wss://api.deepgram.com/v1/listen)
        // - Maintain persistent WebSocket connection
        // - Send audio chunks as they arrive
        // - Receive interim and final results via WebSocket messages
        // 
        // Current implementation:
        // - Uses REST API with interim_results=true parameter
        // - Each chunk requires a full HTTP request/response cycle
        // - Provides interim results when available, but with higher latency than WebSocket
        let client = Client::new();
        let response = client
            .post("https://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true")
            .header("Authorization", format!("Token {}", self.api_key))
            .header("Content-Type", "audio/webm")
            .body(audio_data)
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Deepgram API error: {}", e)))?;

        if !response.status().is_success() {
            return Err(AppError::Internal(format!(
                "Deepgram API returned error: {}",
                response.status()
            )));
        }

        let json: serde_json::Value = response
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse Deepgram response: {}", e)))?;

        let transcript = json
            .pointer("/results/channels/0/alternatives/0/transcript")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        let is_final = json
            .pointer("/is_final")
            .and_then(|v| v.as_bool())
            .unwrap_or(true);

        let confidence = json
            .pointer("/results/channels/0/alternatives/0/confidence")
            .and_then(|v| v.as_f64());

        Ok(TranscriptionResult {
            text: transcript,
            is_final,
            confidence: confidence.map(|c| c as f32),
        })
    }
}

/// AssemblyAI provider
pub struct AssemblyAIProvider {
    api_key: String,
}

impl AssemblyAIProvider {
    pub fn new(api_key: String) -> Self {
        if api_key.is_empty() {
            tracing::error!("AssemblyAIProvider created with empty API key");
            panic!("AssemblyAIProvider requires a non-empty API key");
        }
        Self { api_key }
    }
}

#[async_trait::async_trait]
impl TranscriptionProvider for AssemblyAIProvider {
    async fn transcribe(&self, audio_data: Vec<u8>) -> Result<String> {
        let client = Client::new();

        // Upload audio
        let upload_res = client
            .post("https://api.assemblyai.com/v2/upload")
            .header("Authorization", &self.api_key)
            .body(audio_data.clone())
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("AssemblyAI upload error: {}", e)))?;

        if !upload_res.status().is_success() {
            return Err(AppError::Internal(format!(
                "AssemblyAI upload returned error: {}",
                upload_res.status()
            )));
        }

        let upload_json: serde_json::Value = upload_res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse AssemblyAI upload response: {}", e)))?;

        let audio_url = upload_json
            .get("upload_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| AppError::Internal("AssemblyAI upload_url missing".to_string()))?
            .to_string();

        // Request transcript
        let transcript_res = client
            .post("https://api.assemblyai.com/v2/transcript")
            .header("Authorization", &self.api_key)
            .json(&serde_json::json!({ "audio_url": audio_url }))
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("AssemblyAI transcript error: {}", e)))?;

        if !transcript_res.status().is_success() {
            return Err(AppError::Internal(format!(
                "AssemblyAI transcript returned error: {}",
                transcript_res.status()
            )));
        }

        let transcript_json: serde_json::Value = transcript_res
            .json()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to parse AssemblyAI transcript response: {}", e)))?;

        let text = transcript_json
            .get("text")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        Ok(text)
    }

    async fn stream_transcribe(&self, audio_data: Vec<u8>) -> Result<TranscriptionResult> {
        // Pseudo-streaming implementation for AssemblyAI
        // 
        // Why pseudo-streaming?
        // While AssemblyAI supports WebSocket-based streaming transcription, this implementation
        // uses the standard REST API for simplicity and consistency with other providers.
        // 
        // Current behavior:
        // - Accepts audio chunks as they arrive
        // - Uploads audio and requests transcription via REST API
        // - Returns result as "final" (no interim results with REST API)
        // 
        // TODO: Future enhancement - True streaming with AssemblyAI WebSocket API
        // To implement real streaming with AssemblyAI:
        // 1. Use AssemblyAI's WebSocket endpoint (wss://api.assemblyai.com/v2/realtime/ws)
        // 2. Establish WebSocket connection with sample_rate and encoding parameters
        // 3. Send audio chunks as binary messages
        // 4. Receive interim and final results via WebSocket messages
        // 5. Handle connection lifecycle (connect, send, receive, close)
        // 
        // References:
        // - AssemblyAI Streaming: https://www.assemblyai.com/docs/guides/streaming
        // - AssemblyAI WebSocket API: https://www.assemblyai.com/docs/reference/streaming
        let text = self.transcribe(audio_data).await?;
        Ok(TranscriptionResult {
            text,
            is_final: true,
            confidence: None,
        })
    }
}
