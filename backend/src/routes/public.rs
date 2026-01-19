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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{CreateList, CreateListItem, CreatePage, CreateUser};
    use crate::tests_utils::setup_db;
    use axum::body::{self, Body};
    use axum::http::{Method, Request};
    use tower::util::ServiceExt; // for .oneshot()

    #[tokio::test]
    async fn test_get_public_page_route() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = crate::repositories::UserRepository::new(pool.clone());
        let page_repo = crate::repositories::PageRepository::new(pool.clone());
        let list_repo = crate::repositories::ListRepository::new(pool.clone());

        // Create data: user, page, list, items
        let creator = user_repo
            .create(CreateUser {
                twitch_id: "pub1".to_string(),
                username: "pubuser".to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await?;

        let page = page_repo
            .create(
                creator.id,
                CreatePage {
                    title: "PubPage".to_string(),
                    description: None,
                },
            )
            .await?;

        // set public slug
        page_repo
            .set_public_slug(page.id, Some("public-slug".to_string()))
            .await?;

        let list = list_repo
            .create_list(
                page.id,
                CreateList {
                    title: "L".to_string(),
                    position: None,
                    show_checkboxes: None,
                    show_progress: None,
                },
            )
            .await?;
        list_repo
            .create_item(
                list.id,
                CreateListItem {
                    content: "it1".to_string(),
                    position: None,
                },
            )
            .await?;

        // Create second list with flags disabled
        let list2 = list_repo
            .create_list(
                page.id,
                CreateList {
                    title: "Hidden Flags List".to_string(),
                    position: None,
                    show_checkboxes: Some(false),
                    show_progress: Some(false),
                },
            )
            .await?;
        list_repo
            .create_item(
                list2.id,
                CreateListItem {
                    content: "it2".to_string(),
                    position: None,
                },
            )
            .await?;

        // Build router
        let state = PublicRouterState {
            page_repo: std::sync::Arc::new(page_repo),
            list_repo: std::sync::Arc::new(list_repo),
        };
        let app = public_router(state);

        // Make request
        let req = Request::builder()
            .method(Method::GET)
            .uri("/public/public-slug")
            .body(Body::empty())?;

        let resp = app.oneshot(req).await.unwrap();
        assert_eq!(resp.status(), 200);

        let bytes = body::to_bytes(resp.into_body(), 64 * 1024).await?;
        let json: serde_json::Value = serde_json::from_slice(&bytes)?;
        assert_eq!(json["page"]["public_slug"].as_str(), Some("public-slug"));
        assert_eq!(json["lists"].as_array().map(|a| a.len()), Some(2));
        assert_eq!(
            json["lists"][0]["items"].as_array().map(|a| a.len()),
            Some(1)
        );
        assert_eq!(
            json["lists"][1]["items"].as_array().map(|a| a.len()),
            Some(1)
        );
        // first list should have flags enabled
        assert_eq!(json["lists"][0]["show_checkboxes"].as_bool(), Some(true));
        assert_eq!(json["lists"][0]["show_progress"].as_bool(), Some(true));
        // second list should have flags disabled
        assert_eq!(
            json["lists"][1]["title"].as_str(),
            Some("Hidden Flags List")
        );
        assert_eq!(json["lists"][1]["show_checkboxes"].as_bool(), Some(false));
        assert_eq!(json["lists"][1]["show_progress"].as_bool(), Some(false));

        Ok(())
    }
}
