# Baby Pulmo — VPS + Docker Deploy Runbook

> **Owner:** Ferdous. All VPS operations are Ferdous-only per WIN-PLAN.md deployment policy.
> **Goal:** babypulmo.com live with HTTPS + landing + `/docs` + `/chw` reachable by 2026-05-28.
> **Time budget:** ~2 hours first-time provisioning; ~10 minutes for each subsequent deploy.

---

## 1. Pick a VPS provider

| Option | Cost | RAM | Region | Recommendation |
|---|---|---|---|---|
| **DigitalOcean — Singapore SGP1** | $6/mo (`s-1vcpu-2gb`) or $12/mo (`s-2vcpu-2gb`) | 2GB | Singapore | **Recommended for BD latency.** Use $12 tier for Phase 2 classifier (needs 2 vCPU). |
| Hetzner CX22 — Helsinki | €4.50/mo | 4GB | EU | Cheaper + more RAM, but ~250ms RTT to BD vs ~50ms from SGP. |
| Vultr — Singapore | $6/mo | 1GB | Singapore | Avoid: 1GB is tight for Phase 2 classifier. |

**Decision:** DigitalOcean `s-2vcpu-2gb` Singapore. $12/mo. Promo codes commonly available ($200 credit for 60 days for new accounts).

Provision: Ubuntu 24.04 LTS, IPv4 enabled, SSH-key auth.

---

## 2. First-time VPS setup (~30 min)

```bash
# From your laptop
ssh root@VPS_IP_ADDRESS

# Update + create non-root user
apt update && apt upgrade -y
adduser babypulmo
usermod -aG sudo babypulmo
rsync --archive --chown=babypulmo:babypulmo ~/.ssh /home/babypulmo
su - babypulmo

# Install Docker + Compose plugin (official Docker repo, not Ubuntu's outdated one)
sudo apt install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin git jq
sudo usermod -aG docker babypulmo
newgrp docker  # or log out and back in

# Verify
docker --version           # → Docker version 27.x
docker compose version     # → Docker Compose version v2.x

# Firewall
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp     # HTTP/3 (QUIC)
sudo ufw enable
```

---

## 3. Clone repo + fill env vars (~15 min)

```bash
# Clone
sudo mkdir -p /opt/babypulmo && sudo chown babypulmo:babypulmo /opt/babypulmo
cd /opt/babypulmo
git clone https://github.com/BabyPulmo/babypulmo.git .

# Clone the private clinical-content repo to a separate location
# Requires SSH key on this VPS to be added to your GitHub account
cd ~ && git clone git@github.com:BabyPulmo/clinical-content.git
cd /opt/babypulmo/deploy

# Copy env template + fill values
cp .env.production.example .env.production
nano .env.production     # fill all values; see "Env vars cheatsheet" below

# Convert clinical JSON files into env-friendly single-line strings
STOCK_BANGLA_JSON=$(jq -c . ~/clinical-content/stock-bangla.json)
SEVERITY_RULES_JSON=$(jq -c . ~/clinical-content/severity-rules.json)

# Replace placeholders in .env.production
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
| `STOCK_BANGLA_JSON`, `SEVERITY_RULES_JSON` | From private `clinical-content` repo (see above) |
| `CLASSIFIER_ENDPOINT` | Leave empty for Phase 1 (mock fallback active) |

---

## 4. First deploy — Phase 1 (~10 min)

```bash
cd /opt/babypulmo/deploy
chmod +x deploy.sh
./deploy.sh up                # brings up web + caddy only (no classifier yet)

# Watch logs
./deploy.sh logs              # Ctrl-C to detach
```

Expect:
- `babypulmo-web`: "Listening on 0.0.0.0:3000"
- `babypulmo-caddy`: ACME cert issuance for babypulmo.com (will fail if DNS not pointed yet — that's fine, do step 5 then restart caddy)

---

## 5. Point DNS (~5 min + propagation wait)

In your domain registrar (where babypulmo.com is registered):

| Record | Type | Value |
|---|---|---|
| `@` (apex) | A | `<VPS_IP_ADDRESS>` |
| `www` | A | `<VPS_IP_ADDRESS>` |

Wait 5–60 minutes for DNS propagation. Verify:
```bash
dig babypulmo.com +short              # should return your VPS IP
dig www.babypulmo.com +short
```

Once DNS resolves, restart Caddy so it can complete the Let's Encrypt cert exchange:
```bash
cd /opt/babypulmo/deploy
docker compose restart caddy
docker compose logs caddy --tail 50    # look for "certificate obtained"
```

---

## 6. Smoke test (~5 min)

From your laptop:
```bash
# Cert + HTTPS
curl -I https://babypulmo.com
# → HTTP/2 200 + valid cert

# Pages
curl -s https://babypulmo.com | grep -c "Baby Pulmo"    # → >0
curl -I https://babypulmo.com/docs                       # → 200
curl -I https://babypulmo.com/chw                        # → 200

# Health endpoint (Faiyad's Day 4 task — comes online after that PR lands)
curl -s https://babypulmo.com/api/health | jq
# → { "db": "ok", "classifier": "mock", "tts": "ok" }
```

Open in browser: https://babypulmo.com. Verify SSL padlock + landing renders + Bengali strings render correctly (font + encoding).

---

## 7. Subsequent deploys

When Faiyad/Shanta push code:

```bash
cd /opt/babypulmo/deploy
./deploy.sh update           # git pull + rebuild + zero-ish-downtime restart
./deploy.sh status           # confirm healthy
```

When clinical-content changes (Dr. Saadi script edits):

```bash
./deploy.sh reload-clinical  # auto-pulls clinical-content, updates env, restarts web
```

---

## 8. Phase 2 add-ons (May 31 onward)

### Receive trained model from Faiyad
```bash
# On Faiyad's machine (he runs this):
scp babypulmo_wav2vec2_int8.onnx babypulmo@<VPS_IP>:/var/babypulmo/models/

# OR via signed cloud URL → wget:
sudo mkdir -p /var/babypulmo/models
sudo chown -R babypulmo:babypulmo /var/babypulmo
wget -O /var/babypulmo/models/babypulmo_wav2vec2_int8.onnx "<signed-url-from-Faiyad>"
```

### Bring up classifier container
```bash
cd /opt/babypulmo/deploy
echo "CLASSIFIER_MODELS_DIR=/var/babypulmo/models" >> .env.production
echo "CLASSIFIER_ENDPOINT=http://classifier:8000/predict" >> .env.production
./deploy.sh up phase2        # now starts web + caddy + classifier
```

### Verify classifier wired
```bash
# Direct test
docker compose exec web wget -qO- http://classifier:8000/health
# → {"status":"ok","model_loaded":true}

# E2E via webhook (send a real WhatsApp voice note to your sandbox number)
docker compose logs web --tail 100 | grep classifier
```

---

## 9. Monitoring + ops

```bash
./deploy.sh status            # health + ps
./deploy.sh logs              # tail all
docker stats                   # resource use
df -h                          # disk

# Disk cleanup if needed
docker system prune -af --volumes
```

Optional: install `uptime-kuma` as a 4th container for visual uptime tracking.

---

## 10. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Caddy can't get cert | DNS not propagated | Wait 15 min; `dig babypulmo.com` should return VPS IP |
| Caddy can't get cert (still failing after DNS OK) | Port 80 blocked | `sudo ufw status` — must allow 80/tcp |
| `web` healthcheck failing | Bad env var (missing Supabase URL) | `docker compose logs web --tail 50` → look for `TypeError`; re-check `.env.production` |
| 502 Bad Gateway | `web` container crashed | `./deploy.sh status` → restart if needed |
| Audio webhook hangs | `META_WHATSAPP_ACCESS_TOKEN` expired (sandbox tokens are 24hr) | Refresh in Meta dashboard; redeploy |
| Bangla TTS returns 403 | GCP TTS API not enabled | Cloud Console → APIs → Enable Text-to-Speech API |
| classifier container OOM-killed | 2GB RAM insufficient for Phase 2 | Upgrade to `s-2vcpu-4gb` ($24/mo) OR keep mock during finals (declare honestly) |

---

## 11. Finals-day pre-flight (2026-06-12, 8:00 AM)

```bash
# 1. Health
./deploy.sh status
curl -sf https://babypulmo.com/api/health | jq

# 2. End-to-end with a fresh WhatsApp voice note
# Send a cough audio to your WA number from your phone; verify Bangla reply lands in ≤15s.

# 3. /chw dashboard fresh alerts
curl -sf https://babypulmo.com/chw | grep -c "alert"

# 4. Disk + memory headroom
df -h | grep -E "/$"     # >20% free
free -h                   # >200MB free

# 5. Snapshot the VPS in DigitalOcean (one-click backup) so you can roll back instantly if a finals demo bricks it
```

---

## 12. Cost summary

| Item | $/mo |
|---|---|
| DigitalOcean Droplet (2 vCPU / 2 GB) | $12 |
| Supabase (free tier) | $0 |
| Meta WhatsApp Cloud API | $0 (first 1000 conv/mo free) |
| Google Cloud TTS | ~$0.50 with caching (mostly free trial) |
| OpenAI (one-time IMCI embed) | ~$5 one-time |
| Domain (babypulmo.com) | already paid |
| **Total recurring** | **~$13/mo** |

Well within the $0–$50 budget.
