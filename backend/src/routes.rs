use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    routing::{delete, get, post, put},
    Json, Router,
};
use std::{collections::HashMap, sync::Arc};

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
        .route(
            "/notifications/settings",
            get(get_notification_settings).put(update_notification_settings),
        )
}

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok" }))
}

// ── Today ───────────────────────────────────────────────────

#[derive(Debug, serde::Deserialize)]
struct DateQuery {
    date: Option<String>,
}

struct TodayContext {
    types: Vec<SupplementType>,
    brands: Vec<SupplementBrand>,
    selections: HashMap<String, String>,
    cycles: Vec<Cycle>,
    day: DayLog,
    supp_logs: Vec<SupplementLog>,
    schedule: TrainingSchedule,
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
    let context = load_today_context(state.as_ref(), &date)
        .await
        .map_err(db_err)?;
    let is_training_day = check_training_day(&context.schedule, &date);
    let active_types = active_types_for_date(&context.types, &context.cycles, &date);
    let doses = build_dose_statuses(
        &active_types,
        &context.brands,
        &context.selections,
        &context.supp_logs,
    );

    log_today_summary(&date, active_types.len(), doses.len());

    Ok(Json(today_response(
        date,
        is_training_day,
        doses,
        context.day,
    )))
}

async fn load_today_context(
    state: &AppState,
    date: &str,
) -> Result<TodayContext, crate::db::Error> {
    let types = state.db.list_types().await?;
    let brands = state.db.list_brands().await?;
    let selections = state.db.get_active_selections().await?;
    let cycles = state.db.list_cycles().await?;
    let day = state.db.get_day(date).await?;
    let supp_logs = state.db.get_supplement_logs(date).await?;
    let schedule = state
        .db
        .get_config("training_schedule")
        .await?
        .unwrap_or(TrainingSchedule { days: vec![] });

    Ok(TodayContext {
        types,
        brands,
        selections,
        cycles,
        day,
        supp_logs,
        schedule,
    })
}

fn log_today_summary(date: &str, active_count: usize, dose_count: usize) {
    tracing::info!(
        date,
        active_types = active_count,
        resolved_doses = dose_count,
        excluded = active_count - dose_count,
        "today checklist built"
    );
}

fn today_response(
    date: String,
    is_training_day: bool,
    doses: Vec<DoseStatus>,
    day: DayLog,
) -> TodayResponse {
    TodayResponse {
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
    }
}

fn active_types_for_date<'a>(
    types: &'a [SupplementType],
    cycles: &[Cycle],
    date: &str,
) -> Vec<&'a SupplementType> {
    types
        .iter()
        .filter(|supplement_type| is_active_type_on_date(supplement_type, cycles, date))
        .collect()
}

fn is_active_type_on_date(supplement_type: &SupplementType, cycles: &[Cycle], date: &str) -> bool {
    supplement_type.active && cycle_is_available(supplement_type, cycles, date)
}

fn cycle_is_available(supplement_type: &SupplementType, cycles: &[Cycle], date: &str) -> bool {
    supplement_type
        .cycle_id
        .as_ref()
        .and_then(|cycle_id| {
            cycles
                .iter()
                .find(|cycle| cycle.id.as_str() == cycle_id.as_str())
        })
        .is_none_or(|cycle| is_cycle_on(cycle, date))
}

fn build_dose_statuses(
    active_types: &[&SupplementType],
    brands: &[SupplementBrand],
    selections: &HashMap<String, String>,
    supp_logs: &[SupplementLog],
) -> Vec<DoseStatus> {
    active_types
        .iter()
        .filter_map(|&supplement_type| {
            build_dose_status(supplement_type, brands, selections, supp_logs)
        })
        .collect()
}

fn build_dose_status(
    supplement_type: &SupplementType,
    brands: &[SupplementBrand],
    selections: &HashMap<String, String>,
    supp_logs: &[SupplementLog],
) -> Option<DoseStatus> {
    let supp_log = supp_logs
        .iter()
        .find(|log| log.type_id.as_str() == supplement_type.id.as_str());
    let Some(brand) = resolve_brand(&supplement_type.id, brands, selections, supp_log) else {
        tracing::warn!(
            type_id = supplement_type.id.as_str(),
            "excluded from today: no brand resolved"
        );
        return None;
    };

    let servings = compute_servings(supplement_type.target_dose, brand.serving_dose, &brand.form);
    let label = format_dose_label(servings, brand.units_per_serving, &brand.unit_name);

    Some(DoseStatus {
        dose: DailyDose {
            supplement_type: supplement_type.clone(),
            brand: brand.clone(),
            servings_needed: servings,
            dose_label: label,
        },
        taken: supp_log.is_some_and(|log| log.taken),
    })
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

fn mutation_status(result: Result<(), crate::db::Error>) -> StatusCode {
    result.map_or_else(db_err, |_| StatusCode::OK)
}

fn energy_field(period: &str) -> Option<&'static str> {
    match period {
        "morning" => Some("energy_morning"),
        "afternoon" => Some("energy_afternoon"),
        "evening" => Some("energy_evening"),
        _ => None,
    }
}

async fn log_sleep(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<ScoreBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    mutation_status(state.db.set_day_field(&date, "sleep", body.value).await)
}

async fn log_energy(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<EnergyBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    let Some(field) = energy_field(&body.period) else {
        return StatusCode::BAD_REQUEST;
    };
    mutation_status(state.db.set_day_field(&date, field, body.value).await)
}

async fn log_workout(
    State(state): State<Arc<AppState>>,
    Query(query): Query<DateQuery>,
    Json(body): Json<WorkoutBody>,
) -> StatusCode {
    let date = resolve_date(&query);
    mutation_status(apply_workout_log(state.as_ref(), &date, &body).await)
}

async fn apply_workout_log(
    state: &AppState,
    date: &str,
    body: &WorkoutBody,
) -> Result<(), crate::db::Error> {
    if let Some(done) = body.done {
        state.db.set_workout_done(date, done).await?;
    }
    if let Some(motivation) = body.motivation {
        state
            .db
            .set_day_field(date, "workout_motivation", motivation)
            .await?;
    }
    Ok(())
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

async fn get_selections(State(state): State<Arc<AppState>>) -> AppResult<HashMap<String, String>> {
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

// ── Brand resolution ────────────────────────────────────────

enum AutoBrand<'a> {
    Single(&'a SupplementBrand),
    None,
    Multiple(usize),
}

/// Resolves which brand product to show for a supplement type on the today list.
///
/// Priority: (1) logged brand if taken today, (2) active selection, (3) auto-select
/// if exactly one brand exists for the type. Returns None if no brand can be
/// determined, which causes the supplement to be excluded from the today list.
fn resolve_brand<'a>(
    type_id: &str,
    brands: &'a [SupplementBrand],
    selections: &HashMap<String, String>,
    supp_log: Option<&SupplementLog>,
) -> Option<&'a SupplementBrand> {
    if let Some(brand) = logged_brand(type_id, brands, supp_log) {
        return brand;
    }

    if let Some(brand) = selected_brand(type_id, brands, selections) {
        return brand;
    }

    auto_selected_brand(type_id, brands)
}

fn logged_brand<'a>(
    type_id: &str,
    brands: &'a [SupplementBrand],
    supp_log: Option<&SupplementLog>,
) -> Option<Option<&'a SupplementBrand>> {
    let log = supp_log.filter(|log| log.taken)?;
    let brand = brand_by_id(brands, &log.brand_id);
    warn_missing_logged_brand(type_id, &log.brand_id, brand);
    Some(brand)
}

fn selected_brand<'a>(
    type_id: &str,
    brands: &'a [SupplementBrand],
    selections: &HashMap<String, String>,
) -> Option<Option<&'a SupplementBrand>> {
    selections.get(type_id).map(|selected_id| {
        let brand = brand_by_id(brands, selected_id);
        warn_missing_active_selection(type_id, selected_id, brand);
        brand
    })
}

fn brand_by_id<'a>(brands: &'a [SupplementBrand], brand_id: &str) -> Option<&'a SupplementBrand> {
    brands.iter().find(|brand| brand.id.as_str() == brand_id)
}

fn warn_missing_logged_brand(type_id: &str, brand_id: &str, brand: Option<&SupplementBrand>) {
    if brand.is_none() {
        tracing::warn!(
            type_id,
            brand_id,
            "logged brand not found in brands list (JOIN may have excluded it)"
        );
    }
}

fn warn_missing_active_selection(type_id: &str, brand_id: &str, brand: Option<&SupplementBrand>) {
    if brand.is_none() {
        tracing::warn!(
            type_id,
            brand_id,
            "active selection brand not found in brands list (JOIN may have excluded it)"
        );
    }
}

fn auto_selected_brand<'a>(
    type_id: &str,
    brands: &'a [SupplementBrand],
) -> Option<&'a SupplementBrand> {
    match classify_auto_brand(type_id, brands) {
        AutoBrand::Single(brand) => {
            log_auto_selected_brand(type_id, brand);
            Some(brand)
        }
        AutoBrand::None => {
            warn_no_brands_for_type(type_id);
            None
        }
        AutoBrand::Multiple(count) => {
            warn_multiple_brands_for_type(type_id, count);
            None
        }
    }
}

fn classify_auto_brand<'a>(type_id: &str, brands: &'a [SupplementBrand]) -> AutoBrand<'a> {
    let mut type_brands = brands
        .iter()
        .filter(|brand| brand.type_id.as_str() == type_id);
    let first = type_brands.next();

    match (first, type_brands.next()) {
        (Some(brand), None) => AutoBrand::Single(brand),
        (None, _) => AutoBrand::None,
        (Some(_), Some(_)) => AutoBrand::Multiple(2 + type_brands.count()),
    }
}

fn log_auto_selected_brand(type_id: &str, brand: &SupplementBrand) {
    tracing::debug!(
        type_id,
        brand_id = brand.id.as_str(),
        "auto-selected single brand"
    );
}

fn warn_no_brands_for_type(type_id: &str) {
    tracing::warn!(
        type_id,
        "no brands in list for this type (brands table JOIN may have filtered them out)"
    );
}

fn warn_multiple_brands_for_type(type_id: &str, brand_count: usize) {
    tracing::warn!(
        type_id,
        brand_count,
        "multiple brands, no active selection — cannot auto-select"
    );
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

// ── Notification settings ──────────────────────────────────

async fn get_notification_settings(
    State(state): State<Arc<AppState>>,
) -> AppResult<NotificationSettings> {
    let settings: NotificationSettings = state
        .db
        .get_config("notification_settings")
        .await
        .map_err(db_err)?
        .unwrap_or_default();
    Ok(Json(settings))
}

async fn update_notification_settings(
    State(state): State<Arc<AppState>>,
    Json(body): Json<NotificationSettings>,
) -> StatusCode {
    match state.db.put_config("notification_settings", &body).await {
        Ok(()) => StatusCode::OK,
        Err(e) => {
            tracing::error!("Update notification settings error: {e}");
            StatusCode::INTERNAL_SERVER_ERROR
        }
    }
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

    // ── resolve_brand ──────────────────────────────────────

    fn make_brand(id: &str, type_id: &str) -> SupplementBrand {
        SupplementBrand {
            id: id.into(),
            type_id: type_id.into(),
            brand_id: "test-brand".into(),
            brand_name: "Test".into(),
            product_name: "Test Product".into(),
            serving_dose: 100.0,
            serving_unit: "mg".into(),
            units_per_serving: 1.0,
            unit_name: "capsule".into(),
            form: "pill".into(),
            instructions: None,
            url: None,
            price_per_serving: None,
            subscription_discount: None,
            in_stock: true,
        }
    }

    #[test]
    fn test_resolve_brand_active_selection() {
        let brands = vec![make_brand("theanine-nutricost", "l-theanine")];
        let selections = std::collections::HashMap::from([(
            "l-theanine".to_string(),
            "theanine-nutricost".to_string(),
        )]);
        let result = resolve_brand("l-theanine", &brands, &selections, None);
        assert_eq!(result.unwrap().id, "theanine-nutricost");
    }

    #[test]
    fn test_resolve_brand_auto_select_single_brand() {
        let brands = vec![make_brand("theanine-nutricost", "l-theanine")];
        let selections = std::collections::HashMap::new();
        let result = resolve_brand("l-theanine", &brands, &selections, None);
        assert_eq!(result.unwrap().id, "theanine-nutricost");
    }

    #[test]
    fn test_resolve_brand_auto_select_fails_with_multiple_brands() {
        let brands = vec![
            make_brand("alcar-momentous", "alcar"),
            make_brand("alcar-nutricost", "alcar"),
        ];
        let selections = std::collections::HashMap::new();
        assert!(resolve_brand("alcar", &brands, &selections, None).is_none());
    }

    #[test]
    fn test_resolve_brand_no_brands_for_type() {
        let brands = vec![make_brand("other-brand", "other-type")];
        let selections = std::collections::HashMap::new();
        assert!(resolve_brand("l-theanine", &brands, &selections, None).is_none());
    }

    #[test]
    fn test_resolve_brand_logged_taken_uses_log_brand() {
        let brands = vec![
            make_brand("alcar-momentous", "alcar"),
            make_brand("alcar-nutricost", "alcar"),
        ];
        let selections =
            std::collections::HashMap::from([("alcar".to_string(), "alcar-momentous".to_string())]);
        let log = SupplementLog {
            type_id: "alcar".into(),
            brand_id: "alcar-nutricost".into(),
            taken: true,
        };
        let result = resolve_brand("alcar", &brands, &selections, Some(&log));
        assert_eq!(result.unwrap().id, "alcar-nutricost");
    }

    #[test]
    fn test_resolve_brand_logged_not_taken_uses_selection() {
        let brands = vec![
            make_brand("alcar-momentous", "alcar"),
            make_brand("alcar-nutricost", "alcar"),
        ];
        let selections =
            std::collections::HashMap::from([("alcar".to_string(), "alcar-momentous".to_string())]);
        let log = SupplementLog {
            type_id: "alcar".into(),
            brand_id: "alcar-nutricost".into(),
            taken: false,
        };
        let result = resolve_brand("alcar", &brands, &selections, Some(&log));
        assert_eq!(result.unwrap().id, "alcar-momentous");
    }

    #[test]
    fn test_resolve_brand_selection_points_to_missing_brand() {
        // Active selection references a brand that list_brands() didn't return
        // (e.g., brand_id FK in supplement_brands doesn't exist in brands table)
        let brands = vec![make_brand("theanine-other", "l-theanine")];
        let selections = std::collections::HashMap::from([(
            "l-theanine".to_string(),
            "theanine-nutricost".to_string(),
        )]);
        // Selection exists but points to brand not in the list — returns None,
        // does NOT fall through to auto-select
        assert!(resolve_brand("l-theanine", &brands, &selections, None).is_none());
    }

    #[test]
    fn test_resolve_brand_logged_taken_but_brand_missing() {
        // Taken with a brand that list_brands() didn't return
        let brands = vec![make_brand("theanine-other", "l-theanine")];
        let log = SupplementLog {
            type_id: "l-theanine".into(),
            brand_id: "theanine-nutricost".into(),
            taken: true,
        };
        let selections = std::collections::HashMap::new();
        // Log says taken with this brand, but brand not in list — returns None,
        // does NOT fall through to selection or auto-select
        assert!(resolve_brand("l-theanine", &brands, &selections, Some(&log)).is_none());
    }

    #[test]
    fn test_resolve_brand_selection_preferred_over_auto_select() {
        let brands = vec![make_brand("theanine-nutricost", "l-theanine")];
        let selections = std::collections::HashMap::from([(
            "l-theanine".to_string(),
            "theanine-nutricost".to_string(),
        )]);
        // Even with a single brand, if there's a selection, it uses the selection path
        let result = resolve_brand("l-theanine", &brands, &selections, None);
        assert_eq!(result.unwrap().id, "theanine-nutricost");
    }

    #[test]
    fn test_resolve_brand_empty_brands_list() {
        let brands: Vec<SupplementBrand> = vec![];
        let selections = std::collections::HashMap::new();
        assert!(resolve_brand("l-theanine", &brands, &selections, None).is_none());
    }

    #[test]
    fn test_resolve_brand_other_type_brands_dont_interfere() {
        // Brands exist but for other types — l-theanine should get 0 matches
        let brands = vec![
            make_brand("alcar-momentous", "alcar"),
            make_brand("omega3-sr", "omega3"),
        ];
        let selections = std::collections::HashMap::new();
        assert!(resolve_brand("l-theanine", &brands, &selections, None).is_none());
    }
}
