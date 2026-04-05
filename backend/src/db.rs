use tokio_postgres::Client;

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
        let pem = include_bytes!("../certs/rds-global-bundle.pem");
        let certs = rustls_pemfile::certs(&mut &pem[..])
            .collect::<Result<Vec<_>, _>>()
            .map_err(|e| Error::Db(format!("Failed to parse RDS CA bundle: {e}")))?;
        let mut root_store = rustls::RootCertStore::empty();
        for cert in certs {
            root_store
                .add(cert)
                .map_err(|e| Error::Db(format!("Failed to add RDS cert: {e}")))?;
        }
        let tls_config = rustls::ClientConfig::builder()
            .with_root_certificates(root_store)
            .with_no_client_auth();
        let tls = tokio_postgres_rustls::MakeRustlsConnect::new(tls_config);

        let (client, connection) = tokio_postgres::connect(&self.database_url, tls)
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        tokio::spawn(async move {
            if let Err(e) = connection.await {
                tracing::error!("PostgreSQL connection error: {e}");
            }
        });

        Ok(client)
    }

    // ── Supplement Types ────────────────────────────────────

    pub async fn list_types(&self) -> Result<Vec<SupplementType>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query(
                "SELECT id, name, timing, training_day_only, active, cycle_id, target_dose::float8, target_unit, instructions, sort_order
                 FROM supplement_types ORDER BY sort_order, name",
                &[],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(rows
            .iter()
            .map(|r| SupplementType {
                id: r.get("id"),
                name: r.get("name"),
                timing: r.get("timing"),
                training_day_only: r.get("training_day_only"),
                active: r.get("active"),
                cycle_id: r.get("cycle_id"),
                target_dose: r.get("target_dose"),
                target_unit: r.get("target_unit"),
                instructions: r.get("instructions"),
                sort_order: r.get("sort_order"),
            })
            .collect())
    }

    pub async fn update_type(
        &self,
        id: &str,
        timing: &str,
        training_day_only: bool,
        active: bool,
    ) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "UPDATE supplement_types SET timing = $1, training_day_only = $2, active = $3 WHERE id = $4",
                &[&timing, &training_day_only, &active, &id],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    // ── Supplement Brands ───────────────────────────────────

    pub async fn list_brands(&self) -> Result<Vec<SupplementBrand>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query(
                "SELECT sb.id, sb.type_id, sb.brand_id, b.name as brand_name, sb.product_name,
                        sb.serving_dose::float8, sb.serving_unit, sb.units_per_serving::float8,
                        sb.unit_name, sb.form, sb.instructions, sb.url,
                        sb.price_per_serving::float8, sb.subscription_discount::float8, sb.in_stock
                 FROM supplement_brands sb
                 JOIN brands b ON b.id = sb.brand_id
                 ORDER BY sb.type_id, b.name",
                &[],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(rows.iter().map(brand_from_row).collect())
    }

    pub async fn list_all_brands_table(&self) -> Result<Vec<Brand>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query("SELECT id, name FROM brands ORDER BY name", &[])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(rows
            .iter()
            .map(|r| Brand {
                id: r.get("id"),
                name: r.get("name"),
            })
            .collect())
    }

    pub async fn update_brand(
        &self,
        id: &str,
        body: &crate::routes::UpdateBrandBody,
    ) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "UPDATE supplement_brands SET
                   product_name = COALESCE($1, product_name),
                   serving_dose = COALESCE($2::float8::numeric, serving_dose),
                   serving_unit = COALESCE($3, serving_unit),
                   units_per_serving = COALESCE($4::float8::numeric, units_per_serving),
                   unit_name = COALESCE($5, unit_name),
                   form = COALESCE($6, form),
                   instructions = COALESCE($7, instructions),
                   url = COALESCE($8, url),
                   price_per_serving = COALESCE($9::float8::numeric, price_per_serving),
                   subscription_discount = COALESCE($10::float8::numeric, subscription_discount)
                 WHERE id = $11",
                &[
                    &body.product_name,
                    &body.serving_dose,
                    &body.serving_unit,
                    &body.units_per_serving,
                    &body.unit_name,
                    &body.form,
                    &body.instructions,
                    &body.url,
                    &body.price_per_serving,
                    &body.subscription_discount,
                    &id,
                ],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn list_research(&self) -> Result<Vec<BrandResearch>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query(
                "SELECT br.type_id, br.brand_id, b.name as brand_name, br.not_found, br.notes, br.last_researched
                 FROM brand_research br
                 JOIN brands b ON b.id = br.brand_id
                 ORDER BY br.type_id, b.name",
                &[],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(rows
            .iter()
            .map(|r| {
                let d: chrono::NaiveDate = r.get("last_researched");
                BrandResearch {
                    type_id: r.get("type_id"),
                    brand_id: r.get("brand_id"),
                    brand_name: r.get("brand_name"),
                    not_found: r.get("not_found"),
                    notes: r.get("notes"),
                    last_researched: d.format("%Y-%m-%d").to_string(),
                }
            })
            .collect())
    }

    pub async fn get_active_selections(
        &self,
    ) -> Result<std::collections::HashMap<String, String>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query("SELECT type_id, brand_id FROM active_selections", &[])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(rows
            .iter()
            .map(|r| {
                let type_id: String = r.get("type_id");
                let brand_id: String = r.get("brand_id");
                (type_id, brand_id)
            })
            .collect())
    }

    pub async fn set_active_brand(&self, type_id: &str, brand_id: &str) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "INSERT INTO active_selections (type_id, brand_id) VALUES ($1, $2)
                 ON CONFLICT (type_id) DO UPDATE SET brand_id = EXCLUDED.brand_id",
                &[&type_id, &brand_id],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    // ── Cycles ──────────────────────────────────────────────

    pub async fn list_cycles(&self) -> Result<Vec<Cycle>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query(
                "SELECT id, name, weeks_on, weeks_off, start_date FROM cycles ORDER BY name",
                &[],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(rows
            .iter()
            .map(|r| {
                let start: chrono::NaiveDate = r.get("start_date");
                Cycle {
                    id: r.get("id"),
                    name: r.get("name"),
                    weeks_on: r.get::<_, i32>("weeks_on") as u32,
                    weeks_off: r.get::<_, i32>("weeks_off") as u32,
                    start_date: start.format("%Y-%m-%d").to_string(),
                }
            })
            .collect())
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
                &[
                    &cycle.id,
                    &cycle.name,
                    &(cycle.weeks_on as i32),
                    &(cycle.weeks_off as i32),
                    &start,
                ],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn delete_cycle(&self, id: &str) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute("DELETE FROM cycles WHERE id = $1", &[&id])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    // ── Config ──────────────────────────────────────────────

    pub async fn get_config<T: serde::de::DeserializeOwned>(
        &self,
        key: &str,
    ) -> Result<Option<T>, Error> {
        let client = self.connect().await?;
        let row = client
            .query_opt("SELECT value FROM config WHERE key = $1", &[&key])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

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
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    // ── Day log ─────────────────────────────────────────────

    pub async fn ensure_day(&self, date: &str) -> Result<chrono::NaiveDate, Error> {
        let client = self.connect().await?;
        let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        client
            .execute(
                "INSERT INTO day_log (date) VALUES ($1) ON CONFLICT DO NOTHING",
                &[&d],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(d)
    }

    pub async fn get_day(&self, date: &str) -> Result<DayLog, Error> {
        let client = self.connect().await?;
        let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let row = client
            .query_opt("SELECT * FROM day_log WHERE date = $1", &[&d])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(match row {
            Some(r) => DayLog {
                date: date.to_string(),
                sleep: r.get("sleep"),
                energy_morning: r.get("energy_morning"),
                energy_afternoon: r.get("energy_afternoon"),
                energy_evening: r.get("energy_evening"),
                workout_done: r.get("workout_done"),
                workout_motivation: r.get("workout_motivation"),
            },
            None => DayLog::empty(date),
        })
    }

    pub async fn set_day_field(&self, date: &str, field: &str, value: i32) -> Result<(), Error> {
        let d = self.ensure_day(date).await?;
        let client = self.connect().await?;
        let sql = format!(
            "UPDATE day_log SET {field} = $1 WHERE date = $2",
            field = field
        );
        client
            .execute(&sql, &[&value, &d])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn set_workout_done(&self, date: &str, done: bool) -> Result<(), Error> {
        let d = self.ensure_day(date).await?;
        let client = self.connect().await?;
        client
            .execute(
                "UPDATE day_log SET workout_done = $1 WHERE date = $2",
                &[&done, &d],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn get_days_range(&self, start: &str, end: &str) -> Result<Vec<DayLog>, Error> {
        let client = self.connect().await?;
        let s = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let e = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
            .map_err(|e2| Error::Db(e2.to_string()))?;
        let rows = client
            .query(
                "SELECT * FROM day_log WHERE date BETWEEN $1 AND $2 ORDER BY date DESC",
                &[&s, &e],
            )
            .await
            .map_err(|e2| Error::Db(format!("{e2:?}")))?;

        Ok(rows
            .iter()
            .map(|r| {
                let d: chrono::NaiveDate = r.get("date");
                DayLog {
                    date: d.format("%Y-%m-%d").to_string(),
                    sleep: r.get("sleep"),
                    energy_morning: r.get("energy_morning"),
                    energy_afternoon: r.get("energy_afternoon"),
                    energy_evening: r.get("energy_evening"),
                    workout_done: r.get("workout_done"),
                    workout_motivation: r.get("workout_motivation"),
                }
            })
            .collect())
    }

    // ── Push subscriptions ──────────────────────────────────

    pub async fn add_push_subscription(&self, sub: &PushSubscription) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "INSERT INTO push_subscriptions (id, endpoint, p256dh, auth)
                 VALUES (gen_random_uuid()::text, $1, $2, $3)
                 ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth",
                &[&sub.endpoint, &sub.p256dh, &sub.auth],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn list_push_subscriptions(&self) -> Result<Vec<PushSubscription>, Error> {
        let client = self.connect().await?;
        let rows = client
            .query("SELECT endpoint, p256dh, auth FROM push_subscriptions", &[])
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(rows
            .iter()
            .map(|r| PushSubscription {
                endpoint: r.get("endpoint"),
                p256dh: r.get("p256dh"),
                auth: r.get("auth"),
            })
            .collect())
    }

    pub async fn delete_push_subscription(&self, endpoint: &str) -> Result<(), Error> {
        let client = self.connect().await?;
        client
            .execute(
                "DELETE FROM push_subscriptions WHERE endpoint = $1",
                &[&endpoint],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    // ── Supplement logs ────────────────────────────────────

    pub async fn get_supplement_logs(&self, date: &str) -> Result<Vec<SupplementLog>, Error> {
        let client = self.connect().await?;
        let d = chrono::NaiveDate::parse_from_str(date, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let rows = client
            .query(
                "SELECT type_id, brand_id, taken FROM supplement_logs WHERE date = $1",
                &[&d],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;

        Ok(rows
            .iter()
            .map(|r| SupplementLog {
                type_id: r.get("type_id"),
                brand_id: r.get("brand_id"),
                taken: r.get("taken"),
            })
            .collect())
    }

    pub async fn set_supplement_taken(
        &self,
        date: &str,
        type_id: &str,
        brand_id: &str,
        taken: bool,
    ) -> Result<(), Error> {
        let d = self.ensure_day(date).await?;
        let client = self.connect().await?;
        client
            .execute(
                "INSERT INTO supplement_logs (date, type_id, brand_id, taken)
                 VALUES ($1, $2, $3, $4)
                 ON CONFLICT (date, type_id) DO UPDATE SET brand_id = EXCLUDED.brand_id, taken = EXCLUDED.taken",
                &[&d, &type_id, &brand_id, &taken],
            )
            .await
            .map_err(|e| Error::Db(format!("{e:?}")))?;
        Ok(())
    }

    pub async fn count_supplements_taken(
        &self,
        start: &str,
        end: &str,
    ) -> Result<std::collections::HashMap<String, u32>, Error> {
        let client = self.connect().await?;
        let s = chrono::NaiveDate::parse_from_str(start, "%Y-%m-%d")
            .map_err(|e| Error::Db(e.to_string()))?;
        let e = chrono::NaiveDate::parse_from_str(end, "%Y-%m-%d")
            .map_err(|e2| Error::Db(e2.to_string()))?;
        let rows = client
            .query(
                "SELECT date, COUNT(*) as cnt FROM supplement_logs
                 WHERE date BETWEEN $1 AND $2 AND taken = true
                 GROUP BY date",
                &[&s, &e],
            )
            .await
            .map_err(|e2| Error::Db(format!("{e2:?}")))?;

        Ok(rows
            .iter()
            .map(|r| {
                let d: chrono::NaiveDate = r.get("date");
                let cnt: i64 = r.get("cnt");
                (d.format("%Y-%m-%d").to_string(), cnt as u32)
            })
            .collect())
    }
}

// ── Helpers ─────────────────────────────────────────────────

fn brand_from_row(r: &tokio_postgres::Row) -> SupplementBrand {
    SupplementBrand {
        id: r.get("id"),
        type_id: r.get("type_id"),
        brand_id: r.get("brand_id"),
        brand_name: r.get("brand_name"),
        product_name: r.get("product_name"),
        serving_dose: r.get("serving_dose"),
        serving_unit: r.get("serving_unit"),
        units_per_serving: r.get("units_per_serving"),
        unit_name: r.get("unit_name"),
        form: r.get("form"),
        instructions: r.get("instructions"),
        url: r.get("url"),
        price_per_serving: r.get("price_per_serving"),
        subscription_discount: r.get("subscription_discount"),
        in_stock: r.get("in_stock"),
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
