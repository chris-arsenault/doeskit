pub mod db;
pub mod models;
pub mod routes;

pub struct AppState {
    pub db: db::PgPool,
}
