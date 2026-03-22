use serde::{Deserialize, Serialize};

// ── Supplement ──────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Supplement {
    pub id: String,
    pub name: String,
    pub dose: String,
    pub unit: String,
    pub active: bool,
    pub cycle_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateSupplement {
    pub name: String,
    pub dose: String,
    pub unit: String,
    pub cycle_id: Option<String>,
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

// ── Log entries ─────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct LogRequest {
    pub r#type: String,
    pub id: String,
    pub value: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LogEntry {
    pub r#type: String,
    pub id: String,
    pub value: serde_json::Value,
    pub timestamp: String,
}

// ── Today composite ─────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct TodayResponse {
    pub date: String,
    pub supplements: Vec<SupplementStatus>,
    pub sleep: Option<i32>,
    pub energy: EnergyStatus,
    pub workout: WorkoutStatus,
}

#[derive(Debug, Serialize)]
pub struct SupplementStatus {
    pub supplement: Supplement,
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
