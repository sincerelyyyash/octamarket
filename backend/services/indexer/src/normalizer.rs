use crate::model::{MarketEvent, NormalizedMarketEvent};

pub fn normalize(event: &MarketEvent) -> NormalizedMarketEvent {
    // Minimal placeholder mapping per kind; will be refined in source-specific payloads
    let mut name = None;
    let mut outcomes = None;
    let mut prices = None;
    let mut status = None;
    let mut traded_amount = None;
    let mut resolved_outcome = None;

    if let Some(n) = event.payload.get("name").and_then(|v| v.as_str()) {
        name = Some(n.to_string());
    }
    if let Some(v) = event.payload.get("outcomes").and_then(|v| v.as_array()) {
        outcomes = Some(v.iter().filter_map(|o| o.as_str().map(|s| s.to_string())).collect());
    }
    if let Some(v) = event.payload.get("prices").and_then(|v| v.as_array()) {
        prices = Some(v.iter().filter_map(|p| p.as_f64()).collect());
    }
    if let Some(s) = event.payload.get("status").and_then(|v| v.as_str()) {
        status = Some(s.to_string());
    }
    if let Some(a) = event.payload.get("traded_amount").and_then(|v| v.as_f64()) {
        traded_amount = Some(a);
    }
    if let Some(r) = event.payload.get("resolved_outcome").and_then(|v| v.as_str()) {
        resolved_outcome = Some(r.to_string());
    }

    NormalizedMarketEvent {
        id: event.id,
        source: event.source.clone(),
        kind: event.kind.clone(),
        market_id: event.market_id.clone(),
        market_slug: event.payload.get("slug").and_then(|v| v.as_str()).map(|s| s.to_string()),
        name,
        status,
        outcomes,
        prices,
        traded_amount,
        resolved_outcome,
        observed_at: event.observed_at,
        event_fingerprint: event.event_fingerprint.clone(),
    }
}


