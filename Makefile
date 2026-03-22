.PHONY: dev-frontend dev-backend build lint lint-fix format format-check \
       lint-frontend lint-fix-frontend format-frontend format-check-frontend \
       lint-backend format-backend build-frontend build-backend

# ── Development ──────────────────────────────────────────────

dev-frontend:
	cd frontend && npx vite

dev-backend:
	cd backend && cargo lambda watch --port 8000

# ── Build ────────────────────────────────────────────────────

build: build-frontend build-backend

build-frontend:
	cd frontend && npm run build

build-backend:
	cd backend && cargo lambda build --release --arm64 --output-format zip

# ── Lint ─────────────────────────────────────────────────────

lint: lint-frontend lint-backend

lint-frontend:
	cd frontend && npx eslint .

lint-fix: lint-fix-frontend
	cd backend && cargo clippy --fix --allow-dirty

lint-fix-frontend:
	cd frontend && npx eslint . --fix

lint-backend:
	cd backend && cargo clippy -- -D warnings

# ── Format ───────────────────────────────────────────────────

format: format-frontend format-backend

format-frontend:
	cd frontend && npx prettier --write .

format-check: format-check-frontend
	cd backend && cargo fmt -- --check

format-check-frontend:
	cd frontend && npx prettier --check .

format-backend:
	cd backend && cargo fmt
