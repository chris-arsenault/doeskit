# Claude Guide — Dosekit

Supplement and health tracking app. Single-user, mobile-first PWA with Rust Lambda backend and DynamoDB storage.

## Critical Rules

- **Never run terraform apply, destroy, or any AWS-mutating commands.** Infrastructure changes are done by the user.
- **Never commit secrets, .env files, or credentials.**
- **Follow ~/src/platform/INTEGRATION.md** — the canonical source for all platform conventions.
- **Do NOT create API Gateways, per-project VPCs, per-project LBs, or per-project Cognito pools.**

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Zustand. S3 + CloudFront hosting.
- **Backend:** Rust (axum + lambda_http). Lambda behind the **shared ALB** with `jwt-validation`.
- **Storage:** DynamoDB single-table design.
- **Auth:** Shared Cognito pool. Frontend uses `amazon-cognito-identity-js` (in-app form, Bearer tokens). ALB validates JWT via `jwt-validation` action before requests reach Lambda.
- **Domain:** dosekit.ahara.io (frontend/CloudFront), api.dosekit.ahara.io (API/shared ALB).

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
infrastructure/    Terraform
  terraform/
    main.tf        Backend (shared tfstate-559098897826) + provider
    locals.tf      Domain config
    dosekit.tf     DynamoDB, Lambda, ALB listener rules, ACM, DNS, SPA module
    modules/
      spa-website/ S3 + CloudFront + ACM + WAF (frontend only)
scripts/           Build and deploy
```

## Key Concepts

### ALB Integration (not API Gateway)
The API Lambda is exposed via the **shared ALB** (from platform-network). Two listener rules:
- Priority 200: OPTIONS (CORS preflight, no auth)
- Priority 201: All other methods (jwt-validation + forward)

The ALB validates Bearer tokens against Cognito's JWKS endpoint. Lambda receives pre-validated requests.

### Supplement Model
Each supplement has `timing`, `training_day_only`, `cycle_id`, and `notes`. See seed.json for the full stack.

### Training Schedule
Stored as CONFIG item. Days of week when training is scheduled. Today view uses this to show/hide training-day-only supplements.

### Cycle Logic
`is_cycle_on()` computes day position in the on/off cycle. Off-cycle supplements are filtered from the Today view.

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
| POST | `/api/supplements` | Create supplement |
| DELETE | `/api/supplements/{id}` | Delete supplement |
| GET | `/api/cycles` | List all cycles |
| POST | `/api/cycles` | Create cycle |
| DELETE | `/api/cycles/{id}` | Delete cycle |
| GET | `/api/schedule` | Get training schedule |
| POST | `/api/schedule` | Set training schedule |
| GET | `/api/history?days=14` | Day summaries |
| POST | `/api/seed` | Load seed.json into DynamoDB |

## Deploy

```bash
./scripts/deploy.sh
```

Parameterless. Builds Rust Lambda + React frontend, then `terraform init -reconfigure` + `terraform apply -auto-approve`. State in shared bucket `tfstate-559098897826`, key `projects/dosekit.tfstate`.

## Common Gotchas

- Rust Lambda uses `provided.al2023` runtime with `bootstrap` binary name.
- Build with `cargo lambda build --release --arm64` for Graviton.
- Frontend proxies `/api` to localhost:8000 in dev mode.
- DynamoDB table name comes from `DOSEKIT_TABLE` environment variable.
- Seed data is embedded at compile time via `include_str!("../seed.json")`.
- Ashwagandha cycle start_date (2026-01-26) is set so that 3/23/2026 is the first day of an off-period.
- CORS preflight (OPTIONS) has its own ALB listener rule (priority 200) with no auth.
- The `jwt-validation` action type requires AWS provider >= 6.22.0.
