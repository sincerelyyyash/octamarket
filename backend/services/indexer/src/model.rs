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

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AggregatedEvent {
    pub id: Uuid,
    pub event_fingerprint: String,
    pub title: String,
    pub description: Option<String>,
    pub end_time: Option<OffsetDateTime>,
    pub status: String,
    pub created_at: OffsetDateTime,
    pub updated_at: OffsetDateTime,
    pub market_sources: Vec<MarketSource>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MarketSource {
    pub id: Uuid,
    pub source: PlatformSource,
    pub market_id: String,
    pub market_slug: Option<String>,
    pub name: Option<String>,
    pub status: Option<String>,
    pub outcomes: Option<Vec<String>>,
    pub prices: Option<Vec<f64>>,
    pub traded_amount: Option<f64>,
    pub resolved_outcome: Option<String>,
    pub observed_at: OffsetDateTime,
    pub raw_payload: serde_json::Value,
    pub price_history: Option<Vec<PriceHistoryEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceHistoryEntry {
    pub id: Uuid,
    pub market_source_id: Uuid,
    pub outcome_index: i32,
    pub outcome_name: String,
    pub price: f64,
    pub volume: Option<f64>,
    pub timestamp: OffsetDateTime,
    pub source_data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EventPriceData {
    pub event_fingerprint: String,
    pub event_title: String,
    pub source: String,
    pub market_id: String,
    pub market_name: Option<String>,
    pub prices: Option<serde_json::Value>,
    pub outcomes: Option<serde_json::Value>,
    pub observed_at: OffsetDateTime,
    pub traded_amount: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceSnapshot {
    pub timestamp: OffsetDateTime,
    pub prices: Vec<OutcomePrice>,
    pub volume: Option<f64>,
    pub source: PlatformSource,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OutcomePrice {
    pub outcome_name: String,
    pub outcome_index: i32,
    pub price: f64,
    pub volume: Option<f64>,
}


