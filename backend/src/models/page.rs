use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use super::list::ListWithItems;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Page {
    pub id: Uuid,
    pub title: String,
    pub description: Option<String>,
    pub creator_id: Uuid,
    pub public_slug: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePage {
    pub title: String,
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePage {
    pub title: Option<String>,
    pub description: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PageWithPermission {
    #[serde(flatten)]
    pub page: Page,
    pub is_creator: bool,
    pub can_edit: bool,
}

#[derive(Debug, Deserialize)]
pub struct SetPublicSlug {
    pub public_slug: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct PublicPageData {
    pub page: Page,
    pub lists: Vec<ListWithItems>,
}
