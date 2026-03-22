# Claude Guide — Dosekit

Supplement and health tracking app. Single-user, mobile-first PWA with Rust Lambda backend and shared PostgreSQL.

## Critical Rules

- **Never run terraform apply, destroy, or any AWS-mutating commands.** Infrastructure changes are done by the user.
- **Never commit secrets, .env files, or credentials.**
- **Follow ~/src/platform/INTEGRATION.md** — the canonical source for all platform conventions.
- **Do NOT create API Gateways, per-project VPCs, per-project LBs, per-project Cognito pools, or per-project RDS instances.**

## Architecture

- **Frontend:** React 18 + Vite + TypeScript + Zustand. S3 + CloudFront hosting.
- **Backend:** Rust (axum + lambda_http). Lambda behind the **shared ALB** with `jwt-validation`. Runs in **shared VPC** private subnets.
- **Storage:** Shared RDS PostgreSQL 16 — per-project database `dosekit`. Migrations via platform `db-migrate` CLI.
- **Auth:** Shared Cognito pool. Frontend uses `amazon-cognito-identity-js`. ALB validates JWT via `jwt-validation` action.
- **Domain:** dosekit.ahara.io (frontend/CloudFront), api.dosekit.ahara.io (API/shared ALB).

## Code Layout

```
frontend/          React SPA (Vite)
  src/
    auth.ts        Cognito auth (amazon-cognito-identity-js)
    config.ts      Runtime config (window.__APP_CONFIG__)
    data/          API client, Zustand store
    views/         Page components (Today, Setup, History)
backend/           Rust Lambda
  src/
    main.rs        Lambda handler + axum router
    routes.rs      Route handlers
    models.rs      Request/response types
    db.rs          PostgreSQL client (tokio-postgres)
db/                Database migrations (platform convention)
  migrations/
    001_create_tables.sql
    rollback/001_create_tables.sql
    seed/001_supplements.sql
infrastructure/    Terraform
  terraform/
    main.tf        Backend (shared tfstate-559098897826) + provider
    locals.tf      Domain config
    dosekit.tf     Lambda (VPC), ALB rules, ACM, DNS, Cognito client, SPA module
    modules/
      spa-website/ S3 + CloudFront + ACM + WAF (frontend only)
scripts/           Build and deploy
platform.yml       Platform CLI config (project name, migration path)
```

## Database

PostgreSQL on shared RDS. Managed via platform migration tooling:

```bash
db-migrate    # Run migrations (in deploy script)
db-seed       # Load seed data (supplements, cycles, training schedule)
db-rollback   # Roll back all migrations
db-drop       # Drop the dosekit database
```

### Schema

```sql
cycles        (id, name, weeks_on, weeks_off, start_date)
supplements   (id, name, dose, unit, active, cycle_id, timing, training_day_only, notes)
logs          (id, date, entry_type, entry_id, value JSONB)  -- UNIQUE(date, entry_type, entry_id)
config        (key, value JSONB)
```

### Environment

Lambda receives `DATABASE_URL` with connection string to the `dosekit` database on shared RDS.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | Health check |
| GET | `/today` | Today's checklist (cycle-filtered, training-day-aware) |
| POST | `/log` | Log an entry `{type, id, value}` |
| GET | `/supplements` | List all supplements |
| POST | `/supplements` | Create supplement |
| DELETE | `/supplements/{id}` | Delete supplement |
| GET | `/cycles` | List all cycles |
| POST | `/cycles` | Create cycle |
| DELETE | `/cycles/{id}` | Delete cycle |
| GET | `/schedule` | Get training schedule |
| POST | `/schedule` | Set training schedule |
| GET | `/history?days=14` | Day summaries |

## Deploy

```bash
./scripts/deploy.sh
```

Builds Lambda + frontend, runs `db-migrate`, then `terraform apply`.

## Common Gotchas

- Rust Lambda uses `provided.al2023` runtime with `bootstrap` binary name.
- Lambda runs in VPC private subnets to access shared RDS.
- `DATABASE_URL` env var constructed by Terraform from RDS SSM params.
- CORS preflight (OPTIONS) has its own ALB listener rule (priority 200) with no auth.
- Ashwagandha cycle start_date (2026-01-26) is set so that 3/23/2026 is the first day of an off-period.
- Seeding is done via `db-seed` (platform CLI), not an API endpoint.
- Dosekit must be registered in platform-services `migration_projects` before first `db-migrate`.
