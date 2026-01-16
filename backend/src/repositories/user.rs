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
