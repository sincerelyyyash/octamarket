use anyhow::Context;
use rdkafka::{producer::{FutureProducer, FutureRecord}, ClientConfig};

pub struct KafkaClient {
    producer: FutureProducer,
    pub topic_raw: String,
    pub topic_normalized: String,
    pub topic_realtime: String,
    pub topic_resolved: String,
}

impl KafkaClient {
    pub fn new(brokers: &str) -> anyhow::Result<Self> {
        let producer: FutureProducer = ClientConfig::new()
            .set("bootstrap.servers", brokers)
            .set("message.timeout.ms", "5000")
            .create()
            .context("creating kafka producer")?;

        Ok(Self {
            producer,
            topic_raw: "markets.raw".into(),
            topic_normalized: "markets.normalized".into(),
            topic_realtime: "markets.realtime".into(),
            topic_resolved: "markets.resolved".into(),
        })
    }

    pub async fn send(&self, topic: &str, key: &str, payload: &str) -> anyhow::Result<()> {
        let record = FutureRecord::to(topic).key(key).payload(payload);
        let _ = self.producer.send(record, std::time::Duration::from_secs(5)).await;
        Ok(())
    }
}



