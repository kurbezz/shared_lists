#[cfg(test)]
pub async fn setup_db() -> sqlx::SqlitePool {
    // Create an in-memory SQLite DB and run migrations
    let pool = sqlx::SqlitePool::connect("sqlite::memory:")
        .await
        .expect("Failed to create sqlite pool");

    // Ensure foreign keys are enforced
    sqlx::query("PRAGMA foreign_keys = ON;")
        .execute(&pool)
        .await
        .expect("Failed to enable foreign keys");

    // Run migrations from `migrations/` automatically (path is relative to crate root)
    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("Failed to run migrations");

    pool
}
