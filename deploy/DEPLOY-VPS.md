# Baby Pulmo — VPS + Docker Deploy Runbook

> **Owner:** Ferdous. All VPS operations are Ferdous-only per WIN-PLAN.md deployment policy.
> **Goal:** babypulmo.com live with HTTPS + landing + `/docs` + `/chw` reachable by 2026-05-28.
> **Stack:** Docker (web + classifier) inside; host nginx reverse-proxies with Let's Encrypt via certbot. No Caddy.
> **Time budget:** ~90 minutes first-time bring-up; ~5 minutes for each subsequent deploy.

---

## 0. VPS prerequisites — already installed

Per Ferdous's setup, the VPS already has:

- ✅ Ubuntu (24.04 LTS or 22.04 LTS)
- ✅ Docker engine + docker compose plugin
- ✅ nginx (host-side reverse proxy)

This runbook **does not** re-install any of those. It assumes you can run `docker compose version` and `nginx -v` without errors. If certbot is not yet installed, install it once:

```bash
sudo apt update
sudo apt install -y certbot python3-certbot-nginx jq git
```

---

## 1. Clone repo + create env file (~10 min)

```bash
# Create app directory
sudo mkdir -p /opt/babypulmo && sudo chown $USER:$USER /opt/babypulmo
cd /opt/babypulmo

# Clone main repo
git clone https://github.com/BabyPulmo/babypulmo.git .

# Clone the private clinical-content repo (needs your SSH key on this VPS
# and that key registered to your GitHub account)
git clone git@github.com:BabyPulmo/clinical-content.git ~/clinical-content

# Copy env template
cd /opt/babypulmo/deploy
cp .env.production.example .env.production

# Fill values — see "Env vars cheatsheet" below
nano .env.production

# Inject clinical JSON as single-line env strings
STOCK_BANGLA_JSON=$(jq -c . ~/clinical-content/stock-bangla.json)
SEVERITY_RULES_JSON=$(jq -c . ~/clinical-content/severity-rules.json)

sed -i \
  -e "s|^STOCK_BANGLA_JSON=.*|STOCK_BANGLA_JSON=${STOCK_BANGLA_JSON}|" \
  -e "s|^SEVERITY_RULES_JSON=.*|SEVERITY_RULES_JSON=${SEVERITY_RULES_JSON}|" \
  .env.production
```

### Env vars cheatsheet — where to get each

| Var | Where to get |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `*_ANON_KEY`, `SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API |
| `META_WHATSAPP_*` | Meta for Developers → WhatsApp → API Setup (sandbox tokens for Phase 1) |
| `GCP_TTS_API_KEY` | Google Cloud Console → APIs → Credentials → Create API key (restrict to Text-to-Speech API) |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (only used during Phase 2 IMCI ingest, not runtime) |
| `STOCK_BANGLA_JSON`, `SEVERITY_RULES_JSON` | From private `clinical-content` repo (script above) |
| `CLASSIFIER_ENDPOINT` | Leave empty for Phase 1 (web's mock fallback active) |

---

## 2. Bring up Docker services — Phase 1 (~5 min)

```bash
cd /opt/babypulmo/deploy
chmod +x deploy.sh
./deploy.sh up                # web only (classifier comes online in Phase 2)
```

Verify the container is healthy and reachable on loopback:

```bash
docker compose ps                                  # web should be "healthy"
curl -sf http://127.0.0.1:3000/ | head -5          # should return HTML (landing)
curl -sf http://127.0.0.1:3000/api/health | jq     # health JSON (once Faiyad's PR lands)
```

The web container is bound to `127.0.0.1:3000` — **not** publicly exposed. Only host nginx can reach it.

---

## 3. Install nginx site config (~2 min)

```bash
cd /opt/babypulmo/deploy
./deploy.sh sync-nginx
```

This script:
1. Copies `nginx-host/babypulmo.com.conf` → `/etc/nginx/sites-available/babypulmo.com`
2. Symlinks it into `/etc/nginx/sites-enabled/`
3. Removes the default catch-all `/etc/nginx/sites-enabled/default` if present
4. Runs `sudo nginx -t` (syntax check) then `sudo systemctl reload nginx`

At this point: **http://babypulmo.com works** (once DNS resolves). HTTPS comes next.

---

## 4. Point DNS (~5 min + propagation wait)

In your domain registrar:

| Record | Type | Value |
|---|---|---|
| `@` (apex) | A | `<VPS_IP_ADDRESS>` |
| `www` | A | `<VPS_IP_ADDRESS>` |

Verify:
```bash
dig babypulmo.com +short              # → VPS IP
dig www.babypulmo.com +short          # → VPS IP
```

Wait 5–60 minutes for global propagation. Some registrars are nearly instant; some take an hour. The certbot run in the next step requires both records to resolve.

---

## 5. Get SSL via certbot (~3 min, once DNS is live)

```bash
sudo certbot --nginx \
  -d babypulmo.com -d www.babypulmo.com \
  --agree-tos -m klikk.ai.new@gmail.com --no-eff-email \
  --redirect
```

certbot will:
1. Use the nginx plugin to detect your existing `babypulmo.com` server block
2. Solve the HTTP-01 challenge via the running nginx
3. Obtain certs from Let's Encrypt
4. **Rewrite `/etc/nginx/sites-available/babypulmo.com` in place** — adds the `listen 443 ssl` server block + redirects HTTP → HTTPS
5. Install a `certbot.timer` systemd unit for auto-renewal (verify with `systemctl list-timers | grep certbot`)

⚠️ After certbot edits the file, the live nginx config diverges from `nginx-host/babypulmo.com.conf` in this repo. If you re-run `./deploy.sh sync-nginx` later, you will **overwrite the SSL config**. To re-apply SSL after a sync, just re-run the `certbot --nginx` command — it's idempotent and fast.

For permanent sync without losing SSL: pull the live cert paths back into the repo template after first issuance.

---

## 6. Smoke test (~5 min)

From your laptop:

```bash
# Cert + HTTPS
curl -I https://babypulmo.com
# Expected: HTTP/2 200, valid cert (no -k flag needed)

# HTTP → HTTPS redirect
curl -I http://babypulmo.com
# Expected: HTTP/1.1 301 Moved Permanently, Location: https://babypulmo.com/

# Pages
curl -s https://babypulmo.com | grep -c "Baby Pulmo"    # > 0
curl -I https://babypulmo.com/docs                       # 200 (once Shanta's PR lands)
curl -I https://babypulmo.com/chw                        # 200

# Health endpoint (once Faiyad's PR lands)
curl -s https://babypulmo.com/api/health | jq
# Expected: { "db": "ok", "classifier": "mock", "tts": "ok" }
```

Open https://babypulmo.com in a browser. Verify SSL padlock + landing renders + Bangla strings render correctly (font + encoding).

---

## 7. Subsequent deploys (when teammates push code)

```bash
cd /opt/babypulmo/deploy
./deploy.sh update            # git pull + rebuild + restart with minimal downtime
./deploy.sh status            # confirm healthy + external reachability
```

When clinical-content changes (Dr. Saadi script edits):

```bash
./deploy.sh reload-clinical   # auto-pulls clinical-content, updates env, restarts web
```

When the nginx site config changes (e.g., a teammate edits `nginx-host/babypulmo.com.conf`):

```bash
./deploy.sh sync-nginx
# Then re-run certbot to re-apply SSL config:
sudo certbot --nginx -d babypulmo.com -d www.babypulmo.com
```

---

## 8. Phase 2 add-ons (May 31 onward)

### Receive trained model from Faiyad

```bash
# Faiyad runs this from his machine:
scp babypulmo_wav2vec2_int8.onnx <ferdous>@<VPS_IP>:/tmp/

# Then on the VPS:
sudo mkdir -p /var/babypulmo/models
sudo chown -R $USER:$USER /var/babypulmo
mv /tmp/babypulmo_wav2vec2_int8.onnx /var/babypulmo/models/
```

### Bring up classifier container

```bash
cd /opt/babypulmo/deploy
echo "CLASSIFIER_MODELS_DIR=/var/babypulmo/models" >> .env.production
echo "CLASSIFIER_ENDPOINT=http://classifier:8000/predict" >> .env.production
./deploy.sh up phase2        # now starts web + classifier
```

### Verify classifier wired

```bash
# Direct test (classifier is on docker internal network only)
docker compose exec web wget -qO- http://classifier:8000/health
# Expected: {"status":"ok","model_loaded":true}

# E2E via webhook (send a real WhatsApp voice note to your sandbox number)
docker compose logs web --tail 100 | grep classifier
```

---

## 9. Monitoring + ops

```bash
./deploy.sh status            # health + ps + nginx site + external reach
./deploy.sh logs              # tail all (Ctrl-C to exit)
docker stats                   # resource use
df -h                          # disk
free -h                        # memory
sudo tail -f /var/log/nginx/babypulmo.access.log    # request log
sudo tail -f /var/log/nginx/babypulmo.error.log     # error log
```

Disk cleanup if needed:
```bash
docker system prune -af --volumes
```

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| certbot fails: "Challenge failed" | DNS not propagated | `dig babypulmo.com +short` should return VPS IP; wait, retry |
| certbot fails: "port 80 unreachable" | nginx down OR another service on :80 | `sudo systemctl status nginx`; `sudo ss -lntp \| grep ':80'` |
| nginx 502 Bad Gateway | `web` container crashed | `./deploy.sh status` → look for unhealthy → `docker compose logs web --tail 50` |
| `web` healthcheck failing | Bad env var (missing Supabase URL etc.) | `docker compose logs web --tail 50` → look for `TypeError`; fix `.env.production`; restart |
| Audio webhook hangs | Meta WA token expired (sandbox = 24hr) | Refresh in Meta dashboard; restart web |
| Bangla TTS returns 403 | GCP TTS API not enabled or wrong key | Cloud Console → APIs → Enable Text-to-Speech API |
| `./deploy.sh sync-nginx` breaks SSL | sync-nginx overwrote the certbot-rewritten config | Re-run `sudo certbot --nginx -d babypulmo.com -d www.babypulmo.com` |
| classifier container OOM-killed | 2GB RAM insufficient for Phase 2 | Upgrade VPS RAM OR keep Phase 1 mock |
| 413 Request Entity Too Large | Voice note > 25MB | Bump `client_max_body_size 25m` in nginx-host config; sync-nginx |

---

## 11. Finals-day pre-flight (2026-06-12, 8:00 AM)

```bash
# 1. Health
./deploy.sh status
curl -sf https://babypulmo.com/api/health | jq

# 2. End-to-end with a fresh WhatsApp voice note from your phone
#    Verify Bangla reply in ≤15s + alert lands on /chw

# 3. /chw dashboard fresh
curl -sf https://babypulmo.com/chw | head -20

# 4. Disk + memory headroom
df -h | grep -E "/$"     # want > 20% free
free -h                   # want > 200MB free

# 5. Cert expiry — should be > 60 days for safety
sudo certbot certificates | grep -E "babypulmo|Expiry"

# 6. Take a VPS snapshot now (DigitalOcean dashboard, one click) so a finals
#    bug can be rolled back instantly
```

---

## 12. Cost summary

| Item | $/mo |
|---|---|
| VPS (already provisioned by Ferdous) | (paid) |
| Supabase free tier | $0 |
| Meta WhatsApp Cloud API | $0 (first 1000 conv/mo free) |
| Google Cloud TTS | ~$0.50 with cache (mostly free trial) |
| Let's Encrypt cert | $0 |
| **OpenAI (one-time IMCI embed)** | **~$5 once** |
| Domain (babypulmo.com) | already paid |

Well within the $0–$50 Phase 1 budget.
