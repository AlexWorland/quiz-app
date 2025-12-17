use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: bool,
}

/// Health check endpoint
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_healthy = crate::db::health_check(&state.db).await;

    Json(HealthResponse {
        status: if db_healthy { "healthy" } else { "degraded" }.to_string(),
        database: db_healthy,
    })
}
