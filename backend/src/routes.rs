use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post},
    Json, Router,
};
use std::sync::Arc;

use crate::models::*;
use crate::AppState;

type AppResult<T> = Result<Json<T>, StatusCode>;

pub fn api_routes() -> Router<Arc<AppState>> {
    Router::new()
        .route("/today", get(get_today))
        .route("/log", post(post_log))
        .route("/supplements", get(list_supplements))
        .route("/supplements", post(create_supplement))
        .route("/supplements/{id}", delete(delete_supplement))
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

async fn get_today(State(state): State<Arc<AppState>>) -> AppResult<TodayResponse> {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let supplements = state.db.list_supplements().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let cycles = state.db.list_cycles().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let logs = state.db.get_logs_for_date(&today).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let schedule: TrainingSchedule = state
        .db
        .get_config("training_schedule")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or(TrainingSchedule { days: vec![] });

    let is_training_day = check_training_day(&schedule, &today);
    let active_supplements = filter_active_supplements(&supplements, &cycles, &today);

    let supplement_statuses: Vec<SupplementStatus> = active_supplements
        .into_iter()
        .map(|s| {
            let taken = logs
                .iter()
                .any(|l| l.r#type == "supplement" && l.id == s.id && l.value == serde_json::json!(true));
            SupplementStatus { supplement: s, taken }
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
        supplements: supplement_statuses,
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

async fn post_log(State(state): State<Arc<AppState>>, Json(req): Json<LogRequest>) -> StatusCode {
    let today = chrono::Utc::now().format("%Y-%m-%d").to_string();
    match state.db.put_log(&today, &req.r#type, &req.id, &req.value).await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

// ── Supplements ─────────────────────────────────────────────

async fn list_supplements(State(state): State<Arc<AppState>>) -> AppResult<Vec<Supplement>> {
    state
        .db
        .list_supplements()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
}

async fn create_supplement(
    State(state): State<Arc<AppState>>,
    Json(req): Json<CreateSupplement>,
) -> Result<Json<Supplement>, StatusCode> {
    let supp = Supplement {
        id: uuid::Uuid::new_v4().to_string(),
        name: req.name,
        dose: req.dose,
        unit: req.unit,
        active: true,
        cycle_id: req.cycle_id,
        timing: req.timing,
        training_day_only: req.training_day_only,
        notes: req.notes,
    };
    state
        .db
        .put_supplement(&supp)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(supp))
}

async fn delete_supplement(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> StatusCode {
    match state.db.delete_supplement(&id).await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

// ── Cycles ──────────────────────────────────────────────────

async fn list_cycles(State(state): State<Arc<AppState>>) -> AppResult<Vec<Cycle>> {
    state
        .db
        .list_cycles()
        .await
        .map(Json)
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)
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
    state
        .db
        .put_cycle(&cycle)
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    Ok(Json(cycle))
}

async fn delete_cycle(State(state): State<Arc<AppState>>, Path(id): Path<String>) -> StatusCode {
    match state.db.delete_cycle(&id).await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
    }
}

// ── Training schedule ───────────────────────────────────────

async fn get_schedule(State(state): State<Arc<AppState>>) -> AppResult<TrainingSchedule> {
    let schedule = state
        .db
        .get_config::<TrainingSchedule>("training_schedule")
        .await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .unwrap_or(TrainingSchedule { days: vec![] });
    Ok(Json(schedule))
}

async fn set_schedule(
    State(state): State<Arc<AppState>>,
    Json(schedule): Json<TrainingSchedule>,
) -> StatusCode {
    match state.db.put_config("training_schedule", &schedule).await {
        Ok(_) => StatusCode::OK,
        Err(_) => StatusCode::INTERNAL_SERVER_ERROR,
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

    let supplements = state.db.list_supplements().await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let logs = state.db.get_logs_for_range(&start, &end).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;

    let mut summaries: std::collections::BTreeMap<String, DaySummary> = std::collections::BTreeMap::new();

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
            supplements_total: supplements.len() as u32,
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
            summary.energy_avg = Some(energy_logs.iter().sum::<i64>() as f64 / energy_logs.len() as f64);
        }
    }

    Ok(Json(summaries.into_values().rev().collect()))
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

fn filter_active_supplements(supplements: &[Supplement], cycles: &[Cycle], today: &str) -> Vec<Supplement> {
    supplements
        .iter()
        .filter(|s| {
            if !s.active {
                return false;
            }
            match &s.cycle_id {
                None => true,
                Some(cid) => {
                    let cycle = cycles.iter().find(|c| c.id == *cid);
                    match cycle {
                        None => true,
                        Some(c) => is_cycle_on(c, today),
                    }
                }
            }
        })
        .cloned()
        .collect()
}

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
