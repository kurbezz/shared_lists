use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use super::list_item::ListItem;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct List {
    pub id: Uuid,
    pub page_id: Uuid,
    pub title: String,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateList {
    pub title: String,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateList {
    pub title: Option<String>,
    pub position: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct ListWithItems {
    #[serde(flatten)]
    pub list: List,
    pub items: Vec<ListItem>,
}
