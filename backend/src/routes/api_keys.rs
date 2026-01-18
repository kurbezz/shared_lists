use crate::error::AppError;
use crate::models::{ApiKeyResponse, Claims, CreateApiKeyResponse};
use crate::services::ApiKeyService;
use axum::{
    extract::{Extension, Json, Path, State, Query},
    response::Json as ResponseJson,
    routing::{delete, post},
    http::StatusCode,
    Router,
};
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ApiKeysRouterState {
    pub api_key_service: Arc<ApiKeyService>,
}

#[derive(Debug, Deserialize)]
pub struct CreateApiKeyRequest {
    pub name: Option<String>,
    pub scopes: Vec<String>,
}

pub fn api_keys_router(state: ApiKeysRouterState) -> Router {
    Router::new()
        .route("/settings/api-keys", post(create_api_key).get(list_api_keys))
        .route("/settings/api-keys/:id", delete(revoke_api_key))
        .with_state(state)
}

async fn create_api_key(
    State(state): State<ApiKeysRouterState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreateApiKeyRequest>,
) -> Result<ResponseJson<CreateApiKeyResponse>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let response = state
        .api_key_service
        .create_api_key(user_id, payload.name, payload.scopes)
        .await
        .map_err(|e| {
            tracing::error!("Failed to create API key: {:?}", e);
            AppError::Internal(format!("Failed to create API key: {}", e))
        })?;

    Ok(ResponseJson(response))
}

async fn list_api_keys(
    State(state): State<ApiKeysRouterState>,
    Extension(claims): Extension<Claims>,
) -> Result<ResponseJson<Vec<ApiKeyResponse>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let api_keys = state
        .api_key_service
        .list_user_api_keys(user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to list API keys: {}", e);
            AppError::Internal("Failed to list API keys".to_string())
        })?;

    let responses: Vec<ApiKeyResponse> = api_keys.into_iter().map(|key| key.to_response()).collect();
    Ok(ResponseJson(responses))
}

async fn revoke_api_key(
    State(state): State<ApiKeysRouterState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<String>,
    Query(params): Query<HashMap<String, String>>,
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let hard_delete = params.get("hard").map(|v| v == "true").unwrap_or(false);

    if hard_delete {
        let deleted = state
            .api_key_service
            .delete_api_key(&id, user_id)
            .await
            .map_err(|e| {
                tracing::error!("Failed to delete API key: {}", e);
                AppError::Internal("Failed to delete API key".to_string())
            })?;

        if !deleted {
            return Err(AppError::NotFound);
        }

        return Ok(StatusCode::NO_CONTENT);
    }

    let revoked = state
        .api_key_service
        .revoke_api_key(&id, user_id)
        .await
        .map_err(|e| {
            tracing::error!("Failed to revoke API key: {}", e);
            AppError::Internal("Failed to revoke API key".to_string())
        })?;

    if !revoked {
        return Err(AppError::NotFound);
    }

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::CreateUser;
    use crate::repositories::{ApiKeyRepository, UserRepository};
    use crate::tests_utils::setup_db;

    #[tokio::test]
    async fn test_create_api_key_success() -> anyhow::Result<()> {
        let pool = setup_db().await;
        
        // Create test user
        let user_repo = UserRepository::new(pool.clone());
        let user = user_repo.create(CreateUser {
            twitch_id: "test123".to_string(),
            username: "testuser".to_string(),
            display_name: None,
            profile_image_url: None,
            email: None,
        }).await?;

        let api_key_repo = ApiKeyRepository::new(pool);
        let api_key_service = Arc::new(ApiKeyService::new(api_key_repo));
        
        let claims = Claims {
            sub: user.id.to_string(),
            twitch_id: user.twitch_id.clone(),
            username: user.username.clone(),
            exp: 9999999999,
            scopes: None,
        };

        let request = CreateApiKeyRequest {
            name: Some("Test Key".to_string()),
            scopes: vec!["read".to_string()],
        };

        let result = create_api_key(
            State(ApiKeysRouterState {
                api_key_service: api_key_service.clone(),
            }),
            Extension(claims),
            Json(request),
        ).await;

        assert!(result.is_ok());
        let response = result.unwrap().0;
        assert!(!response.token.is_empty());
        assert!(!response.id.is_empty());

        Ok(())
    }

    #[tokio::test]
    async fn test_delete_api_key_success() -> anyhow::Result<()> {
use axum::http::{Request, Method};
        use axum::body::Body;
    use std::collections::HashMap;
    use tower::util::ServiceExt;

        let pool = setup_db().await;

        // Create test user
        let user_repo = UserRepository::new(pool.clone());
        let user = user_repo.create(CreateUser {
            twitch_id: "test123".to_string(),
            username: "testuser".to_string(),
            display_name: None,
            profile_image_url: None,
            email: None,
        }).await?;

        let api_key_repo = ApiKeyRepository::new(pool);
        let api_key_service = Arc::new(ApiKeyService::new(api_key_repo));

        let claims = Claims {
            sub: user.id.to_string(),
            twitch_id: user.twitch_id.clone(),
            username: user.username.clone(),
            exp: 9999999999,
            scopes: None,
        };

        // Create an API key
        let create_resp = api_key_service.create_api_key(user.id, Some("ToDelete".to_string()), vec!["read".to_string()]).await?;
        assert!(!create_resp.id.is_empty());

        // Delete the API key (hard delete)
        let mut params = HashMap::new();
        params.insert("hard".to_string(), "true".to_string());
        // Call the HTTP handler to ensure it returns 204 No Content
        let app = api_keys_router(ApiKeysRouterState { api_key_service: api_key_service.clone() });

        let req = Request::builder()
            .method(Method::DELETE)
            .uri(format!("/settings/api-keys/{}?hard=true", create_resp.id))
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 204);

        // Ensure the key is gone from list
        let list = list_api_keys(
            State(ApiKeysRouterState { api_key_service: api_key_service.clone() }),
            Extension(claims),
        ).await?;

        let keys = list.0;
        assert!(keys.iter().all(|k| k.id != create_resp.id));

        Ok(())
    }
}
