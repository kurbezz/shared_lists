use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ListItem {
    pub id: Uuid,
    pub list_id: Uuid,
    pub content: String,
    pub checked: bool,
    pub position: i32,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateListItem {
    pub content: String,
    pub position: Option<i32>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateListItem {
    pub content: Option<String>,
    pub checked: Option<bool>,
    pub position: Option<i32>,
}
