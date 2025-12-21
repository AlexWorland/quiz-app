use axum::{
    extract::{Extension, State},
    Json,
};
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use uuid::Uuid;

use crate::auth::{generate_token, AuthUser};
use crate::error::{AppError, Result};
use crate::models::{
    AuthResponse, LoginRequest, RegisterRequest, UpdateProfileRequest, User, UserResponse,
};
use crate::AppState;

/// Register a new user
pub async fn register(
    State(state): State<AppState>,
    Json(req): Json<RegisterRequest>,
) -> Result<Json<AuthResponse>> {
    // Validate input
    if req.username.len() < 3 {
        return Err(AppError::Validation("Username must be at least 3 characters".to_string()));
    }
    if req.password.len() < 1 {
        return Err(AppError::Validation("Password is required".to_string()));
    }

    // Check if username already exists
    let existing = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM users WHERE username = $1")
        .bind(&req.username)
        .fetch_one(&state.db)
        .await?;

    if existing > 0 {
        return Err(AppError::Conflict("Username already taken".to_string()));
    }

    // Hash password
    let salt = SaltString::generate(&mut OsRng);
    let argon2 = Argon2::default();
    let password_hash = argon2
        .hash_password(req.password.as_bytes(), &salt)
        .map_err(|e| AppError::Internal(format!("Password hashing failed: {}", e)))?
        .to_string();

    // Insert user
    let user_id = Uuid::new_v4();

    let user = sqlx::query_as::<_, User>(
        r#"
        INSERT INTO users (id, username, display_name, email, password_hash, role, avatar_url, avatar_type)
        VALUES ($1, $2, $3, $4, $5, 'participant', $6, $7)
        RETURNING *
        "#,
    )
    .bind(user_id)
    .bind(&req.username)
    .bind(&req.username) // Use username as display_name initially
    .bind(format!("{}@quizapp.local", req.username)) // Generate email from username
    .bind(&password_hash)
    .bind(&req.avatar_url)
    .bind(&req.avatar_type)
    .fetch_one(&state.db)
    .await?;

    // Generate JWT token
    let token = generate_token(
        user.id,
        &user.role,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )?;

    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

/// Login user
pub async fn login(
    State(state): State<AppState>,
    Json(req): Json<LoginRequest>,
) -> Result<Json<AuthResponse>> {
    // Find user by username
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE username = $1")
        .bind(&req.username)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::Unauthorized)?;

    // Verify password
    let parsed_hash = PasswordHash::new(&user.password_hash)
        .map_err(|_| AppError::Internal("Invalid password hash".to_string()))?;

    Argon2::default()
        .verify_password(req.password.as_bytes(), &parsed_hash)
        .map_err(|_| AppError::Unauthorized)?;

    // Generate JWT token
    let token = generate_token(
        user.id,
        &user.role,
        &state.config.jwt_secret,
        state.config.jwt_expiry_hours,
    )?;

    Ok(Json(AuthResponse {
        token,
        user: user.into(),
    }))
}

/// Get current user info
pub async fn me(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
) -> Result<Json<UserResponse>> {
    let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(AppError::NotFound("User not found".to_string()))?;

    Ok(Json(user.into()))
}

/// Update user profile
pub async fn update_profile(
    State(state): State<AppState>,
    Extension(auth_user): Extension<AuthUser>,
    Json(req): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>> {
    // Validate username if provided
    if let Some(ref username) = req.username {
        let trimmed = username.trim();
        if trimmed.len() < 3 {
            return Err(AppError::Validation(
                "Username must be at least 3 characters".to_string(),
            ));
        }
        if trimmed.len() > 50 {
            return Err(AppError::Validation(
                "Username must be 50 characters or fewer".to_string(),
            ));
        }

        // Check uniqueness against other users
        let existing = sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM users WHERE username = $1 AND id != $2",
        )
        .bind(trimmed)
        .bind(auth_user.id)
        .fetch_one(&state.db)
        .await?;

        if existing > 0 {
            return Err(AppError::Conflict("Username already taken".to_string()));
        }
    }

    // Validate avatar url/type if provided
    if let Some(ref avatar_url) = req.avatar_url {
        if avatar_url.len() > 500 {
            return Err(AppError::Validation(
                "Avatar URL must be 500 characters or fewer".to_string(),
            ));
        }
    }

    if let Some(ref avatar_type) = req.avatar_type {
        let allowed = ["emoji", "preset", "custom"];
        if !allowed.contains(&avatar_type.as_str()) {
            return Err(AppError::Validation(
                "avatar_type must be one of: emoji, preset, custom".to_string(),
            ));
        }
    }

    // Get current user to preserve values for fields not being updated
    let current_user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
        .bind(auth_user.id)
        .fetch_one(&state.db)
        .await?;

    // Prepare values: use provided values or keep current
    let username_to_set = req.username.as_ref().map(|u| u.trim().to_string()).unwrap_or_else(|| current_user.username.clone());
    let display_name_to_set = req.display_name.as_ref().map(|d| d.trim().to_string()).unwrap_or_else(|| current_user.display_name.clone());
    let avatar_url_to_set: Option<String> = req.avatar_url.clone().or_else(|| current_user.avatar_url.clone());
    let avatar_type_to_set: Option<String> = req.avatar_type.clone().or_else(|| current_user.avatar_type.clone());

    let user = sqlx::query_as::<_, User>(
        r#"
        UPDATE users
        SET username = $2,
            display_name = $3,
            avatar_url = $4,
            avatar_type = $5,
            updated_at = NOW()
        WHERE id = $1
        RETURNING *
        "#,
    )
    .bind(auth_user.id)
    .bind(&username_to_set)
    .bind(&display_name_to_set)
    .bind(&avatar_url_to_set)
    .bind(&avatar_type_to_set)
    .fetch_one(&state.db)
    .await?;

    Ok(Json(user.into()))
}
