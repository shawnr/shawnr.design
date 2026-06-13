#!/bin/bash
set -e

# ── Defaults (safe/empty — override in .siteconfig) ─────────────
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HUGO_DIR="$SCRIPT_DIR"
CMS_DIR="$SCRIPT_DIR/cms"
MEDIA_DIR="$HOME/media/shawnrdesign"

IONOS_HOST=""
IONOS_MEDIA_PATH=""

# ── Load local overrides if present ──────────────────────────────
SITECONFIG="$SCRIPT_DIR/.siteconfig"
if [ -f "$SITECONFIG" ]; then
  # shellcheck source=/dev/null
  source "$SITECONFIG"
fi

# ── Commands ─────────────────────────────────────────────────────
case "${1:-help}" in
  cms)
    echo "Starting CMS at http://localhost:3000"
    node "$CMS_DIR/server.js"
    ;;
  build)
    echo "Building Hugo site..."
    cd "$HUGO_DIR" && hugo
    echo "Done. Output in $HUGO_DIR/public/"
    ;;
  serve)
    echo "Starting media server at http://localhost:8888..."
    (cd "$MEDIA_DIR" && python3 -m http.server 8888 --bind 127.0.0.1 &) 2>/dev/null
    MEDIA_PID=$!
    trap "kill $MEDIA_PID 2>/dev/null" EXIT
    echo "Starting Hugo dev server..."
    cd "$HUGO_DIR" && hugo server --disableFastRender
    ;;
  deploy)
    if [ -z "$R2_REMOTE" ] || [ -z "$R2_BUCKET" ]; then
      echo "ERROR: R2_REMOTE and R2_BUCKET must be set in .siteconfig"
      exit 1
    fi
    SRC="$MEDIA_DIR/"
    DEST="$R2_REMOTE:$R2_BUCKET"
    # Only sync slug subdirectories — skip loose files in the media root
    RCLONE_FILTER=(--filter '- .DS_Store' --filter '- .*' --filter '+ */**' --filter '- *')
    if [ "${2:-}" = "--go" ]; then
      echo "DEPLOYING media to Cloudflare R2..."
      rclone sync "$SRC" "$DEST" "${RCLONE_FILTER[@]}" --progress --transfers 4 --checkers 4 --tpslimit 10
    else
      echo "DRY RUN — media deploy (add --go to execute for real)"
      rclone sync "$SRC" "$DEST" "${RCLONE_FILTER[@]}" --dry-run --progress
    fi
    ;;
  media-server)
    echo "Serving media at http://localhost:8888"
    cd "$MEDIA_DIR" && python3 -m http.server 8888
    ;;
  *)
    echo "shawnr.design — project helper"
    echo ""
    echo "Usage: ./run.sh <command>"
    echo ""
    echo "Commands:"
    echo "  cms            Start the CMS at localhost:3000"
    echo "  build          Build the Hugo site to public/"
    echo "  serve          Start Hugo dev server with live reload"
    echo "  deploy         rsync media to Ionos (dry-run; add --go for real)"
    echo "  media-server   Serve media locally at localhost:8888 for dev"
    echo ""
    echo "Site deploys via GitHub Pages on push to main."
    ;;
esac
