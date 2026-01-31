use crate::error::AppError;
use crate::models::{
    Claims, CreateList, CreateListItem, List, ListItem, ListWithItems, UpdateList, UpdateListItem,
};
use crate::repositories::{ListRepository, PageRepository};
use crate::validators::{validate_title, validate_item_content};
use crate::error::FieldError;
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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
        return Err(AppError::Forbidden);
    }

    // Validate title and aggregate errors
    let mut errors: Vec<FieldError> = Vec::new();
    let mut title_res = validate_title(&payload.title);
    if let Err(crate::error::AppError::Validation(ref mut es)) = title_res {
        errors.append(es);
    } else if let Err(e) = title_res {
        return Err(e);
    }

    if !errors.is_empty() {
        return Err(crate::error::AppError::Validation(errors));
    }

    let mut payload = payload;
    payload.title = title_res.unwrap();

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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
        return Err(AppError::Forbidden);
    }

    // Validate title if provided
    let mut payload = payload;
    if let Some(ref t) = payload.title {
        payload.title = Some(validate_title(t)?);
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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
        return Err(AppError::Forbidden);
    }

    // Validate content
    let content = validate_item_content(&payload.content)?;
    let mut payload = payload;
    payload.content = content;

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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
        return Err(AppError::Forbidden);
    }

    // Validate content if provided
    let mut payload = payload;
    if let Some(ref c) = payload.content {
        payload.content = Some(validate_item_content(c)?);
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
    if !state
        .page_repo
        .check_edit_permission(page_id, user_id)
        .await?
    {
        return Err(AppError::Forbidden);
    }

    state.list_repo.delete_item(item_id, list_id).await?;

    Ok(StatusCode::NO_CONTENT)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreatePage, CreateUser};
    use crate::tests_utils::setup_db;
    use axum::body::{self, Body};
    use axum::http::{Method, Request};
    use tower::util::ServiceExt;

    async fn create_test_user(
        pool: &sqlx::SqlitePool,
        twitch_id: &str,
        username: &str,
    ) -> anyhow::Result<crate::models::User> {
        let user_repo = crate::repositories::UserRepository::new(pool.clone());
        user_repo
            .create(CreateUser {
                twitch_id: twitch_id.to_string(),
                username: username.to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await
    }

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
    async fn test_create_and_list_lists() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user = create_test_user(&pool, "tw1", "user1").await?;

        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let list_repo = Arc::new(crate::repositories::ListRepository::new(pool.clone()));

        // Create a page
        let page = page_repo
            .create(
                user.id,
                CreatePage {
                    title: "Test Page".to_string(),
                    description: None,
                },
            )
            .await?;

        let state = ListsRouterState {
            page_repo,
            list_repo,
        };
        let app = lists_router(state);
        let claims = create_claims(&user);

        // Create a list
        let create_payload = serde_json::json!({
            "title": "Shopping List",
            "position": null
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri(format!("/pages/{}/lists", page.id))
            .header("content-type", "application/json")
            .extension(claims.clone())
            .body(Body::from(serde_json::to_vec(&create_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let created_list: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(created_list["title"].as_str(), Some("Shopping List"));

        // List all lists
        let req = Request::builder()
            .method(Method::GET)
            .uri(format!("/pages/{}/lists", page.id))
            .extension(claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let lists: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(lists.len(), 1);

        Ok(())
    }

    #[tokio::test]
    async fn test_update_and_delete_list() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user = create_test_user(&pool, "tw2", "user2").await?;

        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let list_repo = Arc::new(crate::repositories::ListRepository::new(pool.clone()));

        let page = page_repo
            .create(
                user.id,
                CreatePage {
                    title: "Page".to_string(),
                    description: None,
                },
            )
            .await?;

        let list = list_repo
            .create_list(
                page.id,
                crate::models::CreateList {
                    title: "Old Title".to_string(),
                    position: None,
                    show_checkboxes: None,
                    show_progress: None,
                },
            )
            .await?;

        let state = ListsRouterState {
            page_repo,
            list_repo,
        };
        let app = lists_router(state);
        let claims = create_claims(&user);

        // Update list
        let update_payload = serde_json::json!({
            "title": "New Title"
        });

        let req = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/pages/{}/lists/{}", page.id, list.id))
            .header("content-type", "application/json")
            .extension(claims.clone())
            .body(Body::from(serde_json::to_vec(&update_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let updated: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(updated["title"].as_str(), Some("New Title"));

        // Delete list
        let req = Request::builder()
            .method(Method::DELETE)
            .uri(format!("/pages/{}/lists/{}", page.id, list.id))
            .extension(claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 204);

        Ok(())
    }

    #[tokio::test]
    async fn test_items_crud() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user = create_test_user(&pool, "tw3", "user3").await?;

        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let list_repo = Arc::new(crate::repositories::ListRepository::new(pool.clone()));

        let page = page_repo
            .create(
                user.id,
                CreatePage {
                    title: "Page".to_string(),
                    description: None,
                },
            )
            .await?;

        let list = list_repo
            .create_list(
                page.id,
                crate::models::CreateList {
                    title: "List".to_string(),
                    position: None,
                    show_checkboxes: None,
                    show_progress: None,
                },
            )
            .await?;

        let state = ListsRouterState {
            page_repo,
            list_repo,
        };
        let app = lists_router(state);
        let claims = create_claims(&user);

        // Create item
        let create_payload = serde_json::json!({
            "content": "Buy milk",
            "position": null
        });

        let req = Request::builder()
            .method(Method::POST)
            .uri(format!("/lists/{}/items", list.id))
            .header("content-type", "application/json")
            .extension(claims.clone())
            .body(Body::from(serde_json::to_vec(&create_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let created_item: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(created_item["content"].as_str(), Some("Buy milk"));
        let item_id = created_item["id"].as_str().unwrap();

        // List items
        let req = Request::builder()
            .method(Method::GET)
            .uri(format!("/lists/{}/items", list.id))
            .extension(claims.clone())
            .body(Body::empty())?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let items: Vec<serde_json::Value> = serde_json::from_slice(&bytes)?;
        assert_eq!(items.len(), 1);

        // Update item
        let update_payload = serde_json::json!({
            "content": "Buy bread",
            "checked": true
        });

        let req = Request::builder()
            .method(Method::PATCH)
            .uri(format!("/lists/{}/items/{}", list.id, item_id))
            .header("content-type", "application/json")
            .extension(claims.clone())
            .body(Body::from(serde_json::to_vec(&update_payload)?))?;

        let resp = app.clone().oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let updated: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(updated["content"].as_str(), Some("Buy bread"));
        assert_eq!(updated["checked"].as_bool(), Some(true));

        // Delete item
        let req = Request::builder()
            .method(Method::DELETE)
            .uri(format!("/lists/{}/items/{}", list.id, item_id))
            .extension(claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 204);

        Ok(())
    }

    #[tokio::test]
    async fn test_access_control() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let owner = create_test_user(&pool, "owner", "owner").await?;
        let other = create_test_user(&pool, "other", "other").await?;

        let page_repo = Arc::new(crate::repositories::PageRepository::new(pool.clone()));
        let list_repo = Arc::new(crate::repositories::ListRepository::new(pool.clone()));

        let page = page_repo
            .create(
                owner.id,
                CreatePage {
                    title: "Private Page".to_string(),
                    description: None,
                },
            )
            .await?;

        let _list = list_repo
            .create_list(
                page.id,
                crate::models::CreateList {
                    title: "List".to_string(),
                    position: None,
                    show_checkboxes: None,
                    show_progress: None,
                },
            )
            .await?;

        let state = ListsRouterState {
            page_repo,
            list_repo,
        };
        let app = lists_router(state);

        // Try to access as unauthorized user
        let other_claims = create_claims(&other);

        let req = Request::builder()
            .method(Method::GET)
            .uri(format!("/pages/{}/lists", page.id))
            .extension(other_claims)
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 403); // Forbidden

        Ok(())
    }
}
