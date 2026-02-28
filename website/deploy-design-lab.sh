#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-hookwing-design-lab}"
BRANCH_NAME="${2:-design-lab}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required"
  exit 1
fi

cd "$ROOT_DIR/.."

# Create project if needed
npx wrangler pages project list >/dev/null 2>&1 || true
npx wrangler pages project create "$PROJECT_NAME" --production-branch main >/dev/null 2>&1 || true

# Deploy static folder
npx wrangler pages deploy ./website --project-name "$PROJECT_NAME" --branch "$BRANCH_NAME"
