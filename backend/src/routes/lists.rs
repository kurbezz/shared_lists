use crate::error::AppError;
use crate::models::{
    Claims, CreateList, CreateListItem, List, ListItem, ListWithItems, UpdateList, UpdateListItem,
};
use crate::repositories::{ListRepository, PageRepository};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::Json,
    routing::get,
    Extension, Router,
};
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct ListsRouterState {
    pub list_repo: Arc<ListRepository>,
    pub page_repo: Arc<PageRepository>,
}


pub fn lists_router(state: ListsRouterState) -> Router {
    Router::new()
        .route("/pages/:page_id/lists", get(list_lists).post(create_list))
        .route(
            "/pages/:page_id/lists/:id",
            get(get_list).patch(update_list).delete(delete_list),
        )
        .route("/lists/:list_id/items", get(list_items).post(create_item))
        .route(
            "/lists/:list_id/items/:id",
            get(get_item).patch(update_item).delete(delete_item),
        )
        .with_state(state)
}

// List all lists in a page
async fn list_lists(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
) -> Result<Json<Vec<List>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user has access to page
    if !state.page_repo.check_access(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let lists = state.list_repo.list_by_page_id(page_id).await?;

    Ok(Json(lists))
}

// Create new list
async fn create_list(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path(page_id): Path<Uuid>,
    Json(payload): Json<CreateList>,
) -> Result<Json<List>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let list = state.list_repo.create_list(page_id, payload).await?;

    Ok(Json(list))
}

// Get single list with items
async fn get_list(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((page_id, list_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ListWithItems>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user has access to page
    if !state.page_repo.check_access(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let list = state
        .list_repo
        .find_by_id(list_id, page_id)
        .await?
        .ok_or(AppError::NotFound)?;

    let items = state.list_repo.list_items_by_list_id(list_id).await?;

    Ok(Json(ListWithItems { list, items }))
}

// Update list
async fn update_list(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((page_id, list_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateList>,
) -> Result<Json<List>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let list = state
        .list_repo
        .update_list(list_id, page_id, payload)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(list))
}

// Delete list
async fn delete_list(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((page_id, list_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    state.list_repo.delete_list(list_id, page_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

// List all items in a list
async fn list_items(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path(list_id): Path<Uuid>,
) -> Result<Json<Vec<ListItem>>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Get page_id from list
    let page_id = state
        .list_repo
        .get_page_id_for_list(list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user has access to page
    if !state.page_repo.check_access(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let items = state.list_repo.list_items_by_list_id(list_id).await?;

    Ok(Json(items))
}

// Create new item
async fn create_item(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path(list_id): Path<Uuid>,
    Json(payload): Json<CreateListItem>,
) -> Result<Json<ListItem>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Get page_id from list
    let page_id = state
        .list_repo
        .get_page_id_for_list(list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let item = state.list_repo.create_item(list_id, payload).await?;

    Ok(Json(item))
}

// Get single item
async fn get_item(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((list_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<Json<ListItem>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Get page_id from list
    let page_id = state
        .list_repo
        .get_page_id_for_list(list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user has access to page
    if !state.page_repo.check_access(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let item = state
        .list_repo
        .find_item_by_id(item_id, list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(item))
}

// Update item
async fn update_item(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((list_id, item_id)): Path<(Uuid, Uuid)>,
    Json(payload): Json<UpdateListItem>,
) -> Result<Json<ListItem>, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Get page_id from list
    let page_id = state
        .list_repo
        .get_page_id_for_list(list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    let item = state
        .list_repo
        .update_item(item_id, list_id, payload)
        .await?
        .ok_or(AppError::NotFound)?;

    Ok(Json(item))
}

// Delete item
async fn delete_item(
    State(state): State<ListsRouterState>,
    Extension(claims): Extension<Claims>,
    Path((list_id, item_id)): Path<(Uuid, Uuid)>,
) -> Result<StatusCode, AppError> {
    let user_id = Uuid::parse_str(&claims.sub)
        .map_err(|_| AppError::BadRequest("Invalid user ID".to_string()))?;

    // Get page_id from list
    let page_id = state
        .list_repo
        .get_page_id_for_list(list_id)
        .await?
        .ok_or(AppError::NotFound)?;

    // Check if user can edit
    if !state.page_repo.check_edit_permission(page_id, user_id).await? {
        return Err(AppError::Forbidden);
    }

    state.list_repo.delete_item(item_id, list_id).await?;

    Ok(StatusCode::NO_CONTENT)
}
