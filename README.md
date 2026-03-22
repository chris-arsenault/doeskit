# Dosekit

Supplement and health tracking app built for zero-friction daily use. Track supplements (including week-on/week-off cycles), sleep quality, energy levels, and workouts with tap-based inputs — no typing required.

## Features

- **Daily checklist** — sleep score, energy (morning/afternoon/evening), workout yes/no + motivation, supplement intake
- **Cycle-aware supplements** — define on/off schedules; the app auto-hides supplements during off weeks
- **Score selectors** — tap 1-10 for everything; no free-text input needed for daily logging
- **History** — day-by-day summaries with at-a-glance stats
- **Push notifications** — reminders to log (planned)
- **PWA** — installable on mobile, works offline (planned)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, TypeScript, Zustand |
| Backend | Rust (axum + lambda_http) |
| Storage | DynamoDB (single-table design) |
| Auth | AWS Cognito (JWT) |
| Hosting | S3 + CloudFront (frontend), API Gateway + Lambda on Graviton (backend) |
| IaC | Terraform |

## Prerequisites

- [Node.js](https://nodejs.org/) (for frontend)
- [Rust](https://rustup.rs/) + [cargo-lambda](https://www.cargo-lambda.info/) (for backend)
- [Terraform](https://www.terraform.io/) >= 1.14 (for infrastructure)
- AWS account with Cognito user pool configured

## Development

```bash
# Frontend dev server (localhost:5173, proxies /api to backend)
make dev-frontend

# Backend dev server (localhost:8000, uses cargo-lambda watch)
make dev-backend

# Build both
make build

# Lint
make lint

# Format
make format
```

## Deployment

```bash
./scripts/deploy.sh
```

This builds the Rust Lambda (arm64), builds the React frontend, and runs `terraform apply` to deploy to AWS.

## Project Structure

```
frontend/               React SPA
  src/
    App.tsx             Auth flow + bottom nav routing
    auth.ts             Cognito integration
    config.ts           Runtime config (injected by Terraform)
    data/api.ts         Fetch helpers with JWT
    data/store.ts       Zustand store
    views/Today.tsx     Daily checklist
    views/Setup.tsx     Supplement + cycle management
    views/History.tsx   Day-by-day log summary

backend/                Rust Lambda
  src/
    main.rs             Entry point + axum router
    routes.rs           API handlers
    models.rs           Types (Supplement, Cycle, Log, etc.)
    db.rs               DynamoDB client

infrastructure/         Terraform
  terraform/
    dosekit.tf          DynamoDB + module wiring
    modules/api-http/   Lambda + API Gateway + custom domain
    modules/spa-website/ S3 + CloudFront + ACM + WAF

scripts/
  build-lambda.sh       Build Rust for Lambda (arm64)
  deploy.sh             Full build + deploy pipeline
```

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture documentation.

## License

[PolyForm Noncommercial 1.0.0](LICENSE.md)
