.PHONY: lint lint-fix format format-check typecheck test build deploy

# ── Lint ─────────────────────────────────────────────────────

lint:
	cd frontend && pnpm exec eslint .
	cd backend && cargo clippy -- -D warnings
	terraform fmt -check -recursive infrastructure/terraform/

lint-fix:
	cd frontend && pnpm exec eslint . --fix
	cd backend && cargo clippy --fix --allow-dirty

# ── Format ───────────────────────────────────────────────────

format:
	cd frontend && pnpm exec prettier --write .
	cd backend && cargo fmt
	terraform fmt -recursive infrastructure/terraform/

format-check:
	cd frontend && pnpm exec prettier --check .
	cd backend && cargo fmt -- --check
	terraform fmt -check -recursive infrastructure/terraform/

# ── Typecheck ────────────────────────────────────────────────

typecheck:
	cd frontend && pnpm exec tsc --noEmit

# ── Test ─────────────────────────────────────────────────────

test:
	cd frontend && pnpm exec vitest run

# ── Build ────────────────────────────────────────────────────

build:
	cd frontend && pnpm run build
	cd backend && cargo lambda build --release --output-format zip

# ── Deploy ───────────────────────────────────────────────────

deploy:
	scripts/deploy.sh
