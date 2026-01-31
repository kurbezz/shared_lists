use crate::error::AppError;
use crate::models::{
    Claims, CreatePage, GrantPermission, Page, PagePermissionWithUser,
    PageWithPermission, SetPublicSlug, UpdatePage, UpdatePermission,
};
use crate::repositories::PageRepository;
use crate::validators::{validate_title, validate_description, validate_public_slug};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::{get, patch, put},
    Extension, Router,
};
use std::sync::Arc;
use uuid::Uuid;



#[derive(Clone)]
pub struct PagesRouterState {
    pub page_repo: Arc<PageRepository>,
}


pub fn pages_router(state: PagesRouterState) -> Router {
    Router::new()
        .route("/pages", get(list_pages).post(create_page))
        .route(
            "/pages/:id",
            get(get_page).patch(update_page).delete(delete_page),
        )
        .route("/pages/:id/public-slug", put(set_public_slug))
        .route(
            "/pages/:id/permissions",
            get(list_permissions).post(grant_permission),
        )
        .route(
            "/pages/:id/permissions/:permission_id",
            patch(update_permission).delete(revoke_permission),
        )
        .with_state(state)
}

// List all pages user has access to
async fn list_pages(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
) -> Result<Json<Vec<PageWithPermission>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let pages = state.page_repo.list_for_user(user_id).await?;

    Ok(Json(pages))
}

// Create new page
async fn create_page(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Json(payload): Json<CreatePage>,
) -> Result<Json<Page>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Validate title and description and collect all field errors
    let mut errors: Vec<crate::error::FieldError> = Vec::new();

    let mut title_res = validate_title(&payload.title);
    if let Err(crate::error::AppError::Validation(ref mut es)) = title_res {
        errors.append(es);
    } else if let Err(e) = title_res {
        return Err(e);
    }

    let mut desc_res = validate_description(&payload.description);
    if let Err(crate::error::AppError::Validation(ref mut es)) = desc_res {
        errors.append(es);
    } else if let Err(e) = desc_res {
        return Err(e);
    }

    if !errors.is_empty() {
        return Err(crate::error::AppError::Validation(errors));
    }

    let mut payload = payload;
    payload.title = title_res.unwrap();
    payload.description = desc_res.unwrap();

    let page = state.page_repo.create(user_id, payload).await?;

    Ok(Json(page))
}

// Get single page
async fn get_page(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
) -> Result<Json<PageWithPermission>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user is creator
    let is_creator = page.creator_id == user_id;

    // Check if user has permission
    let permission = state.page_repo.get_user_permission(page_id, user_id).await?;

    let can_edit = is_creator || permission.as_ref().map(|p| p.can_edit).unwrap_or(false);

    if !is_creator && permission.is_none() {
        return Err(AppError::Forbidden);
    }

    Ok(Json(PageWithPermission {
        page,
        is_creator,
        can_edit,
    }))
}

// Update page
async fn update_page(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
    Json(payload): Json<UpdatePage>,
) -> Result<Json<Page>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    // Validate inputs if provided and collect all field errors
    let mut errors: Vec<crate::error::FieldError> = Vec::new();

    let mut payload = payload;
    if let Some(ref t) = payload.title {
        match validate_title(t) {
            Ok(v) => payload.title = Some(v),
            Err(crate::error::AppError::Validation(mut es)) => errors.append(&mut es),
            Err(e) => return Err(e),
        }
    }
    if payload.description.is_some() {
        match validate_description(&payload.description) {
            Ok(v) => payload.description = v,
            Err(crate::error::AppError::Validation(mut es)) => errors.append(&mut es),
            Err(e) => return Err(e),
        }
    }

    if !errors.is_empty() {
        return Err(crate::error::AppError::Validation(errors));
    }

    let page = state
        .page_repo
        .update(page_id, payload)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(page))
}

// Delete page
async fn delete_page(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Only creator can delete
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    state.page_repo.delete(page_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// Set or remove public slug
async fn set_public_slug(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
    Json(mut payload): Json<SetPublicSlug>,
) -> Result<Json<Page>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Only creator can set public slug
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    // Validate slug format if provided
    if let Some(ref slug) = payload.public_slug {
        match validate_public_slug(slug) {
            Ok(v) => payload.public_slug = Some(v),
            Err(crate::error::AppError::Validation(es)) => return Err(crate::error::AppError::Validation(es)),
            Err(e) => return Err(e),
        }
    }

    let updated_page = state
        .page_repo
        .set_public_slug(page_id, payload.public_slug)
        .await
        .map_err(|e| {
            if let Some(sqlx::Error::Database(db_err)) = e.downcast_ref::<sqlx::Error>() {
                if db_err.is_unique_violation() {
                    return AppError::BadRequest("This slug is already in use".to_string());
                }
            }
            AppError::Database(e)
        })?;

    Ok(Json(updated_page))
}

// List permissions for a page
async fn list_permissions(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
) -> Result<Json<Vec<PagePermissionWithUser>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user is creator
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    let permissions = state.page_repo.get_permissions(page_id).await?;

    Ok(Json(permissions))
}

// Grant permission
async fn grant_permission(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
    Json(payload): Json<GrantPermission>,
) -> Result<Json<PagePermissionWithUser>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user is creator
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    // Check if permission already exists
    let existing = state
        .page_repo
        .get_user_permission(page_id, payload.user_id)
        .await?;

    if existing.is_some() {
        return Err(AppError::BadRequest(
            "Permission already exists".to_string(),
        ));
    }

    let permission = state
        .page_repo
        .grant_permission(page_id, payload.user_id, payload.can_edit, user_id)
        .await?;

    // We need the user info too - repository should probably have a method for this but let's just use what we have or add it.
    // For now, I'll just look it up manually or assume we need to add another method to repo.
    // Actually, I'll add a get_permission_with_user to PageRepository.
    
    let permissions = state.page_repo.get_permissions(page_id).await?;
    let permission_with_user = permissions
        .into_iter()
        .find(|p| p.permission.id == permission.id)
        .ok_or_else(|| anyhow::anyhow!("Failed to retrieve created permission"))?;

    Ok(Json(permission_with_user))
}

// Update permission
async fn update_permission(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path((page_id, permission_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdatePermission>,
) -> Result<Json<PagePermissionWithUser>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user is creator
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    let _permission = state
        .page_repo
        .update_permission(page_id, permission_id, payload.can_edit)
        .await?
        .ok_or(AppError::NotFound)?;

    let permissions = state.page_repo.get_permissions(page_id).await?;
    let permission_with_user = permissions
        .into_iter()
        .find(|p| p.permission.id == permission_id)
        .ok_or(AppError::NotFound)?;

    Ok(Json(permission_with_user))
}

// Revoke permission
async fn revoke_permission(
    State(state): State<PagesRouterState>,
    Extension(claims): Extension<Claims>,
    Path((page_id, permission_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user is creator
    let page = state
        .page_repo
        .find_by_id(page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    if page.creator_id != user_id {
        return Err(AppError::Forbidden);
    }

    state.page_repo.revoke_permission(page_id, permission_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::{CreateUser, CreatePage};
    use crate::services::AuthService;
    use axum::http::{Request, Method};
    use axum::body::{self, Body};
    use tower::util::ServiceExt;

    // Helper to create a test user and JWT
    async fn create_test_user_with_jwt(
        pool: &sqlx::SqlitePool,
        twitch_id: &str,
        username: &str,
    ) -> anyhow::Result<(crate::models::User, String)> {
        let user_repo = crate::repositories::UserRepository::new(pool.clone());
        let auth_service = AuthService::new(
            "test_secret".to_string(),
            "test_client".to_string(),
            "test_secret".to_string(),
            user_repo.clone(),
        );

        let user = user_repo
            .create(CreateUser {
                twitch_id: twitch_id.to_string(),
                username: username.to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await?;

        let jwt = auth_service.create_jwt(&user)?;
        Ok((user, jwt))
    }

    #[tokio::test]
    async fn test_create_and_list_pages() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let (user, _jwt) = create_test_user_with_jwt(&pool, "tw1", "user1").await?;

        let state = PagesRouterState {
            page_repo: page_repo.clone(),
        };
        let app = pages_router(state);

        // Create a page
        let create_payload = serde_json::json!({
            "title": "Test Page",
            "description": "A test page"
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/pages")
            .header("content-type", "application/json")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::from(serde_json::to_vec(&create_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let created_page: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(created_page["title"].as_str(), Some("Test Page"));

        // List pages
        let req = Request::builder()
            .method(Method::GET)
            .uri("/pages")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let pages: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(pages.len(), 1);

        Ok(())
    }

    #[tokio::test]
    async fn test_update_and_delete_page() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let (user, _jwt) = create_test_user_with_jwt(&pool, "tw2", "user2").await?;

        // Create page directly
        let page = page_repo
            .create(
                user.id,
                CreatePage {
                    title: "Original".to_string(),
                    description: None,
                },
            )
            .await?;

        // Update page
        let update_payload = serde_json::json!({
            "title": "Updated Title"
        });

        let state = PagesRouterState {
            page_repo: page_repo.clone(),
        };
        let app = pages_router(state.clone());

        let req = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/pages/{}", page.id))
            .header("content-type", "application/json")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::from(serde_json::to_vec(&update_payload)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let updated: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(updated["title"].as_str(), Some("Updated Title"));

        // Delete page - create a new app instance
        let app = pages_router(state);

        let req = Request::builder()
            .method(Method::DELETE)
            .uri(format!("/pages/{}", page.id))
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

        Ok(())
    }

    #[tokio::test]
    async fn test_set_public_slug() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let (user, _jwt) = create_test_user_with_jwt(&pool, "tw3", "user3").await?;

        let page = page_repo
            .create(user.id, CreatePage {
                title: "Public Page".to_string(),
                description: None,
            })
            .await?;

        let state = PagesRouterState {
            page_repo: page_repo.clone(),
        };
        let app = pages_router(state);

        // Set public slug
        let slug_payload = serde_json::json!({
            "public_slug": "my-public-page"
        });

        let req = Request::builder()
            .method(Method::PUT)
            .uri(format!("/pages/{}/public-slug", page.id))
            .header("content-type", "application/json")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,                scopes: None,            })
            .body(Body::from(serde_json::to_vec(&slug_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let updated: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(updated["public_slug"].as_str(), Some("my-public-page"));

        // Test invalid slug format
        let invalid_slug = serde_json::json!({
            "public_slug": "INVALID_SLUG"
        });

        let req = Request::builder()
            .method(Method::PUT)
            .uri(format!("/pages/{}/public-slug", page.id))
            .header("content-type", "application/json")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,                scopes: None,            })
            .body(Body::from(serde_json::to_vec(&invalid_slug)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 400);

        Ok(())
    }

    #[tokio::test]
    async fn test_create_page_validation_json() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let (user, _jwt) = create_test_user_with_jwt(&pool, "twv", "userv").await?;

        let state = PagesRouterState {
            page_repo: page_repo.clone(),
        };
        let app = pages_router(state);

        // Create a title that's too long (TITLE_MAX is 200)
        let long_title = "x".repeat(201);
        let create_payload = serde_json::json!({
            "title": long_title,
            "description": "A test page"
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri("/pages")
            .header("content-type", "application/json")
            .extension(Claims {
                sub: user.id.to_string(),
                twitch_id: user.twitch_id.clone(),
                username: user.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::from(serde_json::to_vec(&create_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 400);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let v: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(v["error"].as_str(), Some("Validation failed"));
        let errors = v["errors"].as_array().unwrap();
        // Find title error
        let title_err = errors.iter().find(|e| e["field"].as_str() == Some("title")).unwrap();
        assert!(title_err["message"].as_str().unwrap().contains("Title must be between"));

        Ok(())
    }

    #[tokio::test]
    async fn test_permissions_workflow() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let (owner, _) = create_test_user_with_jwt(&pool, "owner", "owner").await?;
        let (other_user, _) = create_test_user_with_jwt(&pool, "other", "other").await?;

        let page = page_repo
            .create(owner.id, CreatePage {
                title: "Shared Page".to_string(),
                description: None,
            })
            .await?;

        let state = PagesRouterState {
            page_repo: page_repo.clone(),
        };
        
        // Grant permission
        let grant_payload = serde_json::json!({
            "user_id": other_user.id.to_string(),
            "can_edit": true
        });

        let app = pages_router(state.clone());
        let req = Request::builder()
            .method(Method::POST)
            .uri(format!("/pages/{}/permissions", page.id))
            .header("content-type", "application/json")
            .extension(Claims {
                sub: owner.id.to_string(),
                twitch_id: owner.twitch_id.clone(),
                username: owner.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::from(serde_json::to_vec(&grant_payload)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let perm: serde_json::Value = serde_json::from_slice(&bytes)?;
        
        // The response is PagePermissionWithUser, which has both permission fields and user
        let permission_id = perm["id"].as_str().unwrap().to_string();
        assert_eq!(perm["can_edit"].as_bool(), Some(true));

        // List permissions
        let app = pages_router(state.clone());
        let req = Request::builder()
            .method(Method::GET)
            .uri(format!("/pages/{}/permissions", page.id))
            .extension(Claims {
                sub: owner.id.to_string(),
                twitch_id: owner.twitch_id.clone(),
                username: owner.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let perms: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(perms.len(), 1);

        // Update permission
        let update_payload = serde_json::json!({
            "can_edit": false
        });

        let app = pages_router(state.clone());
        let req = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/pages/{}/permissions/{}", page.id, permission_id))
            .header("content-type", "application/json")
            .extension(Claims {
                sub: owner.id.to_string(),
                twitch_id: owner.twitch_id.clone(),
                username: owner.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::from(serde_json::to_vec(&update_payload)?))?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        // Revoke permission
        let app = pages_router(state);
        let req = Request::builder()
            .method(Method::DELETE)
            .uri(format!("/pages/{}/permissions/{}", page.id, permission_id))
            .extension(Claims {
                sub: owner.id.to_string(),
                twitch_id: owner.twitch_id.clone(),
                username: owner.username.clone(),
                exp: 9999999999,
                scopes: None,
            })
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 204);

        Ok(())
    }
}
