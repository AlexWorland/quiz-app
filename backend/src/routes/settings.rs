use axum::{
    extract::{Extension, State},
    Json,
};
use serde::{Deserialize, Serialize};

use crate::auth::AuthUser;
use crate::error::Result;
use crate::AppState;
use crate::services::crypto::{encrypt_string, decrypt_string};
use crate::services::ai::AIProvider;
use crate::services::transcription::TranscriptionProvider;

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
    // Fetch from user_ai_settings if present, otherwise fall back to config defaults
    let row: Option<(String, Option<String>, Option<String>, String, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT llm_provider, llm_api_key_encrypted, ollama_model, stt_provider, stt_api_key_encrypted
            FROM user_ai_settings
            WHERE user_id = $1
            "#,
        )
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?;

    let (llm_provider, llm_api_key_masked, ollama_model, stt_provider, stt_api_key_masked) =
        if let Some((llm_provider, llm_key_enc, ollama_model, stt_provider, stt_key_enc)) = row {
            (
                llm_provider,
                llm_key_enc.map(|_| "****".to_string()),
                ollama_model,
                stt_provider,
                stt_key_enc.map(|_| "****".to_string()),
            )
        } else {
            (
                state.config.default_ai_provider.clone(),
                state
                    .config
                    .anthropic_api_key
                    .as_ref()
                    .map(|_| "sk-ant-****".to_string()),
                Some("llama2".to_string()),
                state.config.default_stt_provider.clone(),
                state
                    .config
                    .deepgram_api_key
                    .as_ref()
                    .map(|_| "****".to_string()),
            )
        };

    Ok(Json(AISettingsResponse {
        llm_provider,
        llm_api_key: llm_api_key_masked,
        ollama_model,
        stt_provider,
        stt_api_key: stt_api_key_masked,
    }))
}

/// Update user's AI settings
pub async fn update_ai_settings(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<AISettingsRequest>,
) -> Result<Json<AISettingsResponse>> {
    let key = &state.config.encryption_key;

    let llm_key_encrypted = if let Some(ref k) = req.llm_api_key {
        Some(encrypt_string(k, key)?)
    } else {
        None
    };

    let stt_key_encrypted = if let Some(ref k) = req.stt_api_key {
        Some(encrypt_string(k, key)?)
    } else {
        None
    };

    // Upsert into user_ai_settings
    sqlx::query(
        r#"
        INSERT INTO user_ai_settings (user_id, llm_provider, llm_api_key_encrypted, ollama_model, stt_provider, stt_api_key_encrypted)
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (user_id) DO UPDATE
        SET llm_provider = EXCLUDED.llm_provider,
            llm_api_key_encrypted = EXCLUDED.llm_api_key_encrypted,
            ollama_model = EXCLUDED.ollama_model,
            stt_provider = EXCLUDED.stt_provider,
            stt_api_key_encrypted = EXCLUDED.stt_api_key_encrypted
        "#,
    )
    .bind(auth_user.id)
    .bind(&req.llm_provider)
    .bind(llm_key_encrypted)
    .bind(&req.ollama_model)
    .bind(&req.stt_provider)
    .bind(stt_key_encrypted)
    .execute(&state.db)
    .await?;

    Ok(Json(AISettingsResponse {
        llm_provider: req.llm_provider,
        llm_api_key: req.llm_api_key.as_ref().map(|_| "****".to_string()),
        ollama_model: req.ollama_model,
        stt_provider: req.stt_provider,
        stt_api_key: req.stt_api_key.as_ref().map(|_| "****".to_string()),
    }))
}

/// Test AI provider connection
pub async fn test_ai_connection(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<AISettingsRequest>,
) -> Result<Json<serde_json::Value>> {
    // Resolve effective settings (per-user or config fallback)
    let key = &state.config.encryption_key;

    let row: Option<(String, Option<String>, Option<String>, String, Option<String>)> =
        sqlx::query_as(
            r#"
            SELECT llm_provider, llm_api_key_encrypted, ollama_model, stt_provider, stt_api_key_encrypted
            FROM user_ai_settings
            WHERE user_id = $1
            "#,
        )
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?;

    let (llm_provider, llm_api_key_enc, ollama_model, stt_provider, stt_api_key_enc) =
        if let Some(row) = row {
            row
        } else {
            (
                state.config.default_ai_provider.clone(),
                None,
                Some("llama2".to_string()),
                state.config.default_stt_provider.clone(),
                None,
            )
        };

    // Choose provider from request override if provided
    let effective_llm_provider = if !req.llm_provider.is_empty() {
        req.llm_provider.clone()
    } else {
        llm_provider
    };

    let effective_stt_provider = if !req.stt_provider.is_empty() {
        req.stt_provider.clone()
    } else {
        stt_provider
    };

    // Decrypt keys or fall back to config/env
    let llm_api_key = if let Some(ref k) = req.llm_api_key {
        Some(k.clone())
    } else if let Some(enc) = llm_api_key_enc {
        decrypt_string(&enc, key).ok()
    } else {
        state.config.anthropic_api_key.clone().or(state.config.openai_api_key.clone())
    };

    let stt_api_key = if let Some(ref k) = req.stt_api_key {
        Some(k.clone())
    } else if let Some(enc) = stt_api_key_enc {
        decrypt_string(&enc, key).ok()
    } else {
        state.config.deepgram_api_key.clone().or(state.config.assemblyai_api_key.clone())
    };

    // LLM test: fire a tiny prompt
    let llm_result = match effective_llm_provider.as_str() {
        "claude" => {
            if let Some(key) = llm_api_key.clone() {
                let provider = crate::services::ai::ClaudeProvider::new(key);
                provider
                    .generate_fake_answers("Ping test", "pong", 1)
                    .await
                    .map(|_| true)
                    .unwrap_or(false)
            } else {
                false
            }
        }
        "openai" => {
            if let Some(key) = llm_api_key.clone() {
                let provider = crate::services::ai::OpenAIProvider::new(key);
                provider
                    .generate_fake_answers("Ping test", "pong", 1)
                    .await
                    .map(|_| true)
                    .unwrap_or(false)
            } else {
                false
            }
        }
        "ollama" => {
            let provider = crate::services::ai::OllamaProvider::new(
                state.config.ollama_base_url.clone(),
                req.ollama_model
                    .clone()
                    .or(ollama_model)
                    .unwrap_or_else(|| "llama2".to_string()),
            );
            provider
                .generate_fake_answers("Ping test", "pong", 1)
                .await
                .map(|_| true)
                .unwrap_or(false)
        }
        _ => false,
    };

    // STT test: basic HTTP metadata / fake audio call
    let stt_result = match effective_stt_provider.as_str() {
        "deepgram" => {
            if let Some(key) = stt_api_key.clone() {
                let provider = crate::services::transcription::DeepgramProvider::new(key);
                provider
                    .transcribe(Vec::new())
                    .await
                    .map(|_| true)
                    .unwrap_or(false)
            } else {
                false
            }
        }
        "whisper" => {
            if let Some(key) = stt_api_key.clone() {
                let provider = crate::services::transcription::WhisperProvider::new(key);
                provider
                    .transcribe(Vec::new())
                    .await
                    .map(|_| true)
                    .unwrap_or(false)
            } else {
                false
            }
        }
        "assemblyai" => {
            if let Some(key) = stt_api_key.clone() {
                let provider = crate::services::transcription::AssemblyAIProvider::new(key);
                provider
                    .transcribe(Vec::new())
                    .await
                    .map(|_| true)
                    .unwrap_or(false)
            } else {
                false
            }
        }
        _ => false,
    };

    let success = llm_result && stt_result;

    Ok(Json(serde_json::json!({
        "success": success,
        "llm_provider": effective_llm_provider,
        "stt_provider": effective_stt_provider,
        "llm_ok": llm_result,
        "stt_ok": stt_result
    })))
}
