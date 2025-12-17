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
