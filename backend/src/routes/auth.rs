use crate::error::AppError;

use crate::services::AuthService;
use axum::{
    extract::{Query, State},
    response::{IntoResponse, Redirect},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::sync::Arc;

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

    // Redirect to frontend with token
    let redirect_url = format!("{}/auth/callback?token={}", state.frontend_url, urlencoding::encode(&jwt));

    Ok(Redirect::temporary(&redirect_url))
}


