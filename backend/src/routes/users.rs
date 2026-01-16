use crate::models::{Claims, User};
use crate::repositories::UserRepository;
use axum::{
    extract::{Query, State},
    response::Json,
    routing::get,
    Extension, Router,
};
use serde::Deserialize;
use std::sync::Arc;
use uuid::Uuid;
use crate::error::AppError;

#[derive(Clone)]
pub struct UsersRouterState {
    pub user_repo: Arc<UserRepository>,
}

#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub q: String,
}

pub fn users_router(state: UsersRouterState) -> Router {
    Router::new()
        .route("/users/search", get(search_users))
        .with_state(state)
}

async fn search_users(
    State(state): State<UsersRouterState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SearchQuery>,
) -> Result<Json<Vec<User>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    if query.q.len() < 2 {
        return Ok(Json(Vec::new()));
    }

    let users = state.user_repo.search(&query.q, user_id).await?;

    Ok(Json(users))
}
