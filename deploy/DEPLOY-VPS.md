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

## 1. Clone repo on VPS (~5 min)

```bash
# Create app directory
sudo mkdir -p /opt/babypulmo && sudo chown $USER:$USER /opt/babypulmo
cd /opt/babypulmo

# Clone main repo
git clone https://github.com/BabyPulmo/babypulmo.git .
```

**Do not create `.env.production` on the VPS.** It's regenerated automatically on every deploy. See "Environment variables" below.

---

## Environment variables — GitHub Secrets = source of truth

The previous flow ("copy `.env.production.example` to `.env.production`, fill values, never commit") is **deprecated**. Current flow:

| Environment | Source of truth | File |
|---|---|---|
| **Local dev** | Your machine | `.env.local` at repo root (gitignored) |
| **Production VPS** | GitHub Secrets on `BabyPulmo/babypulmo` | `/opt/babypulmo/deploy/.env.production` — regenerated every deploy |

Every push to `main` triggers `.github/workflows/deploy.yml` which:
1. SSHes into the VPS as `${{ secrets.VPS_USER }}@${{ secrets.VPS_HOST }}` using `${{ secrets.VPS_SSH_KEY }}`.
2. `git fetch && git reset --hard origin/main` in `/opt/babypulmo`.
3. Writes `/opt/babypulmo/deploy/.env.production` from injected GitHub Secrets via heredoc.
4. Runs `./deploy.sh update`.

**Never edit `/opt/babypulmo/deploy/.env.production` on the VPS** — the next deploy wipes it.

### Required GH Secrets — SSH access (3)

- `VPS_HOST` — e.g. `vps.babypulmo.com` (or the IP).
- `VPS_USER` — deploy user, e.g. `deploy`.
- `VPS_SSH_KEY` — full PEM-encoded private key. Public key half goes in `~deploy/.ssh/authorized_keys` on the VPS.
- *(Optional)* `VPS_PORT` — defaults to 22 if unset.

### Required GH Secrets — app env vars

| Secret | Where to get |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL` | Supabase dashboard → Project Settings → API |
| `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_GRAPH_VERSION` | Meta for Developers → WhatsApp → API Setup |
| `GCP_TTS_API_KEY`, `GCP_TTS_VOICE`, `TTS_CACHE_BUCKET` | Google Cloud Console → APIs → Credentials |
| `CLASSIFIER_ENDPOINT`, `CLASSIFIER_API_KEY` | Modal endpoint URL + key |
| `OPENAI_API_KEY` | platform.openai.com → API Keys |
| `ANTHROPIC_API_KEY` | console.anthropic.com → API Keys (build-time IMCI ingest only) |
| `STOCK_BANGLA_JSON`, `SEVERITY_RULES_JSON` | From private `BabyPulmo/clinical-content` repo — single-line JSON via `jq -c .` |
| `CXR_ENDPOINT`, `CXR_API_KEY` *(Phase 3)* | Modal CXR endpoint |
| `WHISPER_ENDPOINT`, `WHISPER_API_KEY` *(Phase 3)* | Modal Whisper endpoint |
| `COHERE_API_KEY` *(Phase 2)* | dashboard.cohere.com → API Keys |
| `AUDIT_PARQUET_BUCKET` | Supabase Storage bucket name (defaults to `lakehouse`) |

### Bulk-load from local `.env.local`

```bash
# Mask the file from any commit first — .env.local is in .gitignore but verify
git -C ~/path/to/babypulmo check-ignore .env.local || echo "⚠ NOT gitignored!"

# Then bulk-load:
gh secret set --repo BabyPulmo/babypulmo --env-file .env.local
```

`gh` skips empty values and obeys `# comments` in the file.

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
curl -sf http://127.0.0.1:3010/ | head -5          # should return HTML (landing)
curl -sf http://127.0.0.1:3010/api/health | jq     # health JSON (once Faiyad's PR lands)
```

The web container is bound to `127.0.0.1:3010` — **not** publicly exposed. Only host nginx can reach it.

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

## 7. Subsequent deploys — auto via GitHub Actions (SSH-based)

**Every push to `main` auto-deploys.** No self-hosted runner needed — workflow runs on `ubuntu-latest`, SSHes into the VPS via `appleboy/ssh-action`, regenerates `.env.production` from GitHub Secrets, then runs `./deploy.sh update`. Workflow at `.github/workflows/deploy.yml`. (`RUNNER-SETUP.md` is deprecated as of 2026-05-30 — kept for historical reference only.)

For manual triggers:
```bash
gh workflow run "Deploy to VPS" -R BabyPulmo/babypulmo -f mode=update
gh workflow run "Deploy to VPS" -R BabyPulmo/babypulmo -f mode=reload-clinical
gh workflow run "Deploy to VPS" -R BabyPulmo/babypulmo -f mode=up-phase2
```

The legacy direct-SSH path still works as a manual fallback if Actions are down:



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
