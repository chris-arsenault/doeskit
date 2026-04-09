#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building Rust Lambda..."
cd "$PROJECT_ROOT/backend"
cargo lambda build --release

echo "==> Lambda binary ready at: target/lambda/dosekit/bootstrap"
