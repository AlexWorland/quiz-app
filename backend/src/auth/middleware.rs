use axum::{
    extract::State,
    http::{header::AUTHORIZATION, Request, StatusCode},
    middleware::Next,
    response::Response,
    body::Body,
};
use uuid::Uuid;

use crate::auth::jwt::{extract_bearer_token, validate_token, Claims};
use crate::AppState;

/// Extension to store authenticated user info in request
#[derive(Clone, Debug)]
pub struct AuthUser {
    pub id: Uuid,
    pub role: String,
}

impl From<Claims> for AuthUser {
    fn from(claims: Claims) -> Self {
        Self {
            id: claims.sub,
            role: claims.role,
        }
    }
}

/// Authentication middleware - validates JWT and adds AuthUser to request extensions
pub async fn auth_middleware(
    State(state): State<AppState>,
    mut req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    // Get authorization header
    let auth_header = req
        .headers()
        .get(AUTHORIZATION)
        .and_then(|h| h.to_str().ok());

    let Some(auth_header) = auth_header else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Extract bearer token
    let Some(token) = extract_bearer_token(auth_header) else {
        return Err(StatusCode::UNAUTHORIZED);
    };

    // Validate token
    let claims = validate_token(token, &state.config.jwt_secret)
        .map_err(|_| StatusCode::UNAUTHORIZED)?;

    // Add authenticated user to request extensions
    req.extensions_mut().insert(AuthUser::from(claims));

    Ok(next.run(req).await)
}

/// Middleware that requires presenter role
pub async fn presenter_only(
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth_user = req
        .extensions()
        .get::<AuthUser>()
        .cloned()
        .ok_or(StatusCode::UNAUTHORIZED)?;

    if auth_user.role != "presenter" {
        return Err(StatusCode::FORBIDDEN);
    }

    Ok(next.run(req).await)
}
