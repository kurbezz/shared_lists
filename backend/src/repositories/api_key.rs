use crate::models::ApiKey;
use anyhow::{Context, Result};
use chrono::Utc;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Clone)]
pub struct ApiKeyRepository {
    pool: SqlitePool,
}

impl ApiKeyRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        user_id: Uuid,
        name: Option<&str>,
        token_hash: &str,
        scopes: &str,
    ) -> Result<ApiKey> {
        let id = Uuid::new_v4().to_string();
        let now = Utc::now();

        sqlx::query!(
            r#"INSERT INTO api_keys (id, user_id, name, token_hash, scopes, revoked, created_at)
               VALUES (?, ?, ?, ?, ?, 0, ?)"#,
            id,
            user_id,
            name,
            token_hash,
            scopes,
            now
        )
        .execute(&self.pool)
        .await
        .context("Failed to insert API key")?;

        let api_key = sqlx::query_as::<_, ApiKey>(
            r#"SELECT id, user_id, name, token_hash, scopes,
                      revoked, created_at
               FROM api_keys WHERE id = ?"#,
        )
        .bind(&id)
        .fetch_one(&self.pool)
        .await
        .context("Failed to fetch created API key")?;

        Ok(api_key)
    }

    pub async fn find_by_token_hash(&self, token_hash: &str) -> Result<Option<ApiKey>> {
        let api_key = sqlx::query_as::<_, ApiKey>(
            r#"SELECT id, user_id, name, token_hash, scopes,
                      revoked, created_at
               FROM api_keys WHERE token_hash = ? AND revoked = 0"#,
        )
        .bind(token_hash)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to query API key by token hash")?;

        Ok(api_key)
    }

    pub async fn list_by_user(&self, user_id: Uuid) -> Result<Vec<ApiKey>> {
        let api_keys = sqlx::query_as::<_, ApiKey>(
            r#"SELECT id, user_id, name, token_hash, scopes,
                      revoked, created_at
               FROM api_keys WHERE user_id = ? ORDER BY created_at DESC"#,
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await
        .context("Failed to list user API keys")?;

        Ok(api_keys)
    }

    pub async fn revoke(&self, id: &str, user_id: Uuid) -> Result<bool> {
        let result = sqlx::query!(
            r#"UPDATE api_keys SET revoked = 1 WHERE id = ? AND user_id = ? AND revoked = 0"#,
            id,
            user_id
        )
        .execute(&self.pool)
        .await
        .context("Failed to revoke API key")?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn delete(&self, id: &str, user_id: Uuid) -> Result<bool> {
        let result = sqlx::query!(
            r#"DELETE FROM api_keys WHERE id = ? AND user_id = ?"#,
            id,
            user_id
        )
        .execute(&self.pool)
        .await
        .context("Failed to delete API key")?;

        Ok(result.rows_affected() > 0)
    }

    #[allow(dead_code)]
    pub async fn find_by_id(&self, id: &str, user_id: Uuid) -> Result<Option<ApiKey>> {
        let api_key = sqlx::query_as::<_, ApiKey>(
            r#"SELECT id, user_id, name, token_hash, scopes,
                      revoked, created_at
               FROM api_keys WHERE id = ? AND user_id = ?"#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await
        .context("Failed to find API key by ID")?;

        Ok(api_key)
    }
}
