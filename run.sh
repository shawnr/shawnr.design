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
    echo "Starting Hugo dev server..."
    cd "$HUGO_DIR" && hugo server --disableFastRender
    ;;
  deploy)
    if [ -z "$IONOS_HOST" ] || [ -z "$IONOS_MEDIA_PATH" ]; then
      echo "ERROR: IONOS_HOST and IONOS_MEDIA_PATH must be set in .siteconfig"
      exit 1
    fi
    SRC="$MEDIA_DIR/"
    DEST="$IONOS_HOST:$IONOS_MEDIA_PATH/"
    if [ "${2:-}" = "--go" ]; then
      echo "DEPLOYING media to Ionos (live)..."
      rsync -avz "$SRC" "$DEST"
    else
      echo "DRY RUN — media deploy (add --go to execute for real)"
      rsync -avzn "$SRC" "$DEST"
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
