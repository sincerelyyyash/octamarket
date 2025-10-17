use crate::model::{MarketEvent, PlatformSource};
use sha2::{Digest, Sha256};
use std::collections::HashMap;

/// Generates a fingerprint for grouping markets that represent the same underlying event
pub struct EventFingerprinter {
    // Cache of known event patterns for efficiency
    event_patterns: HashMap<String, String>,
}

impl EventFingerprinter {
    pub fn new() -> Self {
        Self {
            event_patterns: HashMap::new(),
        }
    }

    /// Generate a fingerprint for a market event to group related markets
    pub fn fingerprint(&mut self, event: &MarketEvent) -> Option<String> {
        match event.source {
            PlatformSource::Polymarket => self.fingerprint_polymarket(event),
            PlatformSource::Augur => self.fingerprint_augur(event),
            PlatformSource::Kalshi => self.fingerprint_kalshi(event),
            PlatformSource::Thales => self.fingerprint_thales(event),
            PlatformSource::Omen => self.fingerprint_omen(event),
        }
    }

    fn fingerprint_polymarket(&mut self, event: &MarketEvent) -> Option<String> {
        // Extract key fields that identify the same event across platforms
        let question = event.payload.get("question")?.as_str()?;
        let end_time = event.payload.get("end_time")?.as_str()?;
        
        // Create a normalized question (lowercase, remove extra spaces)
        let normalized_question = question.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        
        // Hash the combination of normalized question + end time
        let fingerprint_data = format!("{}|{}", normalized_question, end_time);
        Some(self.hash_string(&fingerprint_data))
    }

    fn fingerprint_augur(&mut self, event: &MarketEvent) -> Option<String> {
        // Augur markets have title and endTime
        let title = event.payload.get("data")?
            .get("markets")?
            .as_array()?
            .first()?
            .get("title")?
            .as_str()?;
        
        let end_time = event.payload.get("data")?
            .get("markets")?
            .as_array()?
            .first()?
            .get("endTime")?
            .as_str()?;
        
        let normalized_title = title.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        
        let fingerprint_data = format!("{}|{}", normalized_title, end_time);
        Some(self.hash_string(&fingerprint_data))
    }

    fn fingerprint_kalshi(&mut self, event: &MarketEvent) -> Option<String> {
        // Kalshi markets have title and close_time
        let title = event.payload.get("data")?
            .as_array()?
            .first()?
            .get("title")?
            .as_str()?;
        
        let close_time = event.payload.get("data")?
            .as_array()?
            .first()?
            .get("close_time")?
            .as_str()?;
        
        let normalized_title = title.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        
        let fingerprint_data = format!("{}|{}", normalized_title, close_time);
        Some(self.hash_string(&fingerprint_data))
    }

    fn fingerprint_thales(&mut self, event: &MarketEvent) -> Option<String> {
        // Thales markets have question and end_of_round
        let question = event.payload.get("data")?
            .as_array()?
            .first()?
            .get("question")?
            .as_str()?;
        
        let end_time = event.payload.get("data")?
            .as_array()?
            .first()?
            .get("end_of_round")?
            .as_str()?;
        
        let normalized_question = question.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        
        let fingerprint_data = format!("{}|{}", normalized_question, end_time);
        Some(self.hash_string(&fingerprint_data))
    }

    fn fingerprint_omen(&mut self, event: &MarketEvent) -> Option<String> {
        // Omen markets have question and end_date
        let question = event.payload.get("data")?
            .get("markets")?
            .as_array()?
            .first()?
            .get("question")?
            .as_str()?;
        
        let end_date = event.payload.get("data")?
            .get("markets")?
            .as_array()?
            .first()?
            .get("end_date")?
            .as_str()?;
        
        let normalized_question = question.to_lowercase()
            .split_whitespace()
            .collect::<Vec<&str>>()
            .join(" ");
        
        let fingerprint_data = format!("{}|{}", normalized_question, end_date);
        Some(self.hash_string(&fingerprint_data))
    }

    fn hash_string(&self, input: &str) -> String {
        let mut hasher = Sha256::new();
        hasher.update(input.as_bytes());
        format!("{:x}", hasher.finalize())
    }
}

impl Default for EventFingerprinter {
    fn default() -> Self {
        Self::new()
    }
}
