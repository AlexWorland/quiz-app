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
    pub display_name: String,
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserResponse {
    pub id: Uuid,
    pub username: String,
    pub display_name: String,
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
            display_name: user.display_name,
            email: user.email,
            role: user.role,
            avatar_url: user.avatar_url,
            avatar_type: user.avatar_type,
        }
    }
}

/// Registration request
#[derive(Debug, Deserialize, Serialize)]
pub struct RegisterRequest {
    pub username: String,
    pub password: String,
    pub avatar_url: Option<String>,
    pub avatar_type: Option<String>,
}

/// Login request
#[derive(Debug, Deserialize, Serialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

/// Login response
#[derive(Debug, Serialize, Deserialize)]
pub struct AuthResponse {
    pub token: String,
    pub user: UserResponse,
}

/// Profile update request
#[derive(Debug, Deserialize, Serialize)]
pub struct UpdateProfileRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub avatar_url: Option<String>,
    pub avatar_type: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    #[test]
    fn test_user_role_to_string() {
        assert_eq!(UserRole::Presenter.to_string(), "presenter");
        assert_eq!(UserRole::Participant.to_string(), "participant");
    }

    #[test]
    fn test_user_role_from_string() {
        assert_eq!(UserRole::from("presenter".to_string()), UserRole::Presenter);
        assert_eq!(UserRole::from("PRESENTER".to_string()), UserRole::Participant); // Case sensitive, defaults to Participant
        assert_eq!(UserRole::from("participant".to_string()), UserRole::Participant);
        assert_eq!(UserRole::from("admin".to_string()), UserRole::Participant); // Unknown role defaults to Participant
        assert_eq!(UserRole::from("".to_string()), UserRole::Participant); // Empty string defaults to Participant
    }

    #[test]
    fn test_user_role_round_trip() {
        // Test round-trip conversion
        assert_eq!(UserRole::from(UserRole::Presenter.to_string()), UserRole::Presenter);
        assert_eq!(UserRole::from(UserRole::Participant.to_string()), UserRole::Participant);
    }

    #[test]
    fn test_avatar_type_to_string() {
        assert_eq!(AvatarType::Emoji.to_string(), "emoji");
        assert_eq!(AvatarType::Preset.to_string(), "preset");
        assert_eq!(AvatarType::Custom.to_string(), "custom");
    }

    #[test]
    fn test_user_to_user_response_conversion() {
        let user = User {
            id: Uuid::new_v4(),
            username: "testuser".to_string(),
            display_name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hashed_password".to_string(),
            role: "presenter".to_string(),
            avatar_url: Some("https://example.com/avatar.jpg".to_string()),
            avatar_type: Some("custom".to_string()),
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        let user_clone = user.clone();
        let response: UserResponse = user.into();

        assert_eq!(response.id, user_clone.id);
        assert_eq!(response.username, user_clone.username);
        assert_eq!(response.display_name, user_clone.display_name);
        assert_eq!(response.email, user_clone.email);
        assert_eq!(response.role, user_clone.role);
        assert_eq!(response.avatar_url, user_clone.avatar_url);
        assert_eq!(response.avatar_type, user_clone.avatar_type);
    }

    #[test]
    fn test_user_to_user_response_password_hidden() {
        let user = User {
            id: Uuid::new_v4(),
            username: "testuser".to_string(),
            display_name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "sensitive_hash_data".to_string(),
            role: "participant".to_string(),
            avatar_url: None,
            avatar_type: None,
            created_at: None,
            updated_at: None,
        };

        let response: UserResponse = user.into();

        // Ensure password_hash is not included in response
        assert!(!response.username.contains("sensitive"));
        assert!(!response.email.contains("sensitive"));
        // The response should not have any field that contains the password hash
        let response_json = serde_json::to_string(&response).unwrap();
        assert!(!response_json.contains("sensitive_hash_data"));
    }

    #[test]
    fn test_user_to_user_response_with_none_fields() {
        let user = User {
            id: Uuid::new_v4(),
            username: "testuser".to_string(),
            display_name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            password_hash: "hash".to_string(),
            role: "participant".to_string(),
            avatar_url: None,
            avatar_type: None,
            created_at: Some(Utc::now()),
            updated_at: Some(Utc::now()),
        };

        let response: UserResponse = user.into();

        assert_eq!(response.avatar_url, None);
        assert_eq!(response.avatar_type, None);
    }

    #[test]
    fn test_register_request_validation() {
        // Valid registration request
        let valid_request = RegisterRequest {
            username: "validuser".to_string(),
            password: "validpass123".to_string(),
            avatar_url: Some("https://example.com/avatar.jpg".to_string()),
            avatar_type: Some("custom".to_string()),
        };

        // Test that it can be deserialized
        let json = serde_json::to_string(&valid_request).unwrap();
        let deserialized: RegisterRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, "validuser");
        assert_eq!(deserialized.password, "validpass123");
    }

    #[test]
    fn test_login_request_validation() {
        let login_request = LoginRequest {
            username: "testuser".to_string(),
            password: "testpass".to_string(),
        };

        let json = serde_json::to_string(&login_request).unwrap();
        let deserialized: LoginRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, "testuser");
        assert_eq!(deserialized.password, "testpass");
    }

    #[test]
    fn test_update_profile_request_validation() {
        let update_request = UpdateProfileRequest {
            username: Some("newusername".to_string()),
            display_name: Some("New Display Name".to_string()),
            avatar_url: Some("https://example.com/new-avatar.jpg".to_string()),
            avatar_type: Some("emoji".to_string()),
        };

        let json = serde_json::to_string(&update_request).unwrap();
        let deserialized: UpdateProfileRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, Some("newusername".to_string()));
        assert_eq!(deserialized.avatar_url, Some("https://example.com/new-avatar.jpg".to_string()));
        assert_eq!(deserialized.avatar_type, Some("emoji".to_string()));
    }

    #[test]
    fn test_update_profile_request_partial() {
        let partial_update = UpdateProfileRequest {
            username: Some("newname".to_string()),
            display_name: None,
            avatar_url: None,
            avatar_type: None,
        };

        let json = serde_json::to_string(&partial_update).unwrap();
        let deserialized: UpdateProfileRequest = serde_json::from_str(&json).unwrap();
        assert_eq!(deserialized.username, Some("newname".to_string()));
        assert_eq!(deserialized.avatar_url, None);
        assert_eq!(deserialized.avatar_type, None);
    }

    #[test]
    fn test_auth_response_structure() {
        let user_response = UserResponse {
            id: Uuid::new_v4(),
            username: "testuser".to_string(),
            display_name: "Test User".to_string(),
            email: "test@example.com".to_string(),
            role: "presenter".to_string(),
            avatar_url: Some("https://example.com/avatar.jpg".to_string()),
            avatar_type: Some("custom".to_string()),
        };

        let auth_response = AuthResponse {
            token: "jwt.token.here".to_string(),
            user: user_response.clone(),
        };

        let json = serde_json::to_string(&auth_response).unwrap();
        let deserialized: AuthResponse = serde_json::from_str(&json).unwrap();

        assert_eq!(deserialized.token, "jwt.token.here");
        assert_eq!(deserialized.user.id, user_response.id);
        assert_eq!(deserialized.user.username, user_response.username);
        assert_eq!(deserialized.user.email, user_response.email);
        assert_eq!(deserialized.user.role, user_response.role);
    }
}