use axum::{
    extract::{ConnectInfo, Path, State, WebSocketUpgrade},
    response::IntoResponse,
};
use std::net::SocketAddr;

use crate::error::Result;
use crate::AppState;

/// WebSocket handler for game sessions (uses event_id)
pub async fn ws_handler(
    State(state): State<AppState>,
    Path(event_id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<impl IntoResponse> {
    tracing::info!("WebSocket connection from {} for event {}", addr, event_id);

    Ok(ws.on_upgrade(move |socket| {
        crate::ws::handler::handle_ws_connection(socket, event_id, state)
    }))
}

/// WebSocket handler for audio streaming (uses segment_id)
pub async fn audio_ws_handler(
    State(state): State<AppState>,
    Path(segment_id): Path<String>,
    ws: WebSocketUpgrade,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
) -> Result<impl IntoResponse> {
    tracing::info!("Audio WebSocket connection from {} for segment {}", addr, segment_id);

    Ok(ws.on_upgrade(move |socket| {
        crate::ws::handler::handle_audio_connection(socket, segment_id, state)
    }))
}
