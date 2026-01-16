use crate::error::AppError;
use crate::models::{ListWithItems, PublicPageData};
use crate::repositories::{ListRepository, PageRepository};
use axum::{
    extract::{Path, State},
    response::Json,
    routing::get,
    Router,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct PublicRouterState {
    pub page_repo: Arc<PageRepository>,
    pub list_repo: Arc<ListRepository>,
}


pub fn public_router(state: PublicRouterState) -> Router {
    Router::new()
        .route("/public/:slug", get(get_public_page))
        .with_state(state)
}

// Get page by public slug (no authentication required)
async fn get_public_page(
    State(state): State<PublicRouterState>,
    Path(slug): Path<String>,
) -> Result<Json<PublicPageData>, AppError> {
    // Find page by slug
    let page = state
        .page_repo
        .find_by_public_slug(&slug)
        .await?
        .ok_or(AppError::NotFound)?;

    // Get all lists for this page
    let lists = state.list_repo.list_by_page_id(page.id).await?;

    // Get items for each list
    let mut lists_with_items = Vec::new();
    for list in lists {
        let items = state.list_repo.list_items_by_list_id(list.id).await?;
        lists_with_items.push(ListWithItems { list, items });
    }

    Ok(Json(PublicPageData {
        page,
        lists: lists_with_items,
    }))
}
