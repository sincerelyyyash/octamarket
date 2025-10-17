use anyhow::Context;
use bb8::Pool;
use bb8_postgres::PostgresConnectionManager;
use tokio_postgres::NoTls;

pub struct PostgresClient {
    pool: Pool<PostgresConnectionManager<NoTls>>,
}

impl PostgresClient {
    pub async fn new(url: &str) -> anyhow::Result<Self> {
        let manager = PostgresConnectionManager::new_from_stringlike(url, NoTls)
            .context("building pg manager")?;
        let pool = Pool::builder().build(manager).await.context("pg pool")?;
        Ok(Self { pool })
    }

    pub async fn ensure_schema(&self) -> anyhow::Result<()> {
        let conn = self.pool.get().await?;
        conn.batch_execute(
            r#"
            CREATE TABLE IF NOT EXISTS market_events (
                id uuid PRIMARY KEY,
                source text NOT NULL,
                kind text NOT NULL,
                market_id text NOT NULL,
                payload jsonb NOT NULL,
                observed_at timestamptz NOT NULL
            );

            CREATE INDEX IF NOT EXISTS idx_market_events_market_id ON market_events(market_id);
            "#,
        )
        .await?;
        Ok(())
    }
}



