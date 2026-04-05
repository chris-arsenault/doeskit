mod db;
mod models;
mod notifications;
mod routes;

use axum::Router;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

pub struct AppState {
    pub db: db::PgPool,
}

#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    rustls::crypto::ring::default_provider()
        .install_default()
        .expect("Failed to install rustls crypto provider");

    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let database_url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // Log connection target (redact password)
    if let Some(at_pos) = database_url.find('@') {
        tracing::info!("Connecting to: ...@{}", &database_url[at_pos + 1..]);
    }

    let state = Arc::new(AppState {
        db: db::PgPool::new(database_url),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    let app = Router::new()
        .merge(routes::api_routes())
        .layer(cors)
        .with_state(state);

    lambda_http::run(app).await
}
