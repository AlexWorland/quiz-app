use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Application error types
#[derive(Error, Debug)]
pub enum AppError {
    #[error("Authentication required")]
    Unauthorized,

    #[error("Access denied")]
    Forbidden,

    #[error("Resource not found: {0}")]
    NotFound(String),

    #[error("Validation error: {0}")]
    Validation(String),

    #[error("Conflict: {0}")]
    Conflict(String),

    #[error("Database error: {0}")]
    Database(#[from] sqlx::Error),

    #[error("JWT error: {0}")]
    Jwt(#[from] jsonwebtoken::errors::Error),

    #[error("Internal server error: {0}")]
    Internal(String),

    #[error("AI provider error: {0}")]
    AiProvider(String),

    #[error("Transcription error: {0}")]
    Transcription(String),

    #[error("WebSocket error: {0}")]
    WebSocket(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, error_message) = match &self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            AppError::Forbidden => (StatusCode::FORBIDDEN, self.to_string()),
            AppError::NotFound(msg) => (StatusCode::NOT_FOUND, msg.clone()),
            AppError::Validation(msg) => (StatusCode::BAD_REQUEST, msg.clone()),
            AppError::Conflict(msg) => (StatusCode::CONFLICT, msg.clone()),
            AppError::Database(e) => {
                tracing::error!("Database error: {:?}", e);
                (StatusCode::INTERNAL_SERVER_ERROR, "Database error".to_string())
            }
            AppError::Jwt(e) => {
                tracing::error!("JWT error: {:?}", e);
                (StatusCode::UNAUTHORIZED, "Invalid token".to_string())
            }
            AppError::Internal(msg) => {
                tracing::error!("Internal error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, "Internal server error".to_string())
            }
            AppError::AiProvider(msg) => {
                tracing::error!("AI provider error: {}", msg);
                (StatusCode::BAD_GATEWAY, msg.clone())
            }
            AppError::Transcription(msg) => {
                tracing::error!("Transcription error: {}", msg);
                (StatusCode::BAD_GATEWAY, msg.clone())
            }
            AppError::WebSocket(msg) => {
                tracing::error!("WebSocket error: {}", msg);
                (StatusCode::INTERNAL_SERVER_ERROR, msg.clone())
            }
        };

        let body = Json(json!({
            "error": error_message,
        }));

        (status, body).into_response()
    }
}

/// Result type alias for handlers
pub type Result<T> = std::result::Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;
    use axum::http::StatusCode;

    #[tokio::test]
    async fn test_app_error_unauthorized() {
        let error = AppError::Unauthorized;
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
        // Check response body contains error message
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("Authentication required"));
    }

    #[tokio::test]
    async fn test_app_error_forbidden() {
        let error = AppError::Forbidden;
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::FORBIDDEN);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("Access denied"));
    }

    #[tokio::test]
    async fn test_app_error_not_found() {
        let error = AppError::NotFound("user not found".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::NOT_FOUND);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("user not found"));
    }

    #[tokio::test]
    async fn test_app_error_validation() {
        let error = AppError::Validation("invalid input".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("invalid input"));
    }

    #[tokio::test]
    async fn test_app_error_conflict() {
        let error = AppError::Conflict("resource already exists".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::CONFLICT);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("resource already exists"));
    }

    #[tokio::test]
    async fn test_app_error_internal() {
        let error = AppError::Internal("database connection failed".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("Internal server error"));
    }

    #[tokio::test]
    async fn test_app_error_ai_provider() {
        let error = AppError::AiProvider("API rate limit exceeded".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("API rate limit exceeded"));
    }

    #[tokio::test]
    async fn test_app_error_transcription() {
        let error = AppError::Transcription("audio processing failed".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::BAD_GATEWAY);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("audio processing failed"));
    }

    #[tokio::test]
    async fn test_app_error_websocket() {
        let error = AppError::WebSocket("connection lost".to_string());
        let response = error.into_response();

        assert_eq!(response.status(), StatusCode::INTERNAL_SERVER_ERROR);
        let body_bytes = axum::body::to_bytes(response.into_body(), usize::MAX).await.unwrap();
        let body_str = std::str::from_utf8(&body_bytes).unwrap();
        assert!(body_str.contains("connection lost"));
    }

    #[test]
    fn test_app_error_display_messages() {
        // Test that error display messages are correct
        assert_eq!(AppError::Unauthorized.to_string(), "Authentication required");
        assert_eq!(AppError::Forbidden.to_string(), "Access denied");
        assert_eq!(AppError::NotFound("test".to_string()).to_string(), "Resource not found: test");
        assert_eq!(AppError::Validation("test".to_string()).to_string(), "Validation error: test");
        assert_eq!(AppError::Conflict("test".to_string()).to_string(), "Conflict: test");
        assert_eq!(AppError::Internal("test".to_string()).to_string(), "Internal server error: test");
        assert_eq!(AppError::AiProvider("test".to_string()).to_string(), "AI provider error: test");
        assert_eq!(AppError::Transcription("test".to_string()).to_string(), "Transcription error: test");
        assert_eq!(AppError::WebSocket("test".to_string()).to_string(), "WebSocket error: test");
    }
}