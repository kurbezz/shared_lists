
use crate::services::AuthService;
use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AuthState {
    pub auth_service: Arc<AuthService>,
}

pub async fn auth_middleware(
    State(state): State<AuthState>,
    mut request: Request,
    next: Next,
) -> Result<Response, AuthError> {
    let auth_header = request
        .headers()
        .get("Authorization")
        .and_then(|h| h.to_str().ok())
        .ok_or(AuthError::MissingToken)?;

    if !auth_header.starts_with("Bearer ") {
        return Err(AuthError::InvalidToken);
    }

    let token = &auth_header[7..];
    let claims = state
        .auth_service
        .verify_jwt(token)
        .map_err(|_| AuthError::InvalidToken)?;

    request.extensions_mut().insert(claims);

    Ok(next.run(request).await)
}



#[derive(Debug)]
pub enum AuthError {
    MissingToken,
    InvalidToken,
}

impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AuthError::MissingToken => (StatusCode::UNAUTHORIZED, "Missing authorization token"),
            AuthError::InvalidToken => (StatusCode::UNAUTHORIZED, "Invalid authorization token"),
        };

        (status, message).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::{CreateUser, Claims};
    use crate::repositories::UserRepository;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        middleware as axum_middleware,
        routing::get,
        Extension, Router,
    };
    use tower::util::ServiceExt;

    async fn test_handler(Extension(claims): Extension<Claims>) -> String {
        format!("Hello, {}", claims.username)
    }

    #[tokio::test]
    async fn test_auth_middleware_success() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = Arc::new(crate::services::AuthService::new(
            "test_secret".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo.clone(),
        ));

        // Create a user and JWT
        let user = user_repo
            .create(CreateUser {
                twitch_id: "tw123".to_string(),
                username: "testuser".to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await?;

        let jwt = auth_service.create_jwt(&user)?;

        // Create a test router with auth middleware
        let auth_state = AuthState { auth_service };
        let app = Router::new()
            .route("/protected", get(test_handler))
            .layer(axum_middleware::from_fn_with_state(
                auth_state,
                auth_middleware,
            ));

        // Make request with valid token
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", format!("Bearer {}", jwt))
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::OK);

        Ok(())
    }

    #[tokio::test]
    async fn test_auth_middleware_missing_token() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = Arc::new(crate::services::AuthService::new(
            "test_secret".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo,
        ));

        let auth_state = AuthState { auth_service };
        let app = Router::new()
            .route("/protected", get(test_handler))
            .layer(axum_middleware::from_fn_with_state(
                auth_state,
                auth_middleware,
            ));

        // Make request without Authorization header
        let req = Request::builder()
            .uri("/protected")
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        Ok(())
    }

    #[tokio::test]
    async fn test_auth_middleware_invalid_token() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = Arc::new(crate::services::AuthService::new(
            "test_secret".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo,
        ));

        let auth_state = AuthState { auth_service };
        let app = Router::new()
            .route("/protected", get(test_handler))
            .layer(axum_middleware::from_fn_with_state(
                auth_state,
                auth_middleware,
            ));

        // Make request with invalid token
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "Bearer invalid_token_here")
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        Ok(())
    }

    #[tokio::test]
    async fn test_auth_middleware_malformed_header() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = UserRepository::new(pool.clone());
        let auth_service = Arc::new(crate::services::AuthService::new(
            "test_secret".to_string(),
            "client_id".to_string(),
            "client_secret".to_string(),
            user_repo,
        ));

        let auth_state = AuthState { auth_service };
        let app = Router::new()
            .route("/protected", get(test_handler))
            .layer(axum_middleware::from_fn_with_state(
                auth_state,
                auth_middleware,
            ));

        // Make request with malformed Authorization header (no "Bearer " prefix)
        let req = Request::builder()
            .uri("/protected")
            .header("Authorization", "some_token")
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), StatusCode::UNAUTHORIZED);

        Ok(())
    }
}

