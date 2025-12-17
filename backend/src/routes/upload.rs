use axum::{
    extract::{Extension, Multipart, State},
    Json,
};
use serde::Serialize;
use uuid::Uuid;

use crate::auth::AuthUser;
use crate::error::{AppError, Result};
use crate::AppState;

#[derive(Debug, Serialize)]
pub struct UploadResponse {
    pub url: String,
    pub file_name: String,
}

/// Upload user avatar
pub async fn upload_avatar(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    mut multipart: Multipart,
) -> Result<Json<UploadResponse>> {
    while let Some(field) = multipart
        .next_field()
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?
    {
        let file_name = field
            .file_name()
            .map(|s| s.to_string())
            .ok_or(AppError::Validation("Missing file name".to_string()))?;

        let data = field
            .bytes()
            .await
            .map_err(|e| AppError::Internal(e.to_string()))?;

        // Generate unique filename
        let ext = std::path::Path::new(&file_name)
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("jpg");

        let unique_name = format!("{}-{}.{}", auth_user.id, Uuid::new_v4(), ext);

        // Upload to MinIO
        state
            .s3_client
            .put_object()
            .bucket(&state.config.minio_bucket)
            .key(&unique_name)
            .body(data.into())
            .send()
            .await
            .map_err(|e| AppError::Internal(format!("Upload failed: {}", e)))?;

        let url = format!(
            "http://{}/{}/{}",
            state.config.minio_endpoint, state.config.minio_bucket, unique_name
        );

        return Ok(Json(UploadResponse {
            url,
            file_name: unique_name,
        }));
    }

    Err(AppError::Validation("No file provided".to_string()))
}
