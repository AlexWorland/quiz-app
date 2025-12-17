use sqlx::PgPool;

/// Database utility functions and connection helpers

/// Check if the database is healthy
pub async fn health_check(pool: &PgPool) -> bool {
    sqlx::query("SELECT 1")
        .fetch_one(pool)
        .await
        .is_ok()
}
