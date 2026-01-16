use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct User {
    pub id: Uuid,
    pub twitch_id: String,
    pub username: String,
    pub display_name: Option<String>,
    pub profile_image_url: Option<String>,
    pub email: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateUser {
    pub twitch_id: String,
    pub username: String,
    pub display_name: Option<String>,
    pub profile_image_url: Option<String>,
    pub email: Option<String>,
}
