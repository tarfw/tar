#!/bin/bash
set -e

# ─── TAR Cloudflare Workers Deploy ────────────────────────────────────────────
#
#   cfworkers/
#   ├── tar-sync       — Durable Object + WebSocket sync + auth
#   ├── s3-storage     — S3 presigned upload/download
#   ├── turso-db       — Turso publish, vector search, user DB, collab
#   └── storefront     — Marketplace HTML + JSON reads
#
# Prerequisites:
#   npx wrangler login
#   Set secrets per SECRETS.md
#
# Usage:
#   ./deploy.sh              # deploy all
#   ./deploy.sh tar-sync     # deploy one
# ──────────────────────────────────────────────────────────────────────────────

WORKERS=("tar-sync" "s3-storage" "turso-db" "storefront")
TARGET="${1:-all}"

deploy_worker() {
  local dir="$1"
  echo "━━━ Deploying $dir ━━━"
  cd "$dir"
  npm install --silent 2>/dev/null
  npx wrangler deploy
  cd ..
  echo "✓ $dir deployed"
  echo ""
}

if [ "$TARGET" = "all" ]; then
  for w in "${WORKERS[@]}"; do
    deploy_worker "$w"
  done
  echo "━━━ All workers deployed ━━━"
else
  if [ -d "$TARGET" ]; then
    deploy_worker "$TARGET"
  else
    echo "Unknown worker: $TARGET"
    echo "Available: ${WORKERS[*]}"
    exit 1
  fi
fi
