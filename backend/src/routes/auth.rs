use crate::error::AppError;

use crate::services::AuthService;
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
    routing::get,
    Router,
};
use cookie::{Cookie, time::Duration as CookieDuration};
use axum::http::StatusCode;
use serde::Deserialize;
use std::sync::Arc;
use url::Url;

#[derive(Clone)]
pub struct AuthRouterState {
    pub auth_service: Arc<AuthService>,
    pub twitch_client_id: String,
    pub redirect_uri: String,
    pub frontend_url: String,
}

#[derive(Debug, Deserialize)]
pub struct AuthCallbackQuery {
    pub code: String,
    #[allow(dead_code)]
    pub state: Option<String>,
}



pub fn auth_router(state: AuthRouterState) -> Router {
    Router::new()
        .route("/login", get(login))
        .route("/callback", get(callback))
        .route("/logout", axum::routing::post(logout))
        .with_state(state)
}

async fn login(State(state): State<AuthRouterState>) -> impl IntoResponse {
    let auth_url = format!(
        "https://id.twitch.tv/oauth2/authorize?client_id={}&redirect_uri={}&response_type=code&scope=user:read:email",
        state.twitch_client_id,
        urlencoding::encode(&state.redirect_uri)
    );

    Redirect::temporary(&auth_url)
}

async fn callback(
    State(state): State<AuthRouterState>,
    Query(params): Query<AuthCallbackQuery>,
) -> Result<impl IntoResponse, AppError> {
    // Exchange code for token
    let token_response = state
        .auth_service
        .exchange_code_for_token(&params.code, &state.redirect_uri)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Get user info from Twitch
    let twitch_user = state
        .auth_service
        .get_twitch_user(&token_response.access_token)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Create or update user in database
    let user = state
        .auth_service
        .get_or_create_user(twitch_user)
        .await
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Generate JWT
    let jwt = state
        .auth_service
        .create_jwt(&user)
        .map_err(|e| AppError::Internal(e.to_string()))?;

    // Set JWT as httpOnly secure cookie and redirect to frontend callback path without token in URL

    // Build cookie with proper attributes. Determine Secure flag based on frontend URL scheme.
    // For local development over http the `Secure` flag must be disabled so the cookie can be set.
    let secure_flag = match Url::parse(&state.frontend_url) {
        Ok(parsed) => parsed.scheme() == "https",
        Err(_) => true,
    };

    let c = Cookie::build("auth_token", jwt)
        .path("/")
        .http_only(true)
        .same_site(cookie::SameSite::Lax)
        .max_age(CookieDuration::days(7))
        .secure(secure_flag)
        .finish();

    let redirect_url = format!("{}/auth/callback", state.frontend_url);

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        axum::http::HeaderValue::from_str(&c.to_string()).unwrap(),
    );

    Ok((headers, Redirect::temporary(&redirect_url)))
}

async fn logout(State(state): State<AuthRouterState>) -> impl IntoResponse {
    // Clear cookie by setting Max-Age=0. Respect frontend scheme to set Secure flag accordingly.
    let secure_flag = match Url::parse(&state.frontend_url) {
        Ok(parsed) => parsed.scheme() == "https",
        Err(_) => true,
    };

    let c = Cookie::build("auth_token", "")
        .path("/")
        .http_only(true)
        .max_age(CookieDuration::seconds(0))
        .secure(secure_flag)
        .finish();

    let mut headers = axum::http::HeaderMap::new();
    headers.insert(
        axum::http::header::SET_COOKIE,
        axum::http::HeaderValue::from_str(&c.to_string()).unwrap(),
    );
    (headers, StatusCode::NO_CONTENT)
}
