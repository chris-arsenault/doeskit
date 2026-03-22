mod db;
mod models;
mod routes;

use axum::Router;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tracing_subscriber::EnvFilter;

pub struct AppState {
    pub db: db::DynamoClient,
}

#[tokio::main]
async fn main() -> Result<(), lambda_http::Error> {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::from_default_env())
        .json()
        .init();

    let config = aws_config::load_defaults(aws_config::BehaviorVersion::latest()).await;
    let dynamo = aws_sdk_dynamodb::Client::new(&config);
    let table = std::env::var("DOSEKIT_TABLE").unwrap_or_else(|_| "dosekit".into());

    let state = Arc::new(AppState {
        db: db::DynamoClient::new(dynamo, table),
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
