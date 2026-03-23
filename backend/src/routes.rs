use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

type AppResult<T> = Result<Json<T>, StatusCode>;

fn db_err(e: crate::db::Error) -> StatusCode {
    tracing::error!("DB error: {e}");
    StatusCode::INTERNAL_SERVER_ERROR
}

pub fn api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/today", get(get_today))
        .route("/log", post(post_log))
        .route("/types", get(list_types))
        .route("/brands", get(list_brands))
        .route("/brands/{type_id}/active/{brand_id}", put(set_active_brand))
        .route("/cycles", get(list_cycles))
        .route("/cycles", post(create_cycle))
        .route("/cycles/{id}", delete(delete_cycle))
        .route("/schedule", get(get_schedule))
        .route("/schedule", post(set_schedule))
        .route("/history", get(get_history))
        .route("/health", get(health))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

// ── Today ───────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct TodayQuery {
    date: Option<String>,
}

async fn get_today(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TodayQuery>,
) -> AppResult<TodayResponse> {
    let today = query
        .date
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    let types = state.db.list_types().await.map_err(db_err)?;
    let brands = state.db.list_brands().await.map_err(db_err)?;
    let selections = state.db.get_active_selections().await.map_err(db_err)?;
    let cycles = state.db.list_cycles().await.map_err(db_err)?;
    let logs = state.db.get_logs_for_date(&today).await.map_err(db_err)?;
    let schedule: TrainingSchedule = state
        .db
        .get_config("training_schedule")
        .await
        .map_err(db_err)?
        .unwrap_or(TrainingSchedule { days: vec![] });

    let is_training_day = check_training_day(&schedule, &today);

    // Build daily doses from active brands
    let doses: Vec<DoseStatus> = types
        .iter()
        .filter(|t| {
            // Filter by cycle
            if let Some(ref cid) = t.cycle_id {
                let cycle = cycles.iter().find(|c| c.id == *cid);
                if let Some(c) = cycle {
                    if !is_cycle_on(c, &today) {
                        return false;
                    }
                }
            }
            true
        })
        .filter_map(|t| {
            let brand_id = selections.get(&t.id)?;
            let brand = brands.iter().find(|b| b.id == *brand_id)?;
            let servings_needed = compute_servings(t.target_dose, brand.serving_dose, &brand.form);
            let dose_label = format_dose_label(servings_needed, &brand.serving_size, &brand.form);
            Some(DoseStatus {
                dose: DailyDose {
                    supplement_type: t.clone(),
                    brand: brand.clone(),
                    servings_needed,
                    dose_label,
                },
                taken: logs.iter().any(|l| {
                    l.r#type == "supplement" && l.id == t.id && l.value == serde_json::json!(true)
                }),
            })
        })
        .collect();

    let sleep = logs
        .iter()
        .find(|l| l.r#type == "sleep")
        .and_then(|l| l.value.as_i64())
        .map(|v| v as i32);

    let energy_val = |period: &str| -> Option<i32> {
        logs.iter()
            .find(|l| l.r#type == "energy" && l.id == period)
            .and_then(|l| l.value.as_i64())
            .map(|v| v as i32)
    };

    let workout_done = logs
        .iter()
        .find(|l| l.r#type == "workout" && l.id == "done")
        .and_then(|l| l.value.as_bool());

    let workout_motivation = logs
        .iter()
        .find(|l| l.r#type == "workout" && l.id == "motivation")
        .and_then(|l| l.value.as_i64())
        .map(|v| v as i32);

    Ok(Json(TodayResponse {
        date: today,
        is_training_day,
        doses,
        sleep,
        energy: EnergyStatus {
            morning: energy_val("morning"),
            afternoon: energy_val("afternoon"),
            evening: energy_val("evening"),
        },
        workout: WorkoutStatus {
            done: workout_done,
            motivation: workout_motivation,
        },
    }))
}

// ── Logging ─────────────────────────────────────────────────

async fn post_log(
    State(state): State<Arc<AppState>>,
    Query(query): Query<TodayQuery>,
    Json(req): Json<LogRequest>,
) -> StatusCode {
    let today = query
        .date
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string());
    match state
        .db
        .put_log(&today, &req.r#type, &req.id, &req.value)
        .await
    {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

// ── Types & Brands ──────────────────────────────────────────

async fn list_types(State(state): State<Arc<AppState>>) -> AppResult<Vec<SupplementType>> {
    state.db.list_types().await.map(Json).map_err(db_err)
}

async fn list_brands(State(state): State<Arc<AppState>>) -> AppResult<Vec<SupplementBrand>> {
    state.db.list_brands().await.map(Json).map_err(db_err)
}

async fn set_active_brand(
    State(state): State<Arc<AppState>>,
    Path((type_id, brand_id)): Path<(String, String)>,
) -> StatusCode {
    match state.db.set_active_brand(&type_id, &brand_id).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

// ── Cycles ──────────────────────────────────────────────────

async fn list_cycles(State(state): State<Arc<AppState>>) -> AppResult<Vec<Cycle>> {
    state.db.list_cycles().await.map(Json).map_err(db_err)
}

async fn create_cycle(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateCycle>,
) -> Result<Json<Cycle>, StatusCode> {
    let cycle = Cycle {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        weeks_on: req.weeks_on,
        weeks_off: req.weeks_off,
        start_date: req.start_date,
    };
    state.db.put_cycle(&cycle).await.map_err(db_err)?;
    Ok(Json(cycle))
}

async fn delete_cycle(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> StatusCode {
    match state.db.delete_cycle(&id).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

// ── Training schedule ───────────────────────────────────────

async fn get_schedule(State(state): State<Arc<AppState>>) -> AppResult<TrainingSchedule> {
    let schedule = state
        .db
        .get_config::<TrainingSchedule>("training_schedule")
        .await
        .map_err(db_err)?
        .unwrap_or(TrainingSchedule { days: vec![] });
    Ok(Json(schedule))
}

async fn set_schedule(
    State(state): State<Arc<AppState>>,
    Json(schedule): Json<TrainingSchedule>,
) -> StatusCode {
    match state.db.put_config("training_schedule", &schedule).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

// ── History ─────────────────────────────────────────────────

async fn get_history(
    State(state): State<Arc<AppState>>,
    Query(query): Query<HistoryQuery>,
) -> AppResult<Vec<DaySummary>> {
    let days = query.days.unwrap_or(14);
    let end = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let start = (chrono::Utc::now() - chrono::Duration::days(days as i64))
        .format("%Y-%m-%d")
        .to_string();

    let types = state.db.list_types().await.map_err(db_err)?;
    let logs = state
        .db
        .get_logs_for_range(&start, &end)
        .await
        .map_err(db_err)?;

    let mut summaries: std::collections::BTreeMap<String, DaySummary> =
        std::collections::BTreeMap::new();

    for log in &logs {
        let date = log.timestamp.get(..10).unwrap_or("").to_string();
        if date.is_empty() {
            continue;
        }
        let entry = summaries.entry(date.clone()).or_insert_with(|| DaySummary {
            date: date.clone(),
            sleep: None,
            energy_avg: None,
            workout: None,
            supplements_taken: 0,
            supplements_total: types.len() as u32,
        });

        match log.r#type.as_str() {
            "sleep" => entry.sleep = log.value.as_i64().map(|v| v as i32),
            "energy" => {}
            "workout" if log.id == "done" => entry.workout = log.value.as_bool(),
            "supplement" if log.value == serde_json::json!(true) => entry.supplements_taken += 1,
            _ => {}
        }
    }

    for (date, summary) in summaries.iter_mut() {
        let energy_logs: Vec<i64> = logs
            .iter()
            .filter(|l| l.r#type == "energy" && l.timestamp.starts_with(date.as_str()))
            .filter_map(|l| l.value.as_i64())
            .collect();
        if !energy_logs.is_empty() {
            summary.energy_avg =
                Some(energy_logs.iter().sum::<i64>() as f64 / energy_logs.len() as f64);
        }
    }

    Ok(Json(summaries.into_values().rev().collect()))
}

// ── Dose computation ────────────────────────────────────────

fn compute_servings(target: f64, per_serving: f64, form: &str) -> f64 {
    if per_serving <= 0.0 {
        return 1.0;
    }
    let raw = target / per_serving;
    match form {
        "scoop" => (raw * 2.0).round() / 2.0, // round to nearest 0.5
        _ => raw.ceil(),                      // pill, drops, etc: ceil
    }
}

fn format_dose_label(servings: f64, serving_size: &str, form: &str) -> String {
    let count = if servings == servings.floor() {
        format!("{}", servings as i64)
    } else {
        format!("{servings:.1}")
    };

    // Extract unit from serving_size (e.g., "1 capsule" -> "capsules", "1 scoop" -> "scoops")
    let unit = serving_size
        .split_whitespace()
        .skip(1)
        .collect::<Vec<_>>()
        .join(" ");

    let unit_plural = if servings > 1.0 && !unit.ends_with('s') && form != "drops" {
        format!("{unit}s")
    } else {
        unit
    };

    format!("{count} {unit_plural}")
}

// ── Training schedule logic ─────────────────────────────────

fn check_training_day(schedule: &TrainingSchedule, date_str: &str) -> bool {
    let date = match chrono::NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return false,
    };
    let weekday = date.format("%A").to_string().to_lowercase();
    schedule.days.iter().any(|d| d.to_lowercase() == weekday)
}

// ── Cycle logic ─────────────────────────────────────────────

fn is_cycle_on(cycle: &Cycle, today: &str) -> bool {
    let start = match chrono::NaiveDate::parse_from_str(&cycle.start_date, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return true,
    };
    let current = match chrono::NaiveDate::parse_from_str(today, "%Y-%m-%d") {
        Ok(d) => d,
        Err(_) => return true,
    };
    if current < start {
        return false;
    }
    let total_days = (cycle.weeks_on + cycle.weeks_off) * 7;
    let day_in_cycle = (current - start).num_days() as u32 % total_days;
    day_in_cycle < cycle.weeks_on * 7
}
