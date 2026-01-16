use crate::error::AppError;
use crate::models::{
    Claims, CreatePage, GrantPermission, Page, PagePermissionWithUser,
    PageWithPermission, SetPublicSlug, UpdatePage, UpdatePermission,
};
use crate::repositories::PageRepository;
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
    Json(payload): Json<SetPublicSlug>,
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
        let slug_regex = regex::Regex::new(r"^[a-z0-9-]{3,50}$").unwrap();
        if !slug_regex.is_match(slug) {
            return Err(AppError::BadRequest(
                "Slug must be 3-50 characters, lowercase letters, numbers, and hyphens only".to_string(),
            ));
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
