# Architecture

## Overview

Dosekit is a single-user health tracking app with a mobile-first PWA frontend and a serverless AWS backend. The design prioritizes minimal daily interaction — the user taps scores and checkboxes rather than typing.

```
                    +-----------+
                    | CloudFront|
                    |   (CDN)   |
                    +-----+-----+
                          |
                    +-----+-----+
                    |  S3 Bucket |  ← React SPA (static assets)
                    |  (frontend)|
                    +------------+

User (PWA) ──── HTTPS ────► API Gateway v2 (HTTP)
                             │
                         JWT Auth (Cognito)
                             │
                         ┌───▼───┐
                         │Lambda │  ← Rust (axum + lambda_http)
                         └───┬───┘
                             │
                         ┌───▼────┐
                         │DynamoDB│  ← Single-table design
                         └────────┘
```

## Frontend

**React 18 + Vite + TypeScript + Zustand**

The frontend is a mobile-first SPA designed around a 480px max-width layout with a bottom navigation bar (Today / History / Setup). It follows the same patterns as the [svap](https://github.com/chris-arsenault) project:

- **Auth:** `amazon-cognito-identity-js` for Cognito login/session management. JWT tokens are stored in the Cognito SDK's local storage and refreshed automatically.
- **Config:** Runtime configuration injected as `window.__APP_CONFIG__` via a Terraform-generated `config.js` file. This allows the same build to work in dev (env vars) and production (runtime injection).
- **State:** Single Zustand store (`data/store.ts`) holds today's checklist state, supplement definitions, and cycle configurations.
- **API layer:** `data/api.ts` provides `apiGet`, `apiPost`, `apiDelete` helpers that automatically attach the JWT bearer token.
- **Routing:** React Router v7 with three views: Today (daily checklist), History (14-day summary), Setup (supplement/cycle CRUD).

### Views

**Today** — The primary view. Renders:
1. Sleep score (1-10 tap selector)
2. Energy scores (morning/afternoon/evening, each 1-10)
3. Workout toggle (yes/no) with conditional motivation score
4. Supplement checklist (filtered by active cycle status)

**Setup** — CRUD for supplements and cycles. Supplements can optionally reference a cycle. Cycles define weeks-on / weeks-off schedules with a start date.

**History** — Shows per-day summaries (sleep, avg energy, workout, supplements taken/total) for the last 14 days.

## Backend

**Rust (axum 0.8 + lambda_http 0.14)**

The backend is a single Lambda function behind API Gateway v2. It uses axum's router, which is compatible with `lambda_http::run()` for Lambda and `axum::serve()` for local development.

### API Design

All routes are prefixed with `/api`. The handler reads the JWT subject from the API Gateway context (Cognito authorizer). Since this is a single-user app, the JWT is used only for authentication, not authorization.

The `/api/today` endpoint is the main composite endpoint — it:
1. Fetches all supplements and cycles
2. Filters supplements by cycle status (calls `is_cycle_on()`)
3. Fetches today's log entries
4. Assembles a `TodayResponse` with supplement statuses and metric values

### Cycle Logic

Cycles are defined by `weeks_on`, `weeks_off`, and `start_date`. The `is_cycle_on()` function computes:

```
total_period = (weeks_on + weeks_off) * 7
day_in_cycle = (today - start_date) % total_period
is_on = day_in_cycle < weeks_on * 7
```

Supplements linked to an off-cycle are hidden from the Today view.

## Storage

**DynamoDB single-table design**

One table (`dosekit`) with composite primary key (PK + SK):

| PK | SK | Use |
|---|---|---|
| `SUPP` | `<uuid>` | Supplement definitions |
| `CYCLE` | `<uuid>` | Cycle configurations |
| `LOG` | `<date>#<type>#<id>` | Daily log entries |
| `CONFIG` | `<key>` | App configuration (future) |

### Access Patterns

| Pattern | Query |
|---------|-------|
| All supplements | `PK = "SUPP"` |
| All cycles | `PK = "CYCLE"` |
| Today's logs | `PK = "LOG", SK begins_with "<date>#"` |
| Date range logs | `PK = "LOG", SK BETWEEN "<start>#" AND "<end>#~"` |

Log entries use a composite SK of `<date>#<type>#<id>`, which enables efficient date-range queries and per-type filtering within a day.

Supplement and cycle records store the full JSON in a `data` attribute for flexibility, with key fields also stored as top-level attributes for potential future GSI use.

## Infrastructure

**Terraform with reusable modules**

### Modules

**`api-http`** — Creates:
- Lambda function (Rust custom runtime, x86_64)
- IAM role with DynamoDB permissions
- API Gateway v2 (HTTP) with CORS and JWT authorizer
- Custom domain (`api.dosekit.ahara.io`) with ACM cert and Route 53

**`spa-website`** — Creates:
- S3 bucket with KMS encryption
- CloudFront distribution with OAC
- WAF Web ACL (default allow)
- ACM certificate with DNS validation
- Route 53 records (`dosekit.ahara.io`)
- SPA routing (404/403 → index.html)
- Runtime config injection (`config.js`)

### Auth

Authentication uses a shared Cognito user pool managed in the platform infrastructure. The user pool ID and client ID are stored in SSM Parameter Store and read by Terraform at deploy time. API Gateway v2 validates JWT tokens before they reach the Lambda function.

## Build & Deploy

The deploy pipeline (`scripts/deploy.sh`):

1. `cargo lambda build --release --output-format zip` — Builds the Rust Lambda binary
2. `npm ci && npm run build` — Builds the React SPA
3. `terraform init && terraform apply` — Deploys infrastructure, uploads assets, invalidates CloudFront cache
