#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "==> Building Rust Lambda (arm64)..."
cd "$PROJECT_ROOT/backend"
cargo lambda build --release --arm64 --output-format zip

echo "==> Lambda zip ready at: target/lambda/bootstrap/bootstrap.zip"
