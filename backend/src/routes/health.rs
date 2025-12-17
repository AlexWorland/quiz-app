use axum::{extract::State, Json};
use serde::Serialize;

use crate::AppState;

#[derive(Serialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: bool,
    pub providers: ProviderStatus,
}

#[derive(Serialize)]
pub struct ProviderStatus {
    pub llm_providers: LlmProviderStatus,
    pub stt_providers: SttProviderStatus,
}

#[derive(Serialize)]
pub struct LlmProviderStatus {
    pub claude: String,
    pub openai: String,
    pub ollama: String,
}

#[derive(Serialize)]
pub struct SttProviderStatus {
    pub deepgram: String,
    pub whisper: String,
    pub assemblyai: String,
}

/// Health check endpoint
pub async fn health_check(State(state): State<AppState>) -> Json<HealthResponse> {
    let db_healthy = crate::db::health_check(&state.db).await;

    // Check LLM provider configuration
    let llm_providers = LlmProviderStatus {
        claude: if state.config.anthropic_api_key.is_some() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
        openai: if state.config.openai_api_key.is_some() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
        ollama: if !state.config.ollama_base_url.is_empty() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
    };

    // Check STT provider configuration
    let stt_providers = SttProviderStatus {
        deepgram: if state.config.deepgram_api_key.is_some() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
        whisper: if state.config.openai_api_key.is_some() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
        assemblyai: if state.config.assemblyai_api_key.is_some() {
            "configured".to_string()
        } else {
            "not_configured".to_string()
        },
    };

    Json(HealthResponse {
        status: if db_healthy { "healthy" } else { "degraded" }.to_string(),
        database: db_healthy,
        providers: ProviderStatus {
            llm_providers,
            stt_providers,
        },
    })
}
