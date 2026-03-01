#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${1:-hookwing-design-lab}"
BRANCH_NAME="${2:-tina-cms-preview-dev}"
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
  echo "CLOUDFLARE_API_TOKEN is required"
  exit 1
fi

if [ "$BRANCH_NAME" = "main" ] || [ "$BRANCH_NAME" = "master" ] || [ "$BRANCH_NAME" = "production" ]; then
  echo "Refusing production deploy branch ($BRANCH_NAME). Use dev preview branch alias only."
  exit 1
fi

cd "$ROOT_DIR/.."

# Build Tina-managed blog/docs pages from markdown before deployment.
npm --prefix "$ROOT_DIR" install
npm --prefix "$ROOT_DIR" run build:content
npm --prefix "$ROOT_DIR" run prepare:preview

# Create project if needed
npx wrangler pages project list >/dev/null 2>&1 || true
npx wrangler pages project create "$PROJECT_NAME" --production-branch main >/dev/null 2>&1 || true

# Deploy preview-only artifact (no legacy v1-v11 surfaces).
npx wrangler pages deploy "$ROOT_DIR/.preview-dist" --project-name "$PROJECT_NAME" --branch "$BRANCH_NAME"
