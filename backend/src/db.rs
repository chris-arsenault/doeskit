use tokio_postgres::{Client, NoTls};

use crate::models::*;

#[derive(Clone)]
pub struct PgPool {
    database_url: String,
}

impl PgPool {
    pub fn new(database_url: String) -> Self {
        Self { database_url }
    }

    async fn connect(&self) -> Result<Client, Error> {
        // Use native-tls for RDS SSL
        let tls_connector = native_tls::TlsConnector::builder()
            .danger_accept_invalid_certs(true) // RDS certs
            .build()
            .map_err(|e| Error::Db(e.to_string()))?;
        let connector = postgres_native_tls::MakeTlsConnector::new(tls_connector);

        let (client, connection) = tokio_postgres::connect(&self.database_url, connector)
            .await
            .map_err(|e| Error::Db(e.to_string()))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PostgreSQL connection error: {e}");
            }
        });

        Ok(client)
    }

    // ── Supplements ─────────────────────────────────────────

    pub async fn list_supplements(&self) -> Result<Vec<Supplement>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query(
                "SELECT id, name, dose, unit, active, cycle_id, timing, training_day_only, notes FROM supplements ORDER BY timing, name",
                &[],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;

        Ok(rows.iter().map(|r| Supplement {
            id: r.get("id"),
            name: r.get("name"),
            dose: r.get("dose"),
            unit: r.get("unit"),
            active: r.get("active"),
            cycle_id: r.get("cycle_id"),
            timing: r.get("timing"),
            training_day_only: r.get("training_day_only"),
            notes: r.get("notes"),
        }).collect())
    }

    pub async fn put_supplement(&self, supp: &Supplement) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "INSERT INTO supplements (id, name, dose, unit, active, cycle_id, timing, training_day_only, notes)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                 ON CONFLICT (id) DO UPDATE SET
                   name = EXCLUDED.name, dose = EXCLUDED.dose, unit = EXCLUDED.unit,
                   active = EXCLUDED.active, cycle_id = EXCLUDED.cycle_id, timing = EXCLUDED.timing,
                   training_day_only = EXCLUDED.training_day_only, notes = EXCLUDED.notes",
                &[&supp.id, &supp.name, &supp.dose, &supp.unit, &supp.active,
                  &supp.cycle_id, &supp.timing, &supp.training_day_only, &supp.notes],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_supplement(&self, id: &str) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute("DELETE FROM supplements WHERE id = $1", &[&id])
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    // ── Cycles ──────────────────────────────────────────────

    pub async fn list_cycles(&self) -> Result<Vec<Cycle>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query("SELECT id, name, weeks_on, weeks_off, start_date FROM cycles ORDER BY name", &[])
            .await
            .map_err(|e| Error::Db(e.to_string()))?;

        Ok(rows.iter().map(|r| {
            let start: chrono::NaiveDate = r.get("start_date");
            Cycle {
                id: r.get("id"),
                name: r.get("name"),
                weeks_on: r.get::<_, i32>("weeks_on") as u32,
                weeks_off: r.get::<_, i32>("weeks_off") as u32,
                start_date: start.format("%Y-%m-%d").to_string(),
            }
        }).collect())
    }

    pub async fn put_cycle(&self, cycle: &Cycle) -> Result<(), Error> {
        let client = self.connect().await?;
        let start = chrono::NaiveDate::parse_from_str(&cycle.start_date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        client
            .execute(
                "INSERT INTO cycles (id, name, weeks_on, weeks_off, start_date)
                 VALUES ($1, $2, $3, $4, $5)
                 ON CONFLICT (id) DO UPDATE SET
                   name = EXCLUDED.name, weeks_on = EXCLUDED.weeks_on,
                   weeks_off = EXCLUDED.weeks_off, start_date = EXCLUDED.start_date",
                &[&cycle.id, &cycle.name, &(cycle.weeks_on as i32), &(cycle.weeks_off as i32), &start],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    pub async fn delete_cycle(&self, id: &str) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute("DELETE FROM cycles WHERE id = $1", &[&id])
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    // ── Config ──────────────────────────────────────────────

    pub async fn get_config<T: serde::de::DeserializeOwned>(&self, key: &str) -> Result<Option<T>, Error> {
        let client = self.connect().await?;
        let row = client
            .query_opt("SELECT value FROM config WHERE key = $1", &[&key])
            .await
            .map_err(|e| Error::Db(e.to_string()))?;

        match row {
            Some(r) => {
                let value: serde_json::Value = r.get("value");
                Ok(serde_json::from_value(value).ok())
            }
            None => Ok(None),
        }
    }

    pub async fn put_config<T: serde::Serialize>(&self, key: &str, value: &T) -> Result<(), Error> {
        let client = self.connect().await?;
        let json = serde_json::to_value(value).map_err(|e| Error::Db(e.to_string()))?;
        client
            .execute(
                "INSERT INTO config (key, value) VALUES ($1, $2)
                 ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                &[&key, &json],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    // ── Logs ────────────────────────────────────────────────

    pub async fn put_log(&self, date: &str, entry_type: &str, id: &str, value: &serde_json::Value) -> Result<(), Error> {
        let client = self.connect().await?;
        let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        client
            .execute(
                "INSERT INTO logs (date, entry_type, entry_id, value)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (date, entry_type, entry_id) DO UPDATE SET value = EXCLUDED.value",
                &[&d, &entry_type, &id, value],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;
        Ok(())
    }

    pub async fn get_logs_for_date(&self, date: &str) -> Result<Vec<LogEntry>, Error> {
        let client = self.connect().await?;
        let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let rows = client
            .query(
                "SELECT entry_type, entry_id, value, created_at FROM logs WHERE date = $1",
                &[&d],
            )
            .await
            .map_err(|e| Error::Db(e.to_string()))?;

        Ok(rows.iter().map(|r| {
            let ts: chrono::DateTime<chrono::Utc> = r.get("created_at");
            LogEntry {
                r#type: r.get("entry_type"),
                id: r.get("entry_id"),
                value: r.get("value"),
                timestamp: ts.to_rfc3339(),
            }
        }).collect())
    }

    pub async fn get_logs_for_range(&self, start: &str, end: &str) -> Result<Vec<LogEntry>, Error> {
        let client = self.connect().await?;
        let s = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let e = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let rows = client
            .query(
                "SELECT date, entry_type, entry_id, value, created_at FROM logs
                 WHERE date BETWEEN $1 AND $2 ORDER BY date, entry_type",
                &[&s, &e],
            )
            .await
            .map_err(|e2| Error::Db(e2.to_string()))?;

        Ok(rows.iter().map(|r| {
            let d: chrono::NaiveDate = r.get("date");
            LogEntry {
                r#type: r.get("entry_type"),
                id: r.get("entry_id"),
                value: r.get("value"),
                timestamp: d.format("%Y-%m-%d").to_string(),
            }
        }).collect())
    }
}

// ── Error ───────────────────────────────────────────────────

#[derive(Debug)]
pub enum Error {
    Db(String),
}

impl std::fmt::Display for Error {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Error::Db(e) => write!(f, "Database error: {e}"),
        }
    }
}
