use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_dynamodb::Client;
use std::collections::HashMap;

use crate::models::*;

#[derive(Clone)]
pub struct DynamoClient {
    client: Client,
    table: String,
}

impl DynamoClient {
    pub fn new(client: Client, table: String) -> Self {
        Self { client, table }
    }

    // ── Supplements ─────────────────────────────────────────

    pub async fn list_supplements(&self) -> Result<Vec<Supplement>, Error> {
        let result = self
            .client
            .query()
            .table_name(&self.table)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("SUPP".into()))
            .send()
            .await?;

        Ok(result
            .items()
            .iter()
            .filter_map(|item| item_from_data(item))
            .collect())
    }

    pub async fn put_supplement(&self, supp: &Supplement) -> Result<(), Error> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S("SUPP".into()));
        item.insert("SK".into(), AttributeValue::S(supp.id.clone()));
        item.insert("data".into(), AttributeValue::S(serde_json::to_string(supp).unwrap()));

        self.client
            .put_item()
            .table_name(&self.table)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    pub async fn delete_supplement(&self, id: &str) -> Result<(), Error> {
        self.client
            .delete_item()
            .table_name(&self.table)
            .key("PK", AttributeValue::S("SUPP".into()))
            .key("SK", AttributeValue::S(id.into()))
            .send()
            .await?;
        Ok(())
    }

    // ── Cycles ──────────────────────────────────────────────

    pub async fn list_cycles(&self) -> Result<Vec<Cycle>, Error> {
        let result = self
            .client
            .query()
            .table_name(&self.table)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("CYCLE".into()))
            .send()
            .await?;

        Ok(result
            .items()
            .iter()
            .filter_map(|item| item_from_data(item))
            .collect())
    }

    pub async fn put_cycle(&self, cycle: &Cycle) -> Result<(), Error> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S("CYCLE".into()));
        item.insert("SK".into(), AttributeValue::S(cycle.id.clone()));
        item.insert("data".into(), AttributeValue::S(serde_json::to_string(cycle).unwrap()));

        self.client
            .put_item()
            .table_name(&self.table)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    pub async fn delete_cycle(&self, id: &str) -> Result<(), Error> {
        self.client
            .delete_item()
            .table_name(&self.table)
            .key("PK", AttributeValue::S("CYCLE".into()))
            .key("SK", AttributeValue::S(id.into()))
            .send()
            .await?;
        Ok(())
    }

    // ── Config ──────────────────────────────────────────────

    pub async fn get_config<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>, Error> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table)
            .key("PK", AttributeValue::S("CONFIG".into()))
            .key("SK", AttributeValue::S(key.into()))
            .send()
            .await?;

        match result.item() {
            Some(item) => {
                let data = get_s(item, "data");
                Ok(data.and_then(|d| serde_json::from_str(&d).ok()))
            }
            None => Ok(None),
        }
    }

    pub async fn put_config<T: serde::Serialize>(&self, key: &str, value: &T) -> Result<(), Error> {
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S("CONFIG".into()));
        item.insert("SK".into(), AttributeValue::S(key.into()));
        item.insert("data".into(), AttributeValue::S(serde_json::to_string(value).unwrap()));

        self.client
            .put_item()
            .table_name(&self.table)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    // ── Logs ────────────────────────────────────────────────

    pub async fn put_log(&self, date: &str, entry_type: &str, id: &str, value: &serde_json::Value) -> Result<(), Error> {
        let sk = format!("{date}#{entry_type}#{id}");
        let mut item = HashMap::new();
        item.insert("PK".into(), AttributeValue::S("LOG".into()));
        item.insert("SK".into(), AttributeValue::S(sk));
        item.insert("date".into(), AttributeValue::S(date.into()));
        item.insert("entry_type".into(), AttributeValue::S(entry_type.into()));
        item.insert("entry_id".into(), AttributeValue::S(id.into()));
        item.insert("value".into(), AttributeValue::S(serde_json::to_string(value).unwrap()));
        item.insert(
            "timestamp".into(),
            AttributeValue::S(chrono::Utc::now().to_rfc3339()),
        );

        self.client
            .put_item()
            .table_name(&self.table)
            .set_item(Some(item))
            .send()
            .await?;
        Ok(())
    }

    pub async fn get_logs_for_date(&self, date: &str) -> Result<Vec<LogEntry>, Error> {
        let result = self
            .client
            .query()
            .table_name(&self.table)
            .key_condition_expression("PK = :pk AND begins_with(SK, :prefix)")
            .expression_attribute_values(":pk", AttributeValue::S("LOG".into()))
            .expression_attribute_values(":prefix", AttributeValue::S(format!("{date}#")))
            .send()
            .await?;

        Ok(result
            .items()
            .iter()
            .filter_map(|item| log_entry_from_item(item))
            .collect())
    }

    pub async fn get_logs_for_range(&self, start: &str, end: &str) -> Result<Vec<LogEntry>, Error> {
        let result = self
            .client
            .query()
            .table_name(&self.table)
            .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
            .expression_attribute_values(":pk", AttributeValue::S("LOG".into()))
            .expression_attribute_values(":start", AttributeValue::S(format!("{start}#")))
            .expression_attribute_values(":end", AttributeValue::S(format!("{end}#~")))
            .send()
            .await?;

        Ok(result
            .items()
            .iter()
            .filter_map(|item| log_entry_from_item(item))
            .collect())
    }
}

// ── Helpers ─────────────────────────────────────────────────

fn get_s(item: &HashMap<String, AttributeValue>, key: &str) -> Option<String> {
    item.get(key)?.as_s().ok().cloned()
}

fn item_from_data<T: serde::de::DeserializeOwned>(item: &HashMap<String, AttributeValue>) -> Option<T> {
    let data = get_s(item, "data")?;
    serde_json::from_str(&data).ok()
}

fn log_entry_from_item(item: &HashMap<String, AttributeValue>) -> Option<LogEntry> {
    Some(LogEntry {
        r#type: get_s(item, "entry_type")?,
        id: get_s(item, "entry_id")?,
        value: serde_json::from_str(&get_s(item, "value")?).ok()?,
        timestamp: get_s(item, "timestamp")?,
    })
}

// ── Error ───────────────────────────────────────────────────

#[derive(Debug)]
pub enum Error {
    Dynamo(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Dynamo(e) => write!(f, "DynamoDB error: {e}"),
        }
    }
}

impl<E: std::error::Error> From<aws_sdk_dynamodb::error::SdkError<E>> for Error {
    fn from(e: aws_sdk_dynamodb::error::SdkError<E>) -> Self {
        Error::Dynamo(e.to_string())
    }
}
