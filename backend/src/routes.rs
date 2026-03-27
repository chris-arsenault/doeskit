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
        .route("/log/sleep", post(log_sleep))
        .route("/log/energy", post(log_energy))
        .route("/log/workout", post(log_workout))
        .route("/log/supplement", post(log_supplement))
        .route("/types", get(list_types))
        .route("/types/{id}", put(update_type))
        .route("/brands", get(list_brands))
        .route("/selections", get(get_selections))
        .route("/brands/{type_id}/active/{brand_id}", put(set_active_brand))
        .route("/cycles", get(list_cycles))
        .route("/cycles", post(create_cycle))
        .route("/cycles/{id}", delete(delete_cycle))
        .route("/schedule", get(get_schedule))
        .route("/schedule", post(set_schedule))
        .route("/history", get(get_history))
        .route("/compare", get(get_compare))
        .route("/brands/{id}/pricing", put(update_brand_pricing))
        .route("/health", get(health))
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

// ── Today ───────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct DateQuery {
    date: Option<String>,
}

fn resolve_date(query: &DateQuery) -> String {
    query
        .date
        .clone()
        .unwrap_or_else(|| chrono::Utc::now().format("%Y-%m-%d").to_string())
}

async fn get_today(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
) -> AppResult<TodayResponse> {
    let date = resolve_date(&query);
    let types = state.db.list_types().await.map_err(db_err)?;
    let brands = state.db.list_brands().await.map_err(db_err)?;
    let selections = state.db.get_active_selections().await.map_err(db_err)?;
    let cycles = state.db.list_cycles().await.map_err(db_err)?;
    let day = state.db.get_day(&date).await.map_err(db_err)?;
    let supp_logs = state.db.get_supplement_logs(&date).await.map_err(db_err)?;
    let schedule: TrainingSchedule = state
        .db
        .get_config("training_schedule")
        .await
        .map_err(db_err)?
        .unwrap_or(TrainingSchedule { days: vec![] });

    let is_training_day = check_training_day(&schedule, &date);

    let doses: Vec<DoseStatus> = types
        .iter()
        .filter(|t| {
            if !t.active {
                return false;
            }
            if let Some(ref cid) = t.cycle_id {
                if let Some(c) = cycles.iter().find(|c| c.id == *cid) {
                    if !is_cycle_on(c, &date) {
                        return false;
                    }
                }
            }
            true
        })
        .filter_map(|t| {
            // Use logged brand only if taken=true (preserves historical accuracy).
            // Otherwise use active selection (reflects current brand choice).
            let supp_log = supp_logs.iter().find(|l| l.type_id == t.id);
            let brand = if supp_log.is_some_and(|l| l.taken) {
                brands.iter().find(|b| b.id == supp_log.unwrap().brand_id)
            } else {
                let brand_id = selections.get(&t.id)?;
                brands.iter().find(|b| b.id == *brand_id)
            }?;
            let servings = compute_servings(t.target_dose, brand.serving_dose, &brand.form);
            let label = format_dose_label(servings, brand.units_per_serving, &brand.unit_name);
            Some(DoseStatus {
                dose: DailyDose {
                    supplement_type: t.clone(),
                    brand: brand.clone(),
                    servings_needed: servings,
                    dose_label: label,
                },
                taken: supp_log.is_some_and(|l| l.taken),
            })
        })
        .collect();

    Ok(Json(TodayResponse {
        date,
        is_training_day,
        doses,
        sleep: day.sleep,
        energy: EnergyStatus {
            morning: day.energy_morning,
            afternoon: day.energy_afternoon,
            evening: day.energy_evening,
        },
        workout: WorkoutStatus {
            done: day.workout_done,
            motivation: day.workout_motivation,
        },
    }))
}

// ── Typed log endpoints ─────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct ScoreBody {
    value: i32,
}

#[derive(Debug, serde::Deserialize)]
struct EnergyBody {
    period: String,
    value: i32,
}

#[derive(Debug, serde::Deserialize)]
struct WorkoutBody {
    done: Option<bool>,
    motivation: Option<i32>,
}

#[derive(Debug, serde::Deserialize)]
struct SupplementBody {
    type_id: String,
    brand_id: String,
    taken: bool,
}

async fn log_sleep(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<ScoreBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    match state.db.set_day_field(&date, "sleep", body.value).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn log_energy(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<EnergyBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    let field = match body.period.as_str() {
        "morning" => "energy_morning",
        "afternoon" => "energy_afternoon",
        "evening" => "energy_evening",
        _ => return StatusCode::BAD_REQUEST,
    };
    match state.db.set_day_field(&date, field, body.value).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn log_workout(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<WorkoutBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    if let Some(done) = body.done {
        if let Err(e) = state.db.set_workout_done(&date, done).await {
            tracing::error!("DB error: {e}");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }
    if let Some(motivation) = body.motivation {
        if let Err(e) = state
            .db
            .set_day_field(&date, "workout_motivation", motivation)
            .await
        {
            tracing::error!("DB error: {e}");
            return StatusCode::INTERNAL_SERVER_ERROR;
        }
    }
    StatusCode::OK
}

async fn log_supplement(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<SupplementBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    match state
        .db
        .set_supplement_taken(&date, &body.type_id, &body.brand_id, body.taken)
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

#[derive(Debug, serde::Deserialize)]
struct UpdateTypeBody {
    timing: String,
    training_day_only: bool,
    active: bool,
}

async fn update_type(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateTypeBody>,
) -> StatusCode {
    match state
        .db
        .update_type(&id, &body.timing, body.training_day_only, body.active)
        .await
    {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn list_brands(State(state): State<Arc<AppState>>) -> AppResult<Vec<SupplementBrand>> {
    state.db.list_brands().await.map(Json).map_err(db_err)
}

#[derive(Debug, serde::Deserialize)]
pub struct UpdateBrandBody {
    pub product_name: Option<String>,
    pub serving_dose: Option<f64>,
    pub serving_unit: Option<String>,
    pub units_per_serving: Option<f64>,
    pub unit_name: Option<String>,
    pub form: Option<String>,
    pub instructions: Option<String>,
    pub url: Option<String>,
    pub price_per_serving: Option<f64>,
    pub subscription_discount: Option<f64>,
}

async fn update_brand_pricing(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(body): Json<UpdateBrandBody>,
) -> StatusCode {
    match state.db.update_brand(&id, &body).await {
        Ok(_) => StatusCode::OK,
        Err(e) => {
            tracing::error!("DB error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
}

async fn get_selections(
    State(state): State<Arc<AppState>>,
) -> AppResult<std::collections::HashMap<String, String>> {
    state
        .db
        .get_active_selections()
        .await
        .map(Json)
        .map_err(db_err)
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
    let days_count = query.days.unwrap_or(14);
    let end = chrono::Utc::now().format("%Y-%m-%d").to_string();
    let start = (chrono::Utc::now() - chrono::Duration::days(days_count as i64))
        .format("%Y-%m-%d")
        .to_string();

    let types = state.db.list_types().await.map_err(db_err)?;
    let day_logs = state
        .db
        .get_days_range(&start, &end)
        .await
        .map_err(db_err)?;
    let supp_counts = state
        .db
        .count_supplements_taken(&start, &end)
        .await
        .map_err(db_err)?;

    let total = types.len() as u32;
    let summaries: Vec<DaySummary> = day_logs
        .into_iter()
        .map(|d| {
            let energy_vals: Vec<f64> = [d.energy_morning, d.energy_afternoon, d.energy_evening]
                .iter()
                .filter_map(|v| v.map(|x| x as f64))
                .collect();
            let energy_avg = if energy_vals.is_empty() {
                None
            } else {
                Some(energy_vals.iter().sum::<f64>() / energy_vals.len() as f64)
            };
            let taken = supp_counts.get(&d.date).copied().unwrap_or(0);
            DaySummary {
                date: d.date,
                sleep: d.sleep,
                energy_avg,
                workout: d.workout_done,
                supplements_taken: taken,
                supplements_total: total,
            }
        })
        .collect();

    Ok(Json(summaries))
}

// ── Compare ─────────────────────────────────────────────────

async fn get_compare(State(state): State<Arc<AppState>>) -> AppResult<CompareResponse> {
    let types = state.db.list_types().await.map_err(db_err)?;
    let brands = state.db.list_all_brands_table().await.map_err(db_err)?;
    let products = state.db.list_brands().await.map_err(db_err)?;
    let research = state.db.list_research().await.map_err(db_err)?;
    Ok(Json(CompareResponse {
        types,
        brands,
        products,
        research,
    }))
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

fn format_dose_label(servings: f64, units_per_serving: f64, unit_name: &str) -> String {
    let total = servings * units_per_serving;
    let count = if total == total.floor() {
        format!("{}", total as i64)
    } else {
        format!("{total:.1}")
    };
    let unit = if total > 1.0 && !unit_name.ends_with('s') {
        format!("{unit_name}s")
    } else {
        unit_name.to_string()
    };
    format!("{count} {unit}")
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
        assert_eq!(compute_servings(2000.0, 1040.0, "pill"), 2.0);
    }

    #[test]
    fn test_compute_servings_pill_exact() {
        assert_eq!(compute_servings(5.0, 5.0, "pill"), 1.0);
    }

    #[test]
    fn test_compute_servings_pill_ceils_small_remainder() {
        assert_eq!(compute_servings(2000.0, 813.0, "pill"), 3.0);
    }

    #[test]
    fn test_compute_servings_drops_ceils() {
        assert_eq!(compute_servings(4000.0, 500.0, "drops"), 8.0);
    }

    #[test]
    fn test_compute_servings_scoop_rounds_half() {
        assert_eq!(compute_servings(37.0, 25.0, "scoop"), 1.5);
    }

    #[test]
    fn test_compute_servings_scoop_exact() {
        assert_eq!(compute_servings(15.0, 15.0, "scoop"), 1.0);
    }

    #[test]
    fn test_compute_servings_scoop_rounds_to_nearest_half() {
        assert_eq!(compute_servings(400.0, 200.0, "scoop"), 2.0);
    }

    #[test]
    fn test_compute_servings_zero_serving_returns_one() {
        assert_eq!(compute_servings(100.0, 0.0, "pill"), 1.0);
    }

    // ── format_dose_label(servings, units_per_serving, unit_name) ──

    #[test]
    fn test_format_dose_label_single_capsule() {
        // 1 serving × 1 capsule/serving = 1 capsule
        assert_eq!(format_dose_label(1.0, 1.0, "capsule"), "1 capsule");
    }

    #[test]
    fn test_format_dose_label_multiple_capsules() {
        // 2 servings × 1 capsule/serving = 2 capsules
        assert_eq!(format_dose_label(2.0, 1.0, "capsule"), "2 capsules");
    }

    #[test]
    fn test_format_dose_label_scoop_fractional() {
        // 1.5 servings × 1 scoop/serving = 1.5 scoops
        assert_eq!(format_dose_label(1.5, 1.0, "scoop"), "1.5 scoops");
    }

    #[test]
    fn test_format_dose_label_multi_unit_serving() {
        // 1.5 servings × 2 scoops/serving = 3 scoops (plant protein)
        assert_eq!(format_dose_label(1.5, 2.0, "scoop"), "3 scoops");
    }

    #[test]
    fn test_format_dose_label_drops() {
        // 8 servings × 1 drop/serving = 8 drops
        assert_eq!(format_dose_label(8.0, 1.0, "drop"), "8 drops");
    }

    #[test]
    fn test_format_dose_label_half_scoop_multi() {
        // 3.5 servings × 1 scoop/serving = 3.5 scoops
        assert_eq!(format_dose_label(3.5, 1.0, "scoop"), "3.5 scoops");
    }

    // ── check_training_day ──────────────────────────────────

    #[test]
    fn test_training_day_sunday() {
        let schedule = TrainingSchedule {
            days: vec![
                "tuesday".into(),
                "thursday".into(),
                "saturday".into(),
                "sunday".into(),
            ],
        };
        assert!(check_training_day(&schedule, "2026-03-22"));
    }

    #[test]
    fn test_not_training_day_monday() {
        let schedule = TrainingSchedule {
            days: vec![
                "tuesday".into(),
                "thursday".into(),
                "saturday".into(),
                "sunday".into(),
            ],
        };
        assert!(!check_training_day(&schedule, "2026-03-23"));
    }

    #[test]
    fn test_training_day_case_insensitive() {
        let schedule = TrainingSchedule {
            days: vec!["Tuesday".into()],
        };
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
        assert!(is_cycle_on(&ashwagandha_cycle(), "2026-03-22"));
    }

    #[test]
    fn test_cycle_off_first_day_of_off_period() {
        assert!(!is_cycle_on(&ashwagandha_cycle(), "2026-03-23"));
    }

    #[test]
    fn test_cycle_off_last_day_of_off_period() {
        assert!(!is_cycle_on(&ashwagandha_cycle(), "2026-04-19"));
    }

    #[test]
    fn test_cycle_on_wraps_to_second_period() {
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
