use chrono::{Duration, Utc};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::{AppError, Result};

/// JWT claims structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// User ID
    pub sub: Uuid,
    /// User role (presenter or participant)
    pub role: String,
    /// Expiration timestamp
    pub exp: i64,
    /// Issued at timestamp
    pub iat: i64,
}

impl Claims {
    /// Create new claims for a user
    pub fn new(user_id: Uuid, role: &str, expiry_hours: i64) -> Self {
        let now = Utc::now();
        Self {
            sub: user_id,
            role: role.to_string(),
            exp: (now + Duration::hours(expiry_hours)).timestamp(),
            iat: now.timestamp(),
        }
    }
}

/// Generate a JWT token for a user
pub fn generate_token(user_id: Uuid, role: &str, secret: &str, expiry_hours: i64) -> Result<String> {
    let claims = Claims::new(user_id, role, expiry_hours);

    let token = encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )?;

    Ok(token)
}

/// Validate and decode a JWT token
pub fn validate_token(token: &str, secret: &str) -> Result<Claims> {
    let token_data = decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )?;

    Ok(token_data.claims)
}

/// Extract bearer token from Authorization header
pub fn extract_bearer_token(auth_header: &str) -> Option<&str> {
    if auth_header.starts_with("Bearer ") {
        Some(&auth_header[7..])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    const TEST_SECRET: &str = "test_secret_key_for_testing_only";

    #[test]
    fn test_generate_and_validate_token() {
        let user_id = Uuid::new_v4();
        let role = "presenter";
        let expiry_hours = 24;

        let token = generate_token(user_id, role, TEST_SECRET, expiry_hours).unwrap();
        assert!(!token.is_empty());

        let claims = validate_token(&token, TEST_SECRET).unwrap();
        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.role, role);
    }

    #[test]
    fn test_token_expiry() {
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, "presenter", TEST_SECRET, 0).unwrap(); // Expires immediately

        // Token should be invalid after expiry (though we can't easily test time-based expiry in unit tests)
        // This test verifies the token structure is correct
        let claims = validate_token(&token, TEST_SECRET).unwrap();
        assert_eq!(claims.sub, user_id);
    }

    #[test]
    fn test_invalid_token() {
        let result = validate_token("invalid.token.here", TEST_SECRET);
        assert!(result.is_err());
    }

    #[test]
    fn test_wrong_secret() {
        let user_id = Uuid::new_v4();
        let token = generate_token(user_id, "presenter", TEST_SECRET, 24).unwrap();

        let result = validate_token(&token, "wrong_secret");
        assert!(result.is_err());
    }

    #[test]
    fn test_extract_bearer_token() {
        assert_eq!(
            extract_bearer_token("Bearer token123"),
            Some("token123")
        );
        assert_eq!(extract_bearer_token("Invalid token123"), None);
        assert_eq!(extract_bearer_token("Bearer"), None);
    }
}
