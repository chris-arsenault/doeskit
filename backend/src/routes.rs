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

#[cfg(test)]
mod tests {
    use super::*;

    // ── compute_servings ────────────────────────────────────

    #[test]
    fn test_compute_servings_pill_ceils_up() {
        // 2000mg target, 1040mg/softgel -> ceil(1.92) = 2
        assert_eq!(compute_servings(2000.0, 1040.0, "pill"), 2.0);
    }

    #[test]
    fn test_compute_servings_pill_exact() {
        assert_eq!(compute_servings(5.0, 5.0, "pill"), 1.0);
    }

    #[test]
    fn test_compute_servings_pill_ceils_small_remainder() {
        // 2000mg target, 813mg/gelcap -> ceil(2.46) = 3
        assert_eq!(compute_servings(2000.0, 813.0, "pill"), 3.0);
    }

    #[test]
    fn test_compute_servings_drops_ceils() {
        // 4000 IU target, 500 IU/drop -> 8 drops
        assert_eq!(compute_servings(4000.0, 500.0, "drops"), 8.0);
    }

    #[test]
    fn test_compute_servings_scoop_rounds_half() {
        // 37g target, 25g/scoop -> 1.48 -> round to 1.5
        assert_eq!(compute_servings(37.0, 25.0, "scoop"), 1.5);
    }

    #[test]
    fn test_compute_servings_scoop_exact() {
        assert_eq!(compute_servings(15.0, 15.0, "scoop"), 1.0);
    }

    #[test]
    fn test_compute_servings_scoop_rounds_to_nearest_half() {
        // 400mg target, 200mg/scoop -> 2.0 (exact)
        assert_eq!(compute_servings(400.0, 200.0, "scoop"), 2.0);
    }

    #[test]
    fn test_compute_servings_zero_serving_returns_one() {
        assert_eq!(compute_servings(100.0, 0.0, "pill"), 1.0);
    }

    // ── format_dose_label ───────────────────────────────────

    #[test]
    fn test_format_dose_label_single_capsule() {
        assert_eq!(format_dose_label(1.0, "1 capsule", "pill"), "1 capsule");
    }

    #[test]
    fn test_format_dose_label_multiple_capsules_pluralizes() {
        assert_eq!(format_dose_label(2.0, "1 capsule", "pill"), "2 capsules");
    }

    #[test]
    fn test_format_dose_label_scoop_fractional() {
        assert_eq!(format_dose_label(1.5, "1 scoop", "scoop"), "1.5 scoops");
    }

    #[test]
    fn test_format_dose_label_drops_no_pluralize() {
        // "drops" already plural, form = "drops" skips pluralization
        assert_eq!(format_dose_label(8.0, "1 drop", "drops"), "8 drop");
    }

    #[test]
    fn test_format_dose_label_complex_serving_size() {
        assert_eq!(
            format_dose_label(1.0, "1 scoop (7.7g)", "scoop"),
            "1 scoop (7.7g)"
        );
    }

    // ── check_training_day ──────────────────────────────────

    #[test]
    fn test_training_day_sunday() {
        let schedule = TrainingSchedule {
            days: vec!["tuesday".into(), "thursday".into(), "saturday".into(), "sunday".into()],
        };
        // 2026-03-22 is a Sunday
        assert!(check_training_day(&schedule, "2026-03-22"));
    }

    #[test]
    fn test_not_training_day_monday() {
        let schedule = TrainingSchedule {
            days: vec!["tuesday".into(), "thursday".into(), "saturday".into(), "sunday".into()],
        };
        // 2026-03-23 is a Monday
        assert!(!check_training_day(&schedule, "2026-03-23"));
    }

    #[test]
    fn test_training_day_case_insensitive() {
        let schedule = TrainingSchedule {
            days: vec!["Tuesday".into()],
        };
        // 2026-03-24 is a Tuesday
        assert!(check_training_day(&schedule, "2026-03-24"));
    }

    #[test]
    fn test_training_day_empty_schedule() {
        let schedule = TrainingSchedule { days: vec![] };
        assert!(!check_training_day(&schedule, "2026-03-22"));
    }

    #[test]
    fn test_training_day_invalid_date() {
        let schedule = TrainingSchedule {
            days: vec!["sunday".into()],
        };
        assert!(!check_training_day(&schedule, "not-a-date"));
    }

    // ── is_cycle_on ─────────────────────────────────────────

    fn ashwagandha_cycle() -> Cycle {
        Cycle {
            id: "ashwagandha-cycle".into(),
            name: "Ashwagandha 8/4".into(),
            weeks_on: 8,
            weeks_off: 4,
            start_date: "2026-01-26".into(),
        }
    }

    #[test]
    fn test_cycle_on_first_day() {
        assert!(is_cycle_on(&ashwagandha_cycle(), "2026-01-26"));
    }

    #[test]
    fn test_cycle_on_last_day_of_on_period() {
        // 8 weeks = 56 days. Last on day = start + 55 = 2026-03-22
        assert!(is_cycle_on(&ashwagandha_cycle(), "2026-03-22"));
    }

    #[test]
    fn test_cycle_off_first_day_of_off_period() {
        // First off day = start + 56 = 2026-03-23
        assert!(!is_cycle_on(&ashwagandha_cycle(), "2026-03-23"));
    }

    #[test]
    fn test_cycle_off_last_day_of_off_period() {
        // 4 weeks off = 28 days. Last off day = start + 83 = 2026-04-19
        assert!(!is_cycle_on(&ashwagandha_cycle(), "2026-04-19"));
    }

    #[test]
    fn test_cycle_on_wraps_to_second_period() {
        // Second on period starts at start + 84 = 2026-04-20
        assert!(is_cycle_on(&ashwagandha_cycle(), "2026-04-20"));
    }

    #[test]
    fn test_cycle_before_start_returns_false() {
        assert!(!is_cycle_on(&ashwagandha_cycle(), "2026-01-25"));
    }

    #[test]
    fn test_cycle_invalid_start_date_returns_true() {
        let cycle = Cycle {
            id: "bad".into(),
            name: "Bad".into(),
            weeks_on: 4,
            weeks_off: 2,
            start_date: "bad-date".into(),
        };
        assert!(is_cycle_on(&cycle, "2026-03-22"));
    }
}
