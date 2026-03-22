# Claude Guide — Dosekit

Supplement and health tracking app. Single-user, mobile-first PWA with Rust Lambda backend and DynamoDB storage.

## Critical Rules

- **Never run terraform apply, destroy, or any AWS-mutating commands.** Infrastructure changes are done by the user.
- **Never commit secrets, .env files, or credentials.**
- Follow existing patterns in svap and websites repos for conventions.

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Zustand. S3 + CloudFront hosting.
- **Backend:** Rust (axum + lambda_http). Single Lambda behind API Gateway HTTP API.
- **Storage:** DynamoDB single-table design.
- **Auth:** Cognito JWT (platform shared user pool via SSM).
- **Domain:** dosekit.ahara.io (frontend), api.dosekit.ahara.io (API).

## Code Layout

```
frontend/          React SPA (Vite)
  src/
    auth.ts        Cognito auth (amazon-cognito-identity-js)
    config.ts      Runtime config (window.__APP_CONFIG__)
    data/          API client, Zustand store
    views/         Page components
    components/    Shared UI components
backend/           Rust Lambda
  src/
    main.rs        Lambda handler + axum router
    routes.rs      Route handlers
    models.rs      Request/response types + DynamoDB models
    db.rs          DynamoDB client
infrastructure/    Terraform (S3, CloudFront, API GW, Lambda, DynamoDB)
scripts/           Build and deploy scripts
```

## DynamoDB Schema (single table: dosekit)

| PK | SK | Description |
|---|---|---|
| `SUPP` | `<id>` | Supplement definition |
| `CYCLE` | `<id>` | Cycle configuration (weeks on/off, start date) |
| `LOG` | `<date>#<type>#<id>` | Daily log entry |
| `CONFIG` | `<key>` | App configuration |

## Development

```
make dev-frontend    # Vite dev server on :5173
make dev-backend     # cargo lambda watch on :8000
make build           # Build frontend + backend
make lint            # ESLint + cargo clippy
make format          # Prettier + cargo fmt
```

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/today` | Today's checklist (supplements filtered by cycle, logs) |
| POST | `/api/log` | Log an entry `{type, id, value}` |
| GET | `/api/supplements` | List all supplements |
| POST | `/api/supplements` | Create supplement `{name, dose, unit, cycle_id?}` |
| DELETE | `/api/supplements/{id}` | Delete supplement |
| GET | `/api/cycles` | List all cycles |
| POST | `/api/cycles` | Create cycle `{name, weeks_on, weeks_off, start_date}` |
| DELETE | `/api/cycles/{id}` | Delete cycle |
| GET | `/api/history?days=14` | Day summaries for last N days |

Adding a new route requires: handler in `routes.rs`, route in `api_routes()`, and route string in `infrastructure/terraform/dosekit.tf`.

## Common Gotchas

- Rust Lambda uses `provided.al2023` runtime with `bootstrap` binary name.
- Build with `cargo lambda build --release --arm64` for Graviton.
- Frontend proxies `/api` to localhost:8000 in dev mode.
- DynamoDB table name comes from `DOSEKIT_TABLE` environment variable.
