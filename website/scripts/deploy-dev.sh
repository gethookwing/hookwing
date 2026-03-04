#!/bin/bash
set -e

CF_TOKEN=$(python3 -c "import json,os; print(json.load(open(os.path.expanduser('~/.openclaw/secrets.json')))['providers']['cloudflare']['apiToken'])")
WEBSITE_DIR="/home/openclaw/.openclaw/workspace/hookwing/tech/hookwing/website"
DEPLOY_DIR="/tmp/hookwing-dev-deploy"
TIMESTAMP=$(date +%s)

# Clean deploy dir
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"/{pricing,why-hookwing,getting-started,api/pricing}

# Copy pages with cache-bust version stamp
for page in index.html pricing/index.html why-hookwing/index.html getting-started/index.html; do
  if [ -f "$WEBSITE_DIR/$page" ]; then
    sed "s|</head>|<meta name=\"version\" content=\"$TIMESTAMP\"></head>|" "$WEBSITE_DIR/$page" > "$DEPLOY_DIR/$page"
  fi
done

# Copy API files
cp "$WEBSITE_DIR/api/pricing/index.json" "$DEPLOY_DIR/api/pricing/" 2>/dev/null || true

# Deploy
cd "$DEPLOY_DIR"
CLOUDFLARE_API_TOKEN=$CF_TOKEN npx wrangler pages deploy . --project-name=hookwing-dev --branch=main 2>&1 | tail -6

echo ""
echo "✅ Deployed with version: $TIMESTAMP"
echo "💡 Hard refresh (Ctrl+Shift+R) if cached on custom domain"
