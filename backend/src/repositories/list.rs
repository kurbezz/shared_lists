use crate::models::{
    CreateList, CreateListItem, List, ListItem, UpdateList, UpdateListItem,
};
use anyhow::Result;
use sqlx::{SqlitePool, Sqlite, QueryBuilder};
use uuid::Uuid;

#[derive(Clone)]
pub struct ListRepository {
    pool: SqlitePool,
}

impl ListRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn list_by_page_id(&self, page_id: Uuid) -> Result<Vec<List>> {
        let lists = sqlx::query_as::<_, List>(
            "SELECT * FROM lists WHERE page_id = $1 ORDER BY position ASC, created_at ASC",
        )
        .bind(page_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(lists)
    }

    pub async fn find_by_id(&self, id: Uuid, page_id: Uuid) -> Result<Option<List>> {
        let list = sqlx::query_as::<_, List>("SELECT * FROM lists WHERE id = $1 AND page_id = $2")
            .bind(id)
            .bind(page_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(list)
    }

    pub async fn create_list(&self, page_id: Uuid, data: CreateList) -> Result<List> {
        let position = if let Some(pos) = data.position {
            pos
        } else {
            let max_pos: Option<i32> = sqlx::query_scalar(
                "SELECT COALESCE(MAX(position), -1) FROM lists WHERE page_id = $1",
            )
            .bind(page_id)
            .fetch_one(&self.pool)
            .await?;
            max_pos.unwrap_or(-1) + 1
        };

        let id = Uuid::new_v4();
        let list = sqlx::query_as::<_, List>(
            r#"
            INSERT INTO lists (id, page_id, title, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(page_id)
        .bind(&data.title)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(list)
    }

    pub async fn update_list(
        &self,
        id: Uuid,
        page_id: Uuid,
        data: UpdateList,
    ) -> Result<Option<List>> {
        let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE lists SET ");
        let mut separated = qb.separated(", ");

        if let Some(title) = &data.title {
            separated.push("title = ");
            separated.push_bind_unseparated(title);
        }

        if let Some(position) = &data.position {
            separated.push("position = ");
            separated.push_bind_unseparated(position);
        }

        if data.title.is_none() && data.position.is_none() {
            return self.find_by_id(id, page_id).await;
        }

        qb.push(" WHERE id = ");
        qb.push_bind(id);
        qb.push(" AND page_id = ");
        qb.push_bind(page_id);
        qb.push(" RETURNING *");

        let list = qb
            .build_query_as::<List>()
            .fetch_optional(&self.pool)
            .await?;
        Ok(list)
    }

    pub async fn delete_list(&self, id: Uuid, page_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM lists WHERE id = $1 AND page_id = $2")
            .bind(id)
            .bind(page_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list_items_by_list_id(&self, list_id: Uuid) -> Result<Vec<ListItem>> {
        let items = sqlx::query_as::<_, ListItem>(
            "SELECT * FROM list_items WHERE list_id = $1 ORDER BY position ASC, created_at ASC",
        )
        .bind(list_id)
        .fetch_all(&self.pool)
        .await?;
        Ok(items)
    }

    pub async fn find_item_by_id(&self, id: Uuid, list_id: Uuid) -> Result<Option<ListItem>> {
        let item =
            sqlx::query_as::<_, ListItem>("SELECT * FROM list_items WHERE id = $1 AND list_id = $2")
                .bind(id)
                .bind(list_id)
                .fetch_optional(&self.pool)
                .await?;
        Ok(item)
    }

    pub async fn create_item(&self, list_id: Uuid, data: CreateListItem) -> Result<ListItem> {
        let position = if let Some(pos) = data.position {
            pos
        } else {
            let max_pos: Option<i32> = sqlx::query_scalar(
                "SELECT COALESCE(MAX(position), -1) FROM list_items WHERE list_id = $1",
            )
            .bind(list_id)
            .fetch_one(&self.pool)
            .await?;
            max_pos.unwrap_or(-1) + 1
        };

        let id = Uuid::new_v4();
        let item = sqlx::query_as::<_, ListItem>(
            r#"
            INSERT INTO list_items (id, list_id, content, position)
            VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(list_id)
        .bind(&data.content)
        .bind(position)
        .fetch_one(&self.pool)
        .await?;
        Ok(item)
    }

    pub async fn update_item(
        &self,
        id: Uuid,
        list_id: Uuid,
        data: UpdateListItem,
    ) -> Result<Option<ListItem>> {
        let mut qb: QueryBuilder<Sqlite> = QueryBuilder::new("UPDATE list_items SET ");
        let mut separated = qb.separated(", ");

        if let Some(content) = &data.content {
            separated.push("content = ");
            separated.push_bind_unseparated(content);
        }

        if let Some(checked) = &data.checked {
            separated.push("checked = ");
            separated.push_bind_unseparated(*checked as i32);
        }

        if let Some(position) = &data.position {
            separated.push("position = ");
            separated.push_bind_unseparated(position);
        }

        if data.content.is_none() && data.checked.is_none() && data.position.is_none() {
            return self.find_item_by_id(id, list_id).await;
        }

        qb.push(" WHERE id = ");
        qb.push_bind(id);
        qb.push(" AND list_id = ");
        qb.push_bind(list_id);
        qb.push(" RETURNING *");

        let item = qb
            .build_query_as::<ListItem>()
            .fetch_optional(&self.pool)
            .await?;
        Ok(item)
    }

    pub async fn delete_item(&self, id: Uuid, list_id: Uuid) -> Result<()> {
        sqlx::query("DELETE FROM list_items WHERE id = $1 AND list_id = $2")
            .bind(id)
            .bind(list_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_page_id_for_list(&self, list_id: Uuid) -> Result<Option<Uuid>> {
        let page_id: Option<Uuid> = sqlx::query_scalar("SELECT page_id FROM lists WHERE id = $1")
            .bind(list_id)
            .fetch_optional(&self.pool)
            .await?;
        Ok(page_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::tests_utils::setup_db;
    use crate::models::{CreateUser, CreatePage, CreateList, CreateListItem};

    #[tokio::test]
    async fn test_list_and_items_crud() -> anyhow::Result<()> {
        let pool = setup_db().await;
        let user_repo = crate::repositories::UserRepository::new(pool.clone());
        let page_repo = crate::repositories::PageRepository::new(pool.clone());
        let repo = ListRepository::new(pool.clone());

        // Create user and page
        let creator = user_repo
            .create(CreateUser {
                twitch_id: "u1".to_string(),
                username: "u1".to_string(),
                display_name: None,
                profile_image_url: None,
                email: None,
            })
            .await?;

        let page = page_repo
            .create(creator.id, CreatePage { title: "P".to_string(), description: None })
            .await?;

        // Create lists
        let l1 = repo
            .create_list(page.id, CreateList { title: "L1".to_string(), position: None })
            .await?;
        let l2 = repo
            .create_list(page.id, CreateList { title: "L2".to_string(), position: None })
            .await?;

        let lists = repo.list_by_page_id(page.id).await?;
        assert_eq!(lists.len(), 2);
        assert_eq!(lists[0].title, "L1");
        assert_eq!(lists[1].title, "L2");

        // Create items
        let i1 = repo.create_item(l1.id, CreateListItem { content: "a".to_string(), position: None }).await?;
        let i2 = repo.create_item(l1.id, CreateListItem { content: "b".to_string(), position: None }).await?;

        let items = repo.list_items_by_list_id(l1.id).await?;
        assert_eq!(items.len(), 2);
        assert_eq!(items[0].content, "a");
        assert_eq!(items[1].content, "b");

        // Update list
        let updated_list = repo.update_list(l2.id, page.id, crate::models::UpdateList { title: Some("L2-new".to_string()), position: Some(0)}).await?.expect("list exists");
        assert_eq!(updated_list.title, "L2-new");

        // Update item
        let updated_item = repo.update_item(i1.id, l1.id, crate::models::UpdateListItem{ content: Some("a-up".to_string()), checked: Some(true), position: Some(1)}).await?.expect("item exists");
        assert_eq!(updated_item.content, "a-up");
        assert!(updated_item.checked);

        // Delete item and list
        repo.delete_item(i2.id, l1.id).await?;
        let item_opt = repo.find_item_by_id(i2.id, l1.id).await?;
        assert!(item_opt.is_none());

        repo.delete_list(l1.id, page.id).await?;
        let list_opt = repo.find_by_id(l1.id, page.id).await?;
        assert!(list_opt.is_none());

        Ok(())
    }
}

