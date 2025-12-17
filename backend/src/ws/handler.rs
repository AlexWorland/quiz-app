use axum::extract::ws::{WebSocket, Message};
use futures::{SinkExt, StreamExt};
use serde_json::json;

use crate::AppState;

/// Handle incoming WebSocket connections for game sessions
pub async fn handle_ws_connection(
    socket: WebSocket,
    _session_code: String,
    _state: AppState,
) {
    let (mut sender, mut receiver) = socket.split();

    // Send welcome message
    let welcome = json!({
        "type": "connected",
        "message": "Connected to game session"
    });

    if sender
        .send(Message::Text(welcome.to_string()))
        .await
        .is_err()
    {
        tracing::error!("Failed to send welcome message");
        return;
    }

    // Handle incoming messages
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Text(text) => {
                tracing::debug!("Received message: {}", text);
                // TODO: Parse and handle game messages
            }
            Message::Binary(_) => {
                // TODO: Handle binary audio data
            }
            Message::Close(_) => {
                tracing::info!("Client disconnected");
                break;
            }
            _ => {}
        }
    }
}

/// Handle audio WebSocket connections for live transcription
pub async fn handle_audio_connection(
    socket: WebSocket,
    _quiz_id: String,
    _state: AppState,
) {
    let (mut sender, mut receiver) = socket.split();

    // Send connection confirmation
    let connected = json!({
        "type": "audio_connected",
        "message": "Ready to receive audio"
    });

    if sender
        .send(Message::Text(connected.to_string()))
        .await
        .is_err()
    {
        tracing::error!("Failed to send audio connection message");
        return;
    }

    // Handle incoming audio chunks
    while let Some(Ok(msg)) = receiver.next().await {
        match msg {
            Message::Binary(data) => {
                tracing::debug!("Received {} bytes of audio", data.len());
                // TODO: Send to transcription service
            }
            Message::Text(text) => {
                // Handle control messages (like audio_stop)
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&text) {
                    if parsed.get("type").and_then(|v| v.as_str()) == Some("audio_stop") {
                        tracing::info!("Audio stream ended");
                        break;
                    }
                }
            }
            Message::Close(_) => {
                tracing::info!("Audio connection closed");
                break;
            }
            _ => {}
        }
    }
}
