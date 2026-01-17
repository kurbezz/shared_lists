use crate::models::{CreateUser, User};
use anyhow::Result;
use sqlx::SqlitePool;
use uuid::Uuid;

#[derive(Clone)]
pub struct UserRepository {
    pool: SqlitePool,
}

impl UserRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_by_twitch_id(&self, twitch_id: &str) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE twitch_id = $1")
            .bind(twitch_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }



    pub async fn create(&self, user: CreateUser) -> Result<User> {
        let id = Uuid::new_v4();
        let user = sqlx::query_as::<_, User>(
            r#"
            INSERT INTO users (id, twitch_id, username, display_name, profile_image_url, email)
            VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&user.twitch_id)
        .bind(&user.username)
        .bind(&user.display_name)
        .bind(&user.profile_image_url)
        .bind(&user.email)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    pub async fn update_twitch_info(
        &self,
        twitch_id: &str,
        username: &str,
        display_name: &str,
        profile_image_url: &str,
        email: Option<String>,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET username = $1, display_name = $2, profile_image_url = $3, email = $4
            WHERE twitch_id = $5
            RETURNING *
            "#,
        )
        .bind(username)
        .bind(display_name)
        .bind(profile_image_url)
        .bind(email)
        .bind(twitch_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<User>> {
        let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(user)
    }

    pub async fn update_by_id(
        &self,
        id: Uuid,
        username: &str,
        display_name: Option<&str>,
        profile_image_url: Option<&str>,
        email: Option<String>,
    ) -> Result<User> {
        let user = sqlx::query_as::<_, User>(
            r#"
            UPDATE users
            SET username = $1, display_name = $2, profile_image_url = $3, email = $4
            WHERE id = $5
            RETURNING *
            "#,
        )
        .bind(username)
        .bind(display_name)
        .bind(profile_image_url)
        .bind(email)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(user)
    }

    pub async fn search(&self, query: &str, exclude_id: Uuid) -> Result<Vec<User>> {
        let search_pattern = format!("%{}%", query);
        let users = sqlx::query_as::<_, User>(
            r#"
            SELECT * FROM users 
            WHERE (username LIKE $1 OR display_name LIKE $1) 
            AND id != $2
            LIMIT 10
            "#
        )
        .bind(search_pattern)
        .bind(exclude_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(users)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::CreateUser;

    #[tokio::test]
    async fn test_create_find_update_search_user() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let repo = UserRepository::new(pool.clone());

        // Create user
        let create = CreateUser {
            twitch_id: "t123".to_string(),
            username: "tester".to_string(),
            display_name: Some("Test User".to_string()),
            profile_image_url: None,
            email: Some("test@example.com".to_string()),
        };

        let user = repo.create(create).await?;
        assert_eq!(user.twitch_id, "t123");
        assert_eq!(user.username, "tester");

        // Find by twitch id
        let found = repo.find_by_twitch_id(&user.twitch_id).await?;
        assert!(found.is_some());
        let found = found.unwrap();
        assert_eq!(found.id, user.id);

        // Update twitch info
        let updated = repo
            .update_twitch_info(
                &user.twitch_id,
                "tester2",
                "Tester 2",
                "http://image",
                None,
            )
            .await?;
        assert_eq!(updated.username, "tester2");
        assert_eq!(updated.display_name.as_deref(), Some("Tester 2"));

        // Search (excluding the user itself should return empty)
        let results = repo.search("tester2", user.id).await?;
        assert!(results.is_empty());

        Ok(())
    }
}

