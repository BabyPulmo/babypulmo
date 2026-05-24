#!/usr/bin/env bash
# Baby Pulmo — one-shot VPS deploy / update script.
# Usage on VPS:
#   cd /opt/babypulmo/deploy
#   ./deploy.sh up                # first-time bring-up (web + caddy)
#   ./deploy.sh up phase2         # bring up classifier too (after model uploaded)
#   ./deploy.sh update            # pull latest code + rebuild + restart
#   ./deploy.sh logs              # tail all logs
#   ./deploy.sh status            # ps + health
#   ./deploy.sh down              # stop everything

set -euo pipefail

cd "$(dirname "$0")"

CMD="${1:-help}"
PROFILE="${2:-}"

COMPOSE="docker compose"

require_env_file() {
  if [ ! -f ".env.production" ]; then
    echo "✗ .env.production not found. Copy .env.production.example and fill values."
    exit 1
  fi
}

case "$CMD" in
  up)
    require_env_file
    echo "→ Bringing up Baby Pulmo stack..."
    mkdir -p "${CLASSIFIER_MODELS_DIR:-/var/babypulmo/models}"
    if [ "$PROFILE" = "phase2" ]; then
      $COMPOSE --profile phase2 up -d --build
    else
      $COMPOSE up -d --build web caddy
    fi
    echo "→ Waiting for health checks..."
    sleep 10
    $COMPOSE ps
    echo "✓ Up. Visit https://babypulmo.com"
    ;;

  update)
    require_env_file
    echo "→ Pulling latest code..."
    git -C .. pull --ff-only
    echo "→ Rebuilding images..."
    if $COMPOSE ps --services --filter "status=running" | grep -q classifier; then
      $COMPOSE --profile phase2 build
      $COMPOSE --profile phase2 up -d
    else
      $COMPOSE build web
      $COMPOSE up -d web caddy
    fi
    echo "✓ Updated."
    $COMPOSE ps
    ;;

  logs)
    $COMPOSE logs -f --tail=200
    ;;

  status)
    $COMPOSE ps
    echo ""
    echo "→ Health checks:"
    docker inspect --format='{{.Name}}: {{.State.Health.Status}}' \
      $($COMPOSE ps -q) 2>/dev/null || true
    ;;

  down)
    $COMPOSE --profile phase2 down
    echo "✓ All services stopped."
    ;;

  reload-clinical)
    # Refresh STOCK_BANGLA_JSON + SEVERITY_RULES_JSON from BabyPulmo/clinical-content
    require_env_file
    CC_DIR="${HOME}/clinical-content"
    if [ ! -d "$CC_DIR" ]; then
      git clone git@github.com:BabyPulmo/clinical-content.git "$CC_DIR"
    else
      git -C "$CC_DIR" pull --ff-only
    fi
    STOCK_BANGLA=$(jq -c . "$CC_DIR/stock-bangla.json")
    SEVERITY_RULES=$(jq -c . "$CC_DIR/severity-rules.json")
    # Replace lines in .env.production
    sed -i.bak \
      -e "s|^STOCK_BANGLA_JSON=.*|STOCK_BANGLA_JSON=${STOCK_BANGLA}|" \
      -e "s|^SEVERITY_RULES_JSON=.*|SEVERITY_RULES_JSON=${SEVERITY_RULES}|" \
      .env.production
    rm -f .env.production.bak
    $COMPOSE up -d web
    echo "✓ Clinical content reloaded; web restarted."
    ;;

  *)
    cat <<USAGE
Baby Pulmo deploy script

  ./deploy.sh up                  Bring up web + caddy (Phase 1)
  ./deploy.sh up phase2           Bring up web + caddy + classifier (Phase 2)
  ./deploy.sh update              git pull + rebuild + restart
  ./deploy.sh logs                Tail all service logs
  ./deploy.sh status              ps + health
  ./deploy.sh down                Stop everything
  ./deploy.sh reload-clinical     Pull clinical-content repo, refresh env vars, restart web
USAGE
    ;;
esac
