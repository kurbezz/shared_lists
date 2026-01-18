use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct ApiKey {
    pub id: String,
    pub user_id: Uuid,
    pub name: Option<String>,
    #[allow(dead_code)]
    #[serde(skip)]
    pub token_hash: String,
    pub scopes: String,
    pub revoked: bool,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub created_at: DateTime<Utc>,
}

impl ApiKey {
    pub fn scopes_as_vec(&self) -> Vec<String> {
        if self.scopes.is_empty() {
            Vec::new()
        } else {
            self.scopes.split(',').map(|s| s.trim().to_string()).collect()
        }
    }

    pub fn to_response(&self) -> ApiKeyResponse {
        ApiKeyResponse {
            id: self.id.clone(),
            name: self.name.clone(),
            scopes: self.scopes_as_vec(),
            revoked: self.revoked,
            created_at: self.created_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ApiKeyResponse {
    pub id: String,
    pub name: Option<String>,
    pub scopes: Vec<String>,
    pub revoked: bool,
    #[serde(with = "chrono::serde::ts_seconds")]
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct CreateApiKeyResponse {
    pub id: String,
    pub token: String,
}
