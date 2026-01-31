use crate::models::{Claims, User};
use crate::repositories::UserRepository;
use crate::validators::{validate_display_name, validate_username};
use crate::error::FieldError;
use axum::{
    extract::{Query, State, Json},
    response::Json as ResponseJson,
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
        .route("/users/me", get(get_current_user).patch(update_current_user))
        .with_state(state)
}

async fn search_users(
    State(state): State<UsersRouterState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<SearchQuery>,
 ) -> Result<ResponseJson<Vec<User>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    if query.q.len() < 2 {
        return Ok(Json(Vec::new()));
    }

    let users = state.user_repo.search(&query.q, user_id).await?;

    Ok(Json(users))
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub username: Option<String>,
    pub display_name: Option<String>,
    pub profile_image_url: Option<String>,
    pub email: Option<String>,
}

async fn get_current_user(
    State(state): State<UsersRouterState>,
    Extension(claims): Extension<Claims>,
) -> Result<ResponseJson<User>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let user = state
        .user_repo
        .find_by_id(user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(user))
}

async fn update_current_user(
    State(state): State<UsersRouterState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<UpdateUserRequest>,
) -> Result<ResponseJson<User>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let existing = state
        .user_repo
        .find_by_id(user_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let username_raw = payload.username.as_deref().unwrap_or(&existing.username);

    // Aggregate validation errors for username and display_name
    let mut errors: Vec<FieldError> = Vec::new();

    let username = match validate_username(username_raw) {
        Ok(u) => u,
        Err(crate::error::AppError::Validation(mut es)) => {
            errors.append(&mut es);
            existing.username.clone()
        }
        Err(e) => return Err(e),
    };

    let display_name = match validate_display_name(&payload.display_name) {
        Ok(opt) => opt.or(existing.display_name.clone()),
        Err(crate::error::AppError::Validation(mut es)) => {
            errors.append(&mut es);
            existing.display_name.clone()
        }
        Err(e) => return Err(e),
    };

    if !errors.is_empty() {
        return Err(crate::error::AppError::Validation(errors));
    }
    let profile_image_url = payload
        .profile_image_url
        .as_deref()
        .or(existing.profile_image_url.as_deref());
    let email = payload.email.clone().or(existing.email.clone());

    let updated = state
        .user_repo
        .update_by_id(user_id, &username, display_name.as_deref(), profile_image_url, email)
        .await?;

    Ok(Json(updated))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::CreateUser;
    use axum::http::{Request, Method};
    use axum::body::{self, Body};
    use tower::util::ServiceExt;

    fn create_claims(user: &crate::models::User) -> Claims {
        Claims {
            sub: user.id.to_string(),
            twitch_id: user.twitch_id.clone(),
            username: user.username.clone(),
            exp: 9999999999,
            scopes: None,
        }
    }

    #[tokio::test]
    async fn test_search_users() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = Arc::new(crate::repositories::UserRepository::new(pool.clone()));

        // Create test users
        let user1 = user_repo
            .create(CreateUser {
                twitch_id: "tw1".to_string(),
                username: "alice".to_string(),
                display_name: Some("Alice".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        user_repo
            .create(CreateUser {
                twitch_id: "tw2".to_string(),
                username: "bob".to_string(),
                display_name: Some("Bob".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        user_repo
            .create(CreateUser {
                twitch_id: "tw3".to_string(),
                username: "charlie".to_string(),
                display_name: Some("Charlie".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        let state = UsersRouterState { user_repo };
        let app = users_router(state);
        let claims = create_claims(&user1);

        // Search for "bob"
        let req = Request::builder()
            .method(Method::GET)
            .uri("/users/search?q=bob")
            .extension(claims.clone())
            .body(Body::empty())?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let results: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(results.len(), 1);
        assert_eq!(results[0]["username"].as_str(), Some("bob"));

        // Search with short query (less than 2 chars)
        let req = Request::builder()
            .method(Method::GET)
            .uri("/users/search?q=a")
            .extension(claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let results: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(results.len(), 0); // Should return empty

        Ok(())
    }

    #[tokio::test]
    async fn test_get_current_user() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = Arc::new(crate::repositories::UserRepository::new(pool.clone()));

        let user = user_repo
            .create(CreateUser {
                twitch_id: "tw1".to_string(),
                username: "testuser".to_string(),
                display_name: Some("Test User".to_string()),
                profile_image_url: Some("http://image.url".to_string()),
                email: Some("test@example.com".to_string()),
            })
            .await?;

        let state = UsersRouterState { user_repo };
        let app = users_router(state);
        let claims = create_claims(&user);

        let req = Request::builder()
            .method(Method::GET)
            .uri("/users/me")
            .extension(claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let returned_user: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(returned_user["username"].as_str(), Some("testuser"));
        assert_eq!(returned_user["email"].as_str(), Some("test@example.com"));

        Ok(())
    }

    #[tokio::test]
    async fn test_update_current_user() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = Arc::new(crate::repositories::UserRepository::new(pool.clone()));

        let user = user_repo
            .create(CreateUser {
                twitch_id: "tw1".to_string(),
                username: "oldname".to_string(),
                display_name: Some("Old Name".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        let state = UsersRouterState { user_repo };
        let app = users_router(state);
        let claims = create_claims(&user);

        // Update user
        let update_payload = serde_json::json!({
            "username": "newname",
            "display_name": "New Name",
            "email": "new@example.com"
        });

        let req = Request::builder()
            .method(Method::PATCH)
            .uri("/users/me")
            .header("content-type", "application/json")
            .extension(claims)
            .body(Body::from(serde_json::to_vec(&update_payload)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let updated_user: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(updated_user["username"].as_str(), Some("newname"));
        assert_eq!(updated_user["display_name"].as_str(), Some("New Name"));
        assert_eq!(updated_user["email"].as_str(), Some("new@example.com"));

        Ok(())
    }

    #[tokio::test]
    async fn test_update_user_validation_json() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = Arc::new(crate::repositories::UserRepository::new(pool.clone()));

        let user = user_repo
            .create(CreateUser {
                twitch_id: "tw1".to_string(),
                username: "validuser".to_string(),
                display_name: Some("Old Name".to_string()),
                profile_image_url: None,
                email: None,
            })
            .await?;

        let state = UsersRouterState { user_repo };
        let app = users_router(state);
        let claims = create_claims(&user);

        // Provide invalid username and display_name (username too short, display name too long)
        let bad_payload = serde_json::json!({
            "username": "x",
            "display_name": "Y".repeat(100)
        });

        let req = Request::builder()
            .method(Method::PATCH)
            .uri("/users/me")
            .header("content-type", "application/json")
            .extension(claims)
            .body(Body::from(serde_json::to_vec(&bad_payload)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 400);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let v: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(v["error"].as_str(), Some("Validation failed"));
        let errors = v["errors"].as_array().unwrap();
        assert!(errors.iter().any(|e| e["field"].as_str() == Some("username")));
        assert!(errors.iter().any(|e| e["field"].as_str() == Some("display_name")));

        Ok(())
    }
}
