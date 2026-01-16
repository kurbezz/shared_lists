use crate::models::{
    CreatePage, Page, PagePermission, PagePermissionWithUser, PageWithPermission, UpdatePage,
    User,
};
use anyhow::Result;
use sqlx::{SqlitePool, Sqlite, QueryBuilder};
use uuid::Uuid;

#[derive(Clone)]
pub struct PageRepository {
    pool: SqlitePool,
}

impl PageRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list_for_user(&self, user_id: Uuid) -> Result<Vec<PageWithPermission>> {
        // Get pages created by user
        let created_pages = sqlx::query_as::<_, Page>(
            "SELECT * FROM pages WHERE creator_id = $1 ORDER BY created_at DESC",
        )
        .bind(user_id)
        .fetch_all(&self.pool)
        .await?;

        // Get pages shared with user
        let shared_permissions =
            sqlx::query_as::<_, PagePermission>("SELECT * FROM page_permissions WHERE user_id = $1")
                .bind(user_id)
                .fetch_all(&self.pool)
                .await?;

        let mut result = Vec::new();

        for page in created_pages {
            result.push(PageWithPermission {
                page,
                is_creator: true,
                can_edit: true,
            });
        }

        for perm in shared_permissions {
            if let Some(page) = sqlx::query_as::<_, Page>("SELECT * FROM pages WHERE id = $1")
                .bind(perm.page_id)
                .fetch_optional(&self.pool)
                .await?
            {
                result.push(PageWithPermission {
                    page,
                    is_creator: false,
                    can_edit: perm.can_edit,
                });
            }
        }

        Ok(result)
    }

    pub async fn find_by_id(&self, id: Uuid) -> Result<Option<Page>> {
        let page = sqlx::query_as::<_, Page>("SELECT * FROM pages WHERE id = $1")
            .bind(id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(page)
    }

    pub async fn find_by_public_slug(&self, slug: &str) -> Result<Option<Page>> {
        let page = sqlx::query_as::<_, Page>("SELECT * FROM pages WHERE public_slug = $1")
            .bind(slug)
            .fetch_optional(&self.pool)
            .await?;
        Ok(page)
    }

    pub async fn create(&self, creator_id: Uuid, data: CreatePage) -> Result<Page> {
        let id = Uuid::new_v4();
        let page = sqlx::query_as::<_, Page>(
            r#"
            INSERT INTO pages (id, title, description, creator_id)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(&data.title)
        .bind(&data.description)
        .bind(creator_id)
        .fetch_one(&self.pool)
        .await?;
        Ok(page)
    }

    pub async fn update(&self, id: Uuid, data: UpdatePage) -> Result<Option<Page>> {
        let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE pages SET ");
        let mut separated = qb.separated(", ");

        if let Some(title) = &data.title {
            separated.push("title = ");
            separated.push_bind(title);
        }

        if let Some(description) = &data.description {
            separated.push("description = ");
            separated.push_bind(description);
        }

        if data.title.is_none() && data.description.is_none() {
            return self.find_by_id(id).await;
        }

        qb.push(" WHERE id = ");
        qb.push_bind(id);
        qb.push(" RETURNING *");

        let page = qb
            .build_query_as::<Page>()
            .fetch_optional(&self.pool)
            .await?;
        Ok(page)
    }

    pub async fn delete(&self, id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM pages WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn set_public_slug(&self, id: Uuid, slug: Option<String>) -> Result<Page> {
        let page = sqlx::query_as::<_, Page>(
            "UPDATE pages SET public_slug = $1 WHERE id = $2 RETURNING *",
        )
        .bind(slug)
        .bind(id)
        .fetch_one(&self.pool)
        .await?;
        Ok(page)
    }

    pub async fn get_permissions(&self, page_id: Uuid) -> Result<Vec<PagePermissionWithUser>> {
        let permissions = sqlx::query_as::<_, PagePermission>(
            "SELECT * FROM page_permissions WHERE page_id = $1 ORDER BY created_at DESC",
        )
        .bind(page_id)
        .fetch_all(&self.pool)
        .await?;

        let mut result = Vec::new();
        for permission in permissions {
            let user = sqlx::query_as::<_, User>("SELECT * FROM users WHERE id = $1")
                .bind(permission.user_id)
                .fetch_one(&self.pool)
                .await?;
            result.push(PagePermissionWithUser { permission, user });
        }
        Ok(result)
    }

    pub async fn grant_permission(
        &self,
        page_id: Uuid,
        user_id: Uuid,
        can_edit: bool,
        granted_by: Uuid,
    ) -> Result<PagePermission> {
        let id = Uuid::new_v4();
        let permission = sqlx::query_as::<_, PagePermission>(
            r#"
            INSERT INTO page_permissions (id, page_id, user_id, can_edit, granted_by)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(page_id)
        .bind(user_id)
        .bind(can_edit)
        .bind(granted_by)
        .fetch_one(&self.pool)
        .await?;
        Ok(permission)
    }

    pub async fn update_permission(
        &self,
        page_id: Uuid,
        permission_id: Uuid,
        can_edit: bool,
    ) -> Result<Option<PagePermission>> {
        let permission = sqlx::query_as::<_, PagePermission>(
            "UPDATE page_permissions SET can_edit = $1 WHERE id = $2 AND page_id = $3 RETURNING *",
        )
        .bind(can_edit)
        .bind(permission_id)
        .bind(page_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(permission)
    }

    pub async fn revoke_permission(&self, page_id: Uuid, permission_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM page_permissions WHERE id = $1 AND page_id = $2")
            .bind(permission_id)
            .bind(page_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_user_permission(
        &self,
        page_id: Uuid,
        user_id: Uuid,
    ) -> Result<Option<PagePermission>> {
        let permission = sqlx::query_as::<_, PagePermission>(
            "SELECT * FROM page_permissions WHERE page_id = $1 AND user_id = $2",
        )
        .bind(page_id)
        .bind(user_id)
        .fetch_optional(&self.pool)
        .await?;
        Ok(permission)
    }

    pub async fn check_access(&self, page_id: Uuid, user_id: Uuid) -> Result<bool> {
        let page = self.find_by_id(page_id).await?;
        if let Some(page) = page {
            if page.creator_id == user_id {
                return Ok(true);
            }
            let has_permission: bool = sqlx::query_scalar(
                "SELECT EXISTS(SELECT 1 FROM page_permissions WHERE page_id = $1 AND user_id = $2)",
            )
            .bind(page_id)
            .bind(user_id)
            .fetch_one(&self.pool)
            .await?;
            return Ok(has_permission);
        }
        Ok(false)
    }

    pub async fn check_edit_permission(&self, page_id: Uuid, user_id: Uuid) -> Result<bool> {
        let page = self.find_by_id(page_id).await?;
        if let Some(page) = page {
            if page.creator_id == user_id {
                return Ok(true);
            }
            let permission = self.get_user_permission(page_id, user_id).await?;
            return Ok(permission.map(|p| p.can_edit).unwrap_or(false));
        }
        Ok(false)
    }
}
