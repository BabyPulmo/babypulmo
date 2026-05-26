#!/usr/bin/env bash
# Baby Pulmo — one-shot VPS deploy / update script.
# Usage on VPS:
#   cd /opt/babypulmo/deploy
#   ./deploy.sh up                # first-time bring-up (web only)
#   ./deploy.sh up phase2         # bring up classifier too (after model uploaded)
#   ./deploy.sh update            # pull latest code + rebuild + restart
#   ./deploy.sh logs              # tail all logs
#   ./deploy.sh status            # ps + health
#   ./deploy.sh down              # stop everything
#   ./deploy.sh reload-clinical   # refresh clinical-content env vars + restart web
#   ./deploy.sh sync-nginx        # symlink nginx-host/babypulmo.com.conf → sites-enabled + reload
#
# Host requirements (installed once, NOT managed by this script):
#   - Docker engine + docker compose plugin
#   - nginx (host-side reverse proxy + SSL via certbot)
#   - certbot + python3-certbot-nginx (for Let's Encrypt)
# See DEPLOY-VPS.md for the one-time install steps.

set -euo pipefail

cd "$(dirname "$0")"

CMD="${1:-help}"
PROFILE="${2:-}"

COMPOSE="docker compose"

# Deployed commit SHA, baked into the web image as a build ARG and surfaced by
# /api/health. Resolves to the checked-out commit (GitHub Actions resets to it
# before invoking this script); falls back to "unknown" outside a git checkout.
export GIT_COMMIT_SHA="$(git -C .. rev-parse --short HEAD 2>/dev/null || echo unknown)"

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
      $COMPOSE up -d --build web
    fi
    echo "→ Waiting for health checks..."
    sleep 10
    $COMPOSE ps
    echo ""
    echo "✓ Up. Web is on 127.0.0.1:3000."
    echo "  Make sure host nginx is proxying babypulmo.com → 127.0.0.1:3000."
    echo "  Run: ./deploy.sh sync-nginx (first time only)"
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
      $COMPOSE up -d web
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
    echo ""
    echo "→ Host nginx site:"
    if [ -L /etc/nginx/sites-enabled/babypulmo.com ]; then
      echo "  enabled ✓"
    else
      echo "  NOT enabled — run ./deploy.sh sync-nginx"
    fi
    echo ""
    echo "→ External:"
    curl -sf -o /dev/null -w "  https://babypulmo.com → HTTP %{http_code} (%{time_total}s)\n" https://babypulmo.com || \
      echo "  babypulmo.com unreachable (DNS not propagated or nginx down)"
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

  sync-nginx)
    # Install the nginx site config from this repo to the host system.
    # Idempotent — safe to re-run after a `git pull` that changes the site config.
    if [ ! -f "nginx-host/babypulmo.com.conf" ]; then
      echo "✗ nginx-host/babypulmo.com.conf not found"
      exit 1
    fi
    sudo cp -f nginx-host/babypulmo.com.conf /etc/nginx/sites-available/babypulmo.com
    sudo ln -sf /etc/nginx/sites-available/babypulmo.com /etc/nginx/sites-enabled/babypulmo.com
    # Remove the default catch-all if present (first time only)
    if [ -L /etc/nginx/sites-enabled/default ]; then
      echo "→ Disabling /etc/nginx/sites-enabled/default"
      sudo rm /etc/nginx/sites-enabled/default
    fi
    sudo nginx -t
    sudo systemctl reload nginx
    echo "✓ nginx site installed + reloaded."
    echo ""
    echo "Next: run certbot once after DNS resolves:"
    echo "  sudo certbot --nginx -d babypulmo.com -d www.babypulmo.com --agree-tos -m klikk.ai.new@gmail.com --no-eff-email"
    ;;

  *)
    cat <<USAGE
Baby Pulmo deploy script

  ./deploy.sh up                  Bring up web (Phase 1)
  ./deploy.sh up phase2           Bring up web + classifier (Phase 2)
  ./deploy.sh update              git pull + rebuild + restart
  ./deploy.sh logs                Tail all service logs
  ./deploy.sh status              ps + health + nginx site + external reachability
  ./deploy.sh down                Stop everything
  ./deploy.sh reload-clinical     Pull clinical-content repo, refresh env vars, restart web
  ./deploy.sh sync-nginx          Install nginx-host/babypulmo.com.conf → /etc/nginx + reload
USAGE
    ;;
esac
