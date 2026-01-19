use super::list_item::ListItem;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct List {
    pub id: Uuid,
    pub page_id: Uuid,
    pub title: String,
    pub position: i32,
    pub show_checkboxes: bool,
    pub show_progress: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateList {
    pub title: String,
    pub position: Option<i32>,
    pub show_checkboxes: Option<bool>,
    pub show_progress: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateList {
    pub title: Option<String>,
    pub position: Option<i32>,
    pub show_checkboxes: Option<bool>,
    pub show_progress: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ListWithItems {
    #[serde(flatten)]
    pub list: List,
    pub items: Vec<ListItem>,
}
