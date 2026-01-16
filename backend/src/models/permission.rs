use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;
use super::user::User;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct PagePermission {
    pub id: Uuid,
    pub page_id: Uuid,
    pub user_id: Uuid,
    pub can_edit: bool,
    pub granted_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PagePermissionWithUser {
    #[serde(flatten)]
    pub permission: PagePermission,
    pub user: User,
}

#[derive(Debug, Deserialize)]
pub struct GrantPermission {
    pub user_id: Uuid,
    pub can_edit: bool,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePermission {
    pub can_edit: bool,
}
