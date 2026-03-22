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
    views/         Page components (Today, Setup, History)
    components/    Shared UI components
backend/           Rust Lambda
  src/
    main.rs        Lambda handler + axum router
    routes.rs      Route handlers
    models.rs      Request/response types + DynamoDB models
    db.rs          DynamoDB client
  seed.json        Seed data (supplements, cycles, training schedule)
infrastructure/    Terraform (S3, CloudFront, API GW, Lambda, DynamoDB)
scripts/           Build and deploy scripts
```

## Key Concepts

### Supplement Model
Each supplement has:
- `timing` — when to take it: `morning`, `pre_workout`, `intra_workout`, `post_workout`, `evening`
- `training_day_only` — if true, only shown on scheduled training days (hidden when workout skipped)
- `cycle_id` — optional link to a cycle for on/off scheduling
- `notes` — usage instructions shown in the checklist

### Training Schedule
Stored as CONFIG item. Days of week when training is scheduled (e.g., tue/thu/sat/sun). The Today view uses this to:
- Show/hide training-day-only supplements
- Move workout-window supplements to morning on rest days
- Display "Training Day" badge

### Cycle Logic
`is_cycle_on()` computes: `day_in_cycle = (today - start_date) % (weeks_on + weeks_off) * 7`. Supplements linked to an off-cycle are filtered from the Today view.

### Workout Skip Intelligence
On a training day, if user taps "Skip" (workout=false), training-day-only supplements are hidden. Non-training-day-only supplements with workout timing (pre/intra/post) are moved to the morning group.

## DynamoDB Schema (single table: dosekit)

| PK | SK | Description |
|---|---|---|
| `SUPP` | `<id>` | Supplement definition (JSON in `data` attr) |
| `CYCLE` | `<id>` | Cycle configuration (weeks on/off, start date) |
| `LOG` | `<date>#<type>#<id>` | Daily log entry |
| `CONFIG` | `<key>` | App config (e.g., `training_schedule`) |

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
| GET | `/api/today` | Today's checklist (cycle-filtered, training-day-aware) |
| POST | `/api/log` | Log an entry `{type, id, value}` |
| GET | `/api/supplements` | List all supplements |
| POST | `/api/supplements` | Create supplement `{name, dose, unit, timing, training_day_only, cycle_id?, notes?}` |
| DELETE | `/api/supplements/{id}` | Delete supplement |
| GET | `/api/cycles` | List all cycles |
| POST | `/api/cycles` | Create cycle `{name, weeks_on, weeks_off, start_date}` |
| DELETE | `/api/cycles/{id}` | Delete cycle |
| GET | `/api/schedule` | Get training schedule |
| POST | `/api/schedule` | Set training schedule `{days: ["tuesday", ...]}` |
| GET | `/api/history?days=14` | Day summaries for last N days |
| POST | `/api/seed` | Load seed.json into DynamoDB |

Adding a new route requires: handler in `routes.rs`, route in `api_routes()`, and route string in `infrastructure/terraform/dosekit.tf`.

## Seed Data

`backend/seed.json` contains the initial supplement stack, ashwagandha cycle, and training schedule. Load via `POST /api/seed`.

## Common Gotchas

- Rust Lambda uses `provided.al2023` runtime with `bootstrap` binary name.
- Build with `cargo lambda build --release --arm64` for Graviton.
- Frontend proxies `/api` to localhost:8000 in dev mode.
- DynamoDB table name comes from `DOSEKIT_TABLE` environment variable.
- Seed data is embedded at compile time via `include_str!("../seed.json")`.
- Ashwagandha cycle start_date (2026-01-26) is set so that 3/23/2026 is the first day of an off-period.
