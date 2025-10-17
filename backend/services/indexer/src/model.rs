use serde::{Deserialize, Serialize};
use time::OffsetDateTime;
use uuid::Uuid;
use strum::{Display, EnumString};

#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum PlatformSource {
    Polymarket,
    Augur,
    Kalshi,
    Thales,
    Omen,
}

#[derive(Debug, Clone, Serialize, Deserialize, Display, EnumString)]
#[strum(serialize_all = "snake_case")]
pub enum MarketEventKind {
    MarketMetadata,
    OrderBook,
    Trade,
    Resolution,
    Snapshot,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketEvent {
    pub id: Uuid,
    pub source: PlatformSource,
    pub kind: MarketEventKind,
    pub market_id: String,
    pub payload: serde_json::Value,
    pub observed_at: OffsetDateTime,
    pub event_fingerprint: Option<String>, // Groups markets for same underlying event
}

impl MarketEvent {
    pub fn new(source: PlatformSource, kind: MarketEventKind, market_id: String, payload: serde_json::Value, observed_at: OffsetDateTime) -> Self {
        Self { 
            id: Uuid::new_v4(), 
            source, 
            kind, 
            market_id, 
            payload, 
            observed_at,
            event_fingerprint: None,
        }
    }

    pub fn with_fingerprint(mut self, fingerprint: String) -> Self {
        self.event_fingerprint = Some(fingerprint);
        self
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedMarketEvent {
    pub id: Uuid,
    pub source: PlatformSource,
    pub kind: MarketEventKind,
    pub market_id: String,
    pub market_slug: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub outcomes: Option<Vec<String>>,
    pub prices: Option<Vec<f64>>, 
    pub traded_amount: Option<f64>,
    pub resolved_outcome: Option<String>,
    pub observed_at: OffsetDateTime,
    pub event_fingerprint: Option<String>, // Groups markets for same underlying event
}


