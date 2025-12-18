use crate::error::{AppError, Result};
use reqwest::Client;
use tokio_tungstenite::{connect_async, tungstenite::Message};
use futures::{SinkExt, StreamExt};
use tokio::sync::mpsc;
use base64::{Engine as _, engine::general_purpose};

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

/// Deepgram WebSocket streaming response types
/// These types match the JSON structure returned by Deepgram's WebSocket API
/// Reference: https://developers.deepgram.com/docs/streaming

#[derive(Debug, serde::Deserialize)]
struct DeepgramAlternative {
    transcript: String,
    confidence: f32,
}

#[derive(Debug, serde::Deserialize)]
struct DeepgramChannel {
    alternatives: Vec<DeepgramAlternative>,
}

#[derive(Debug, serde::Deserialize)]
struct DeepgramResponse {
    channel: DeepgramChannel,
    #[serde(default)]
    is_final: bool,
    #[serde(default)]
    speech_final: bool,
}

#[derive(Debug, serde::Deserialize)]
struct AssemblyAIResponse {
    message_type: String,
    text: String,
    #[serde(default)]
    confidence: f64,
}

/// Deepgram WebSocket streaming client
///
/// Provides true real-time streaming transcription using Deepgram's WebSocket API.
/// This implementation maintains a persistent WebSocket connection and streams audio
/// chunks as they arrive, receiving interim and final transcription results.
///
/// # Architecture
///
/// The streaming client uses a WebSocket connection to send audio chunks and receive
/// transcription results in real-time. Key differences from REST API:
///
/// - **Persistent connection**: Single WebSocket connection for entire session
/// - **Low latency**: No HTTP request/response overhead per chunk
/// - **Interim results**: Receive partial transcripts before speech is finished
/// - **True streaming**: Audio chunks sent as binary WebSocket messages
///
/// # Message Flow
///
/// 1. Client connects to `wss://api.deepgram.com/v1/listen` with query parameters
/// 2. Authentication via `Authorization: Token {api_key}` header
/// 3. Audio chunks sent as binary WebSocket messages
/// 4. Transcription results received as JSON messages with structure:
///    ```json
///    {
///      "channel": {
///        "alternatives": [
///          {
///            "transcript": "text here",
///            "confidence": 0.95
///          }
///        ]
///      },
///      "is_final": true,
///      "speech_final": true
///    }
///    ```
///
/// # Usage Example
///
/// ```rust,no_run
/// use quiz_backend::services::transcription::DeepgramStreamingClient;
///
/// async fn example() -> Result<(), Box<dyn std::error::Error>> {
///     let mut client = DeepgramStreamingClient::new("your-api-key".to_string());
///
///     // Establish WebSocket connection
///     client.connect().await?;
///
///     // Send audio chunks
///     let audio_chunk = vec![/* audio bytes */];
///     client.send_audio(audio_chunk).await?;
///
///     // Receive transcription results
///     while let Some(result) = client.receive_transcript().await? {
///         println!("Transcript: {} (final: {})", result.text, result.is_final);
///         if result.is_final {
///             break;
///         }
///     }
///
///     // Close connection
///     client.close().await?;
///     Ok(())
/// }
/// ```
///
/// # Error Handling
///
/// The client handles various error conditions:
/// - Connection failures (network issues, DNS errors)
/// - Authentication errors (invalid API key)
/// - Message parsing errors (malformed JSON)
/// - WebSocket close codes (server-initiated disconnection)
///
/// # Reconnection
///
/// Connection failures are reported as errors. The caller is responsible for
/// implementing reconnection logic based on application requirements.
pub struct DeepgramStreamingClient {
    api_key: String,
    ws_url: String,
    sender: Option<futures::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>>,
    receiver: Option<futures::stream::SplitStream<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>>,
}

impl DeepgramStreamingClient {
    /// Create a new Deepgram streaming client
    ///
    /// # Arguments
    ///
    /// * `api_key` - Deepgram API key for authentication
    ///
    /// # Panics
    ///
    /// Panics if the API key is empty
    pub fn new(api_key: String) -> Self {
        if api_key.is_empty() {
            tracing::error!("DeepgramStreamingClient created with empty API key");
            panic!("DeepgramStreamingClient requires a non-empty API key");
        }

        // Deepgram WebSocket endpoint with streaming parameters:
        // - model=nova-2: Latest Deepgram model
        // - punctuate=true: Add punctuation to transcripts
        // - interim_results=true: Send partial results before speech is final
        let ws_url = "wss://api.deepgram.com/v1/listen?model=nova-2&punctuate=true&interim_results=true".to_string();

        Self {
            api_key,
            ws_url,
            sender: None,
            receiver: None,
        }
    }

    /// Establish WebSocket connection to Deepgram
    ///
    /// This method creates a WebSocket connection with authentication and splits
    /// the stream into sender and receiver halves for bidirectional communication.
    ///
    /// # Authentication
    ///
    /// Deepgram uses HTTP header-based authentication with the format:
    /// `Authorization: Token {api_key}`
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Connection to Deepgram fails (network issues, DNS errors)
    /// - Authentication fails (invalid API key)
    /// - Already connected (call close() first)
    pub async fn connect(&mut self) -> Result<()> {
        if self.sender.is_some() || self.receiver.is_some() {
            return Err(AppError::Internal(
                "WebSocket already connected. Call close() first.".to_string(),
            ));
        }

        tracing::info!("Connecting to Deepgram WebSocket at {}", self.ws_url);

        // Build WebSocket request with authentication header
        let request = http::Request::builder()
            .uri(&self.ws_url)
            .header("Authorization", format!("Token {}", self.api_key))
            .body(())
            .map_err(|e| AppError::Internal(format!("Failed to build WebSocket request: {}", e)))?;

        // Connect to WebSocket endpoint
        let (ws_stream, response) = connect_async(request)
            .await
            .map_err(|e| AppError::Internal(format!("WebSocket connection failed: {}", e)))?;

        // Check response status (should be 101 Switching Protocols)
        let status = response.status();
        if status != 101 {
            return Err(AppError::Internal(format!(
                "WebSocket handshake failed with status: {}",
                status
            )));
        }

        tracing::info!("Connected to Deepgram WebSocket successfully");

        // Split stream into sender and receiver for independent operations
        let (sender, receiver) = ws_stream.split();
        self.sender = Some(sender);
        self.receiver = Some(receiver);

        Ok(())
    }

    /// Send audio chunk to Deepgram for transcription
    ///
    /// Audio chunks are sent as binary WebSocket messages. Deepgram processes
    /// the audio stream and returns transcription results asynchronously.
    ///
    /// # Arguments
    ///
    /// * `audio_chunk` - Audio data bytes (typically WebM or raw audio format)
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (call connect() first)
    /// - WebSocket send fails (connection dropped)
    pub async fn send_audio(&mut self, audio_chunk: Vec<u8>) -> Result<()> {
        let sender = self
            .sender
            .as_mut()
            .ok_or_else(|| AppError::Internal("Not connected. Call connect() first.".to_string()))?;

        tracing::debug!("Sending audio chunk of {} bytes", audio_chunk.len());

        // Send audio as binary WebSocket message
        sender
            .send(Message::Binary(audio_chunk))
            .await
            .map_err(|e| AppError::Internal(format!("Failed to send audio chunk: {}", e)))?;

        Ok(())
    }

    /// Receive transcription result from Deepgram
    ///
    /// This method reads the next WebSocket message from Deepgram and parses it
    /// into a `TranscriptionResult`. Deepgram sends two types of results:
    ///
    /// - **Interim results**: Partial transcripts while user is still speaking
    ///   (is_final=false). These can change as more audio is processed.
    /// - **Final results**: Completed transcripts for finished speech segments
    ///   (is_final=true). These are the authoritative transcripts.
    ///
    /// # Returns
    ///
    /// - `Ok(Some(result))` - Transcription result received
    /// - `Ok(None)` - Connection closed normally
    /// - `Err(...)` - Error occurred
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (call connect() first)
    /// - JSON parsing fails (malformed response)
    /// - WebSocket error (connection dropped)
    pub async fn receive_transcript(&mut self) -> Result<Option<TranscriptionResult>> {
        let receiver = self.receiver.as_mut().ok_or_else(|| {
            AppError::Internal("Not connected. Call connect() first.".to_string())
        })?;

        // Read next WebSocket message
        match receiver.next().await {
            Some(Ok(message)) => match message {
                Message::Text(text) => {
                    tracing::debug!("Received text message: {}", text);

                    // Parse JSON response from Deepgram
                    let response: DeepgramResponse = serde_json::from_str(&text).map_err(|e| {
                        AppError::Internal(format!("Failed to parse Deepgram response: {}", e))
                    })?;

                    // Extract transcript from first alternative
                    let transcript = response
                        .channel
                        .alternatives
                        .first()
                        .map(|alt| alt.transcript.clone())
                        .unwrap_or_default();

                    let confidence = response
                        .channel
                        .alternatives
                        .first()
                        .map(|alt| alt.confidence);

                    // Skip empty transcripts (Deepgram sometimes sends these)
                    if transcript.is_empty() {
                        tracing::debug!("Skipping empty transcript");
                        return self.receive_transcript().await;
                    }

                    Ok(Some(TranscriptionResult {
                        text: transcript,
                        is_final: response.is_final,
                        confidence,
                    }))
                }
                Message::Close(frame) => {
                    tracing::info!("WebSocket closed by server: {:?}", frame);
                    Ok(None)
                }
                Message::Ping(_) | Message::Pong(_) => {
                    // Automatically handled by tungstenite, just continue
                    self.receive_transcript().await
                }
                _ => {
                    tracing::debug!("Ignoring non-text message");
                    self.receive_transcript().await
                }
            },
            Some(Err(e)) => {
                tracing::error!("WebSocket error: {}", e);
                Err(AppError::Internal(format!("WebSocket error: {}", e)))
            }
            None => {
                tracing::info!("WebSocket stream ended");
                Ok(None)
            }
        }
    }

    /// Close the WebSocket connection
    ///
    /// Sends a close frame to Deepgram and cleans up connection resources.
    /// It's good practice to call this when done with transcription, though
    /// the connection will be automatically closed when the client is dropped.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (already closed)
    /// - Close frame send fails
    pub async fn close(&mut self) -> Result<()> {
        if let Some(mut sender) = self.sender.take() {
            tracing::info!("Closing Deepgram WebSocket connection");

            // Send close frame
            sender
                .send(Message::Close(None))
                .await
                .map_err(|e| AppError::Internal(format!("Failed to send close frame: {}", e)))?;

            // Close the sender
            sender
                .close()
                .await
                .map_err(|e| AppError::Internal(format!("Failed to close WebSocket: {}", e)))?;
        }

        // Drop receiver to complete cleanup
        self.receiver = None;

        tracing::info!("Deepgram WebSocket connection closed");
        Ok(())
    }
}

/// AssemblyAI WebSocket streaming client
///
/// Provides real-time streaming transcription using AssemblyAI's WebSocket API.
/// This implementation maintains a persistent WebSocket connection and streams audio
/// chunks as they arrive, receiving partial and final transcription results.
///
/// # Architecture
///
/// The streaming client uses a WebSocket connection to send audio chunks and receive
/// transcription results in real-time. Key characteristics:
///
/// - **Persistent connection**: Single WebSocket connection for entire session
/// - **Base64 encoding**: Audio chunks encoded as base64 and sent as JSON messages
/// - **Interim results**: Receive partial transcripts (PartialTranscript) before speech is finished
/// - **Final results**: Receive completed transcripts (FinalTranscript) for finished segments
///
/// # Message Flow
///
/// 1. Client connects to `wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000`
/// 2. Authentication via `Authorization: {api_key}` header (no "Token" prefix)
/// 3. Audio chunks sent as JSON text messages: `{"audio_data": "<base64>"}`
/// 4. Transcription results received as JSON messages with structure:
///    ```json
///    {
///      "message_type": "PartialTranscript" | "FinalTranscript",
///      "text": "transcript text",
///      "confidence": 0.95
///    }
///    ```
/// 5. Session terminated by sending: `{"terminate_session": true}`
///
/// # Usage Example
///
/// ```rust,no_run
/// use quiz_backend::services::transcription::AssemblyAIStreamingClient;
///
/// async fn example() -> Result<(), Box<dyn std::error::Error>> {
///     let mut client = AssemblyAIStreamingClient::new("your-api-key".to_string());
///
///     // Establish WebSocket connection
///     client.connect().await?;
///
///     // Send audio chunks
///     let audio_chunk = vec![/* audio bytes */];
///     client.send_audio(audio_chunk).await?;
///
///     // Receive transcription results
///     while let Some(result) = client.receive_transcript().await? {
///         println!("Transcript: {} (final: {})", result.text, result.is_final);
///         if result.is_final {
///             break;
///         }
///     }
///
///     // Close connection
///     client.close().await?;
///     Ok(())
/// }
/// ```
pub struct AssemblyAIStreamingClient {
    api_key: String,
    ws_url: String,
    sender: Option<futures::stream::SplitSink<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>, Message>>,
    receiver: Option<futures::stream::SplitStream<tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>>>,
}

impl AssemblyAIStreamingClient {
    /// Create a new AssemblyAI streaming client
    ///
    /// # Arguments
    ///
    /// * `api_key` - AssemblyAI API key for authentication
    ///
    /// # Panics
    ///
    /// Panics if the API key is empty
    pub fn new(api_key: String) -> Self {
        if api_key.is_empty() {
            tracing::error!("AssemblyAIStreamingClient created with empty API key");
            panic!("AssemblyAIStreamingClient requires a non-empty API key");
        }

        // AssemblyAI WebSocket endpoint with sample rate parameter
        let ws_url = "wss://api.assemblyai.com/v2/realtime/ws?sample_rate=16000".to_string();

        Self {
            api_key,
            ws_url,
            sender: None,
            receiver: None,
        }
    }

    /// Establish WebSocket connection to AssemblyAI
    ///
    /// This method creates a WebSocket connection with authentication and splits
    /// the stream into sender and receiver halves for bidirectional communication.
    ///
    /// # Authentication
    ///
    /// AssemblyAI uses HTTP header-based authentication with the format:
    /// `Authorization: {api_key}` (no "Token" prefix)
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Connection to AssemblyAI fails (network issues, DNS errors)
    /// - Authentication fails (invalid API key)
    /// - Already connected (call close() first)
    pub async fn connect(&mut self) -> Result<()> {
        if self.sender.is_some() || self.receiver.is_some() {
            return Err(AppError::Internal(
                "WebSocket already connected. Call close() first.".to_string(),
            ));
        }

        tracing::info!("Connecting to AssemblyAI WebSocket at {}", self.ws_url);

        // Build WebSocket request with authentication header
        let request = http::Request::builder()
            .uri(&self.ws_url)
            .header("Authorization", &self.api_key)
            .body(())
            .map_err(|e| AppError::Internal(format!("Failed to build WebSocket request: {}", e)))?;

        // Connect to WebSocket endpoint
        let (ws_stream, response) = connect_async(request)
            .await
            .map_err(|e| AppError::Internal(format!("WebSocket connection failed: {}", e)))?;

        // Check response status (should be 101 Switching Protocols)
        let status = response.status();
        if status != 101 {
            return Err(AppError::Internal(format!(
                "WebSocket handshake failed with status: {}",
                status
            )));
        }

        tracing::info!("Connected to AssemblyAI WebSocket successfully");

        // Split stream into sender and receiver for independent operations
        let (sender, receiver) = ws_stream.split();
        self.sender = Some(sender);
        self.receiver = Some(receiver);

        Ok(())
    }

    /// Send audio chunk to AssemblyAI for transcription
    ///
    /// Audio chunks are base64 encoded and sent as JSON text messages in the format:
    /// `{"audio_data": "<base64_encoded_audio>"}`
    ///
    /// AssemblyAI processes the audio stream and returns transcription results asynchronously.
    ///
    /// # Arguments
    ///
    /// * `audio_chunk` - Audio data bytes (16kHz PCM or compatible format)
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (call connect() first)
    /// - WebSocket send fails (connection dropped)
    pub async fn send_audio(&mut self, audio_chunk: Vec<u8>) -> Result<()> {
        let sender = self
            .sender
            .as_mut()
            .ok_or_else(|| AppError::Internal("Not connected. Call connect() first.".to_string()))?;

        tracing::debug!("Sending audio chunk of {} bytes", audio_chunk.len());

        // Encode audio as base64
        let encoded = general_purpose::STANDARD.encode(&audio_chunk);

        // Create JSON message with base64 encoded audio
        let message = serde_json::json!({
            "audio_data": encoded
        });

        let message_text = serde_json::to_string(&message)
            .map_err(|e| AppError::Internal(format!("Failed to serialize audio message: {}", e)))?;

        // Send as text WebSocket message
        sender
            .send(Message::Text(message_text))
            .await
            .map_err(|e| AppError::Internal(format!("Failed to send audio chunk: {}", e)))?;

        Ok(())
    }

    /// Receive transcription result from AssemblyAI
    ///
    /// This method reads the next WebSocket message from AssemblyAI and parses it
    /// into a `TranscriptionResult`. AssemblyAI sends two types of results:
    ///
    /// - **PartialTranscript**: Interim transcripts while user is still speaking
    ///   (is_final=false). These can change as more audio is processed.
    /// - **FinalTranscript**: Completed transcripts for finished speech segments
    ///   (is_final=true). These are the authoritative transcripts.
    ///
    /// # Returns
    ///
    /// - `Ok(Some(result))` - Transcription result received
    /// - `Ok(None)` - Connection closed normally
    /// - `Err(...)` - Error occurred
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (call connect() first)
    /// - JSON parsing fails (malformed response)
    /// - WebSocket error (connection dropped)
    pub async fn receive_transcript(&mut self) -> Result<Option<TranscriptionResult>> {
        let receiver = self.receiver.as_mut().ok_or_else(|| {
            AppError::Internal("Not connected. Call connect() first.".to_string())
        })?;

        // Read next WebSocket message
        match receiver.next().await {
            Some(Ok(message)) => match message {
                Message::Text(text) => {
                    tracing::debug!("Received text message: {}", text);

                    // Parse JSON response from AssemblyAI
                    let response: AssemblyAIResponse = serde_json::from_str(&text).map_err(|e| {
                        AppError::Internal(format!("Failed to parse AssemblyAI response: {}", e))
                    })?;

                    // Skip empty transcripts
                    if response.text.is_empty() {
                        tracing::debug!("Skipping empty transcript");
                        return self.receive_transcript().await;
                    }

                    // Determine if this is a final transcript based on message_type
                    let is_final = response.message_type == "FinalTranscript";

                    Ok(Some(TranscriptionResult {
                        text: response.text,
                        is_final,
                        confidence: Some(response.confidence as f32),
                    }))
                }
                Message::Close(frame) => {
                    tracing::info!("WebSocket closed by server: {:?}", frame);
                    Ok(None)
                }
                Message::Ping(_) | Message::Pong(_) => {
                    // Automatically handled by tungstenite, just continue
                    self.receive_transcript().await
                }
                _ => {
                    tracing::debug!("Ignoring non-text message");
                    self.receive_transcript().await
                }
            },
            Some(Err(e)) => {
                tracing::error!("WebSocket error: {}", e);
                Err(AppError::Internal(format!("WebSocket error: {}", e)))
            }
            None => {
                tracing::info!("WebSocket stream ended");
                Ok(None)
            }
        }
    }

    /// Close the WebSocket connection
    ///
    /// Sends a terminate_session message to AssemblyAI and cleans up connection resources.
    /// AssemblyAI requires sending `{"terminate_session": true}` instead of a standard
    /// WebSocket close frame.
    ///
    /// # Errors
    ///
    /// Returns an error if:
    /// - Not connected (already closed)
    /// - Terminate message send fails
    pub async fn close(&mut self) -> Result<()> {
        if let Some(mut sender) = self.sender.take() {
            tracing::info!("Closing AssemblyAI WebSocket connection");

            // Create terminate session message
            let terminate_message = serde_json::json!({
                "terminate_session": true
            });

            let message_text = serde_json::to_string(&terminate_message)
                .map_err(|e| AppError::Internal(format!("Failed to serialize terminate message: {}", e)))?;

            // Send terminate session message
            sender
                .send(Message::Text(message_text))
                .await
                .map_err(|e| AppError::Internal(format!("Failed to send terminate message: {}", e)))?;

            // Close the sender
            sender
                .close()
                .await
                .map_err(|e| AppError::Internal(format!("Failed to close WebSocket: {}", e)))?;
        }

        // Drop receiver to complete cleanup
        self.receiver = None;

        tracing::info!("AssemblyAI WebSocket connection closed");
        Ok(())
    }
}
