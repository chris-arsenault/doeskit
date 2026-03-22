#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building Rust Lambda..."
"$SCRIPT_DIR/build-lambda.sh"

echo ""
echo "==> Building frontend..."
cd "$PROJECT_ROOT/frontend"
npm ci
npm run build

# Verify no dev artifacts in build
if grep -r "localhost" "$PROJECT_ROOT/frontend/dist/assets/" 2>/dev/null; then
  echo "ERROR: Production build contains localhost references"
  exit 1
fi

echo ""
echo "==> Running Terraform..."
cd "$PROJECT_ROOT/infrastructure/terraform"

terraform init
terraform apply

echo ""
echo "==> Deploy complete!"
terraform output
