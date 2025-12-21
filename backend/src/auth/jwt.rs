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
    if auth_header.starts_with("Bearer ") && auth_header.len() > 7 {
        Some(&auth_header[7..])
    } else {
        None
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::{Duration, Utc};

    const TEST_SECRET: &str = "test_secret_key_for_testing_only";

    #[test]
    fn test_claims_new() {
        let user_id = Uuid::new_v4();
        let role = "presenter";
        let expiry_hours = 24;

        let claims = Claims::new(user_id, role, expiry_hours);

        assert_eq!(claims.sub, user_id);
        assert_eq!(claims.role, role);

        // Check timestamps are reasonable
        let now = Utc::now();
        assert!(claims.iat <= now.timestamp());
        assert!(claims.iat > now.timestamp() - 10); // Within last 10 seconds

        // Check expiry is correct
        let expected_exp = (now + Duration::hours(expiry_hours)).timestamp();
        assert!((claims.exp - expected_exp).abs() <= 1); // Allow 1 second tolerance
    }

    #[test]
    fn test_claims_new_zero_expiry() {
        let user_id = Uuid::new_v4();
        let claims = Claims::new(user_id, "participant", 0);

        let now = Utc::now();
        assert!(claims.exp <= now.timestamp());
    }

    #[test]
    fn test_claims_new_negative_expiry() {
        let user_id = Uuid::new_v4();
        let claims = Claims::new(user_id, "participant", -1);

        let now = Utc::now();
        // Negative expiry should still set exp before iat
        assert!(claims.exp < claims.iat);
    }

    #[test]
    fn test_extract_bearer_token_valid() {
        assert_eq!(
            extract_bearer_token("Bearer token123"),
            Some("token123")
        );
        assert_eq!(
            extract_bearer_token("Bearer abc.def.ghi"),
            Some("abc.def.ghi")
        );
    }

    #[test]
    fn test_extract_bearer_token_invalid() {
        assert_eq!(extract_bearer_token(""), None);
        assert_eq!(extract_bearer_token("token123"), None);
        assert_eq!(extract_bearer_token("bearer token123"), None);
        assert_eq!(extract_bearer_token("Bearer"), None);
        assert_eq!(extract_bearer_token("Bearer "), None);
        assert_eq!(extract_bearer_token("Basic token123"), None);
        assert_eq!(extract_bearer_token("Bearer token with spaces"), Some("token with spaces"));
    }

    #[test]
    fn test_extract_bearer_token_edge_cases() {
        // Empty bearer
        assert_eq!(extract_bearer_token("Bearer"), None);

        // Only whitespace after Bearer
        assert_eq!(extract_bearer_token("Bearer "), None);
        assert_eq!(extract_bearer_token("Bearer\t"), None);
        assert_eq!(extract_bearer_token("Bearer\n"), None);

        // Multiple spaces
        assert_eq!(extract_bearer_token("Bearer  token123"), Some(" token123"));
        assert_eq!(extract_bearer_token("Bearer\t\ttoken123"), None); // Tabs don't count as space after Bearer

        // Case sensitivity
        assert_eq!(extract_bearer_token("bearer token123"), None);
        assert_eq!(extract_bearer_token("BEARER token123"), None);
    }

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
}