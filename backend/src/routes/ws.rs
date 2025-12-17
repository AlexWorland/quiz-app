use axum::{
    extract::{ConnectInfo, Path, State, WebSocketUpgrade},
    response::IntoResponse,
};
use std::net::SocketAddr;

use crate::error::Result;
use crate::AppState;

/// WebSocket handler for game sessions
pub async fn ws_handler(
    State(state): State<AppState>,
    Path(session_code): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<impl IntoResponse> {
    tracing::info!("WebSocket connection from {} for session {}", addr, session_code);

    Ok(ws.on_upgrade(move |socket| {
        crate::ws::handler::handle_ws_connection(socket, session_code, state)
    }))
}

/// WebSocket handler for audio streaming
pub async fn audio_ws_handler(
    State(state): State<AppState>,
    Path(quiz_id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<impl IntoResponse> {
    tracing::info!("Audio WebSocket connection from {} for quiz {}", addr, quiz_id);

    Ok(ws.on_upgrade(move |socket| {
        crate::ws::handler::handle_audio_connection(socket, quiz_id, state)
    }))
}
