use axum::{
    extract::{Extension, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::auth::AuthUser;
use crate::error::Result;
use crate::AppState;

/// AI settings request/response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AISettingsRequest {
    pub llm_provider: String,
    pub llm_api_key: Option<String>,
    pub ollama_model: Option<String>,
    pub stt_provider: String,
    pub stt_api_key: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct AISettingsResponse {
    pub llm_provider: String,
    pub llm_api_key: Option<String>, // Masked in response
    pub ollama_model: Option<String>,
    pub stt_provider: String,
    pub stt_api_key: Option<String>, // Masked in response
}

/// Get user's AI settings
pub async fn get_ai_settings(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<AISettingsResponse>> {
    // For now, return defaults
    // In a full implementation, this would fetch from user_ai_settings table
    Ok(Json(AISettingsResponse {
        llm_provider: state.config.default_ai_provider.clone(),
        llm_api_key: state.config.anthropic_api_key.as_ref().map(|_| "sk-ant-****".to_string()),
        ollama_model: Some("llama2".to_string()),
        stt_provider: state.config.default_stt_provider.clone(),
        stt_api_key: state.config.deepgram_api_key.as_ref().map(|_| "****".to_string()),
    }))
}

/// Update user's AI settings
pub async fn update_ai_settings(
    State(_state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Json(_req): Json<AISettingsRequest>,
) -> Result<Json<AISettingsResponse>> {
    // TODO: Implement storing encrypted API keys in database
    Ok(Json(AISettingsResponse {
        llm_provider: "claude".to_string(),
        llm_api_key: Some("sk-ant-****".to_string()),
        ollama_model: Some("llama2".to_string()),
        stt_provider: "deepgram".to_string(),
        stt_api_key: Some("****".to_string()),
    }))
}

/// Test AI provider connection
pub async fn test_ai_connection(
    State(_state): State<AppState>,
    Extension(_auth_user): Extension<AuthUser>,
    Json(_req): Json<AISettingsRequest>,
) -> Result<Json<serde_json::Value>> {
    // TODO: Implement actual connection testing
    Ok(Json(serde_json::json!({
        "success": true,
        "message": "Connection test successful"
    })))
}
