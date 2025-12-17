use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// User roles
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum UserRole {
    Presenter,
    Participant,
}

impl ToString for UserRole {
    fn to_string(&self) -> String {
        match self {
            UserRole::Presenter => "presenter".to_string(),
            UserRole::Participant => "participant".to_string(),
        }
    }
}

impl From<String> for UserRole {
    fn from(s: String) -> Self {
        match s.as_str() {
            "presenter" => UserRole::Presenter,
            _ => UserRole::Participant,
        }
    }
}

/// Avatar types
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AvatarType {
    Emoji,
    Preset,
    Custom,
}

impl ToString for AvatarType {
    fn to_string(&self) -> String {
        match self {
            AvatarType::Emoji => "emoji".to_string(),
            AvatarType::Preset => "preset".to_string(),
            AvatarType::Custom => "custom".to_string(),
        }
    }
}

/// User database model
#[derive(Debug, Clone, Serialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    #[serde(skip_serializing)]
    pub password_hash: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub avatar_type: Option<String>,
    pub created_at: Option<DateTime<Utc>>,
    pub updated_at: Option<DateTime<Utc>>,
}

/// User response (without sensitive fields)
#[derive(Debug, Clone, Serialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub role: String,
    pub avatar_url: Option<String>,
    pub avatar_type: Option<String>,
}

impl From<User> for UserResponse {
    fn from(user: User) -> Self {
        Self {
            id: user.id,
            username: user.username,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url,
            avatar_type: user.avatar_type,
        }
    }
}

/// Registration request
#[derive(Debug, Deserialize)]
pub struct RegisterRequest {
    pub username: String,
    pub email: String,
    pub password: String,
    pub role: UserRole,
}

/// Login request
#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

/// Profile update request
#[derive(Debug, Deserialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub avatar_url: Option<String>,
    pub avatar_type: Option<String>,
}
