use serde::{Deserialize, Serialize};

// ── Supplement Type (parent) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplementType {
    pub id: String,
    pub name: String,
    pub timing: String,
    pub training_day_only: bool,
    pub active: bool,
    pub cycle_id: Option<String>,
    pub target_dose: f64,
    pub target_unit: String,
    pub instructions: Option<String>,
    pub sort_order: i32,
}

// ── Supplement Brand (child) ────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SupplementBrand {
    pub id: String,
    pub type_id: String,
    pub brand: String,
    pub product_name: String,
    pub serving_dose: f64,
    pub serving_unit: String,
    pub units_per_serving: f64,
    pub unit_name: String,
    pub form: String,
    pub instructions: Option<String>,
}

// ── Computed daily dose ─────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DailyDose {
    pub supplement_type: SupplementType,
    pub brand: SupplementBrand,
    pub servings_needed: f64,
    pub dose_label: String,
}

// ── Cycle ───────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Cycle {
    pub id: String,
    pub name: String,
    pub weeks_on: u32,
    pub weeks_off: u32,
    pub start_date: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateCycle {
    pub name: String,
    pub weeks_on: u32,
    pub weeks_off: u32,
    pub start_date: String,
}

// ── Training schedule ───────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrainingSchedule {
    pub days: Vec<String>,
}

// ── Day log ─────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize)]
pub struct DayLog {
    pub date: String,
    pub sleep: Option<i32>,
    pub energy_morning: Option<i32>,
    pub energy_afternoon: Option<i32>,
    pub energy_evening: Option<i32>,
    pub workout_done: Option<bool>,
    pub workout_motivation: Option<i32>,
}

impl DayLog {
    pub fn empty(date: &str) -> Self {
        Self {
            date: date.to_string(),
            sleep: None,
            energy_morning: None,
            energy_afternoon: None,
            energy_evening: None,
            workout_done: None,
            workout_motivation: None,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct SupplementLog {
    pub type_id: String,
    pub brand_id: String,
    pub taken: bool,
}

// ── Today composite ─────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TodayResponse {
    pub date: String,
    pub is_training_day: bool,
    pub doses: Vec<DoseStatus>,
    pub sleep: Option<i32>,
    pub energy: EnergyStatus,
    pub workout: WorkoutStatus,
}

#[derive(Debug, Serialize)]
pub struct DoseStatus {
    pub dose: DailyDose,
    pub taken: bool,
}

#[derive(Debug, Serialize)]
pub struct EnergyStatus {
    pub morning: Option<i32>,
    pub afternoon: Option<i32>,
    pub evening: Option<i32>,
}

#[derive(Debug, Serialize)]
pub struct WorkoutStatus {
    pub done: Option<bool>,
    pub motivation: Option<i32>,
}

// ── History ─────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct DaySummary {
    pub date: String,
    pub sleep: Option<i32>,
    pub energy_avg: Option<f64>,
    pub workout: Option<bool>,
    pub supplements_taken: u32,
    pub supplements_total: u32,
}

#[derive(Debug, Deserialize)]
pub struct HistoryQuery {
    pub days: Option<u32>,
}
