#!/usr/bin/env bash
# deploy.sh - Build backend + frontend and deploy via Terraform
#
# Parameterless by default. CI overrides STATE_BUCKET via env var.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TF_DIR="${ROOT_DIR}/infrastructure/terraform"

STATE_BUCKET="${STATE_BUCKET:-tfstate-559098897826}"
STATE_REGION="${STATE_REGION:-us-east-1}"

# ── Build Lambda zip ─────────────────────────────────────────────────
echo "==> Building Rust Lambda"
bash "${ROOT_DIR}/scripts/build-lambda.sh"

# ── Build frontend ───────────────────────────────────────────────────
echo ""
echo "==> Building frontend"
cd "${ROOT_DIR}/frontend"

if [ -d "dist" ]; then
  echo "    Cleaning old dist directory..."
  rm -rf dist
fi

pnpm install --frozen-lockfile 2>/dev/null || pnpm install
pnpm run build

# Sanity check: dist exists
if [ ! -d "dist" ]; then
  echo "    ERROR: Missing dist directory after build"
  exit 1
fi

# Sanity check: no dev markers in production build
index_hits=$(grep -n -E "@vite/client|/@react-refresh" dist/index.html 2>/dev/null || true)
if [ -n "$index_hits" ]; then
  echo "    ERROR: Dev server markers found in index.html"
  echo "$index_hits"
  exit 1
fi

js_hits=$(grep -R -n -I -E "react-refresh|jsx-dev-runtime|@vite/client" dist --include='*.js' 2>/dev/null || true)
if [ -n "$js_hits" ]; then
  echo "    ERROR: Dev-only runtime markers found in JS bundle"
  echo "$js_hits" | head -n 20
  exit 1
fi

echo "    Frontend build OK"

# ── Run database migrations ──────────────────────────────────────────
echo ""
echo "==> Running database migrations"
cd "${ROOT_DIR}"

REGION="us-east-1"
PROJECT=$(grep "^project:" platform.yml | sed 's/^project:[[:space:]]*//')
MIGRATIONS_DIR=$(grep "^migrations:" platform.yml | sed 's/^migrations:[[:space:]]*//')

if [ -d "$MIGRATIONS_DIR" ]; then
  BUCKET=$(aws ssm get-parameter --name /platform/db/migrations-bucket \
    --query Parameter.Value --output text --region "${REGION}")
  FN=$(aws ssm get-parameter --name /platform/db/migrate-function \
    --query Parameter.Value --output text --region "${REGION}")

  echo "    Uploading migrations for ${PROJECT}..."
  aws s3 sync "${MIGRATIONS_DIR}/" "s3://${BUCKET}/migrations/${PROJECT}/" --delete --quiet

  echo "    Running migrations..."
  RESULT_FILE=$(mktemp)
  aws lambda invoke \
    --function-name "${FN}" \
    --payload "{\"operation\":\"migrate\",\"project\":\"${PROJECT}\"}" \
    --cli-binary-format raw-in-base64-out \
    --region "${REGION}" \
    "${RESULT_FILE}" > /dev/null

  RESULT=$(cat "${RESULT_FILE}")
  rm "${RESULT_FILE}"

  if echo "${RESULT}" | grep -q '"errorMessage"'; then
    echo "    Migration FAILED:"
    echo "${RESULT}" | python3 -m json.tool 2>/dev/null || echo "${RESULT}"
    exit 1
  fi

  echo "${RESULT}" | python3 -m json.tool 2>/dev/null || echo "${RESULT}"
else
  echo "    No migrations directory, skipping."
fi

# ── Deploy with Terraform ────────────────────────────────────────────
echo ""
echo "==> Running Terraform"
terraform -chdir="${TF_DIR}" init -reconfigure \
  -backend-config="bucket=${STATE_BUCKET}" \
  -backend-config="region=${STATE_REGION}" \
  -backend-config="use_lockfile=true"

terraform -chdir="${TF_DIR}" apply -auto-approve

echo ""
echo "==> Deployment complete!"
terraform -chdir="${TF_DIR}" output
