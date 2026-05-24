# Baby Pulmo — GitHub self-hosted runner setup

> Same pattern as your existing 5 Fintant runners on `vmi2956989`.
> Time budget: ~10 minutes once GitHub gives you the registration token.

---

## 0. Why self-hosted (not GitHub-hosted)

- **Push → auto-deploy** without SSH-from-GitHub-Actions credentials in the repo secrets.
- **Lives on the same VPS** as the app, so `docker compose` commands target the running stack directly.
- **No outbound deploy step** — the runner pulls from GitHub when a job is queued; deploy stays inside the host.
- **Zero recurring cost** (vs paid GitHub-hosted minutes on private repos).

`BabyPulmo/babypulmo` is **public**, so GitHub-hosted minutes are technically free, but the path-of-least-resistance for matching your existing Fintant setup is another self-hosted runner.

---

## 1. Register the runner with GitHub

1. Open https://github.com/BabyPulmo/babypulmo/settings/actions/runners
2. Click **New self-hosted runner** → **Linux** → **x64**
3. GitHub shows a registration token (`AAAA…`). Keep this tab open — you'll paste two commands.

---

## 2. Install on the VPS

SSH into the VPS:

```bash
ssh fintant-vps
mkdir -p ~/runners/babypulmo && cd ~/runners/babypulmo
```

Download + extract the runner (paste the version GitHub shows; this command is generic):

```bash
# Latest at time of writing — bump if GitHub shows a newer version
RUNNER_VERSION="2.323.0"
curl -o actions-runner-linux-x64.tar.gz -L \
  https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz
tar xzf actions-runner-linux-x64.tar.gz
rm actions-runner-linux-x64.tar.gz
```

Configure (paste the **token** from the GitHub UI; replace `YOUR_TOKEN_HERE`):

```bash
./config.sh \
  --url https://github.com/BabyPulmo/babypulmo \
  --token YOUR_TOKEN_HERE \
  --name babypulmo-main \
  --labels babypulmo,production \
  --work _work \
  --runasservice
```

When it asks "Enter name of work folder" — accept the default (`_work`).
When it asks "Enter user account to use for the service" — accept the default (your current user, `ferdous`).

---

## 3. Install + start as systemd service

```bash
sudo ./svc.sh install ferdous
sudo ./svc.sh start
sudo ./svc.sh status
```

Expected output: `actions.runner.BabyPulmo-babypulmo.babypulmo-main.service - GitHub Actions Runner (BabyPulmo-babypulmo.babypulmo-main)` — `active (running)`.

Verify it shows up on GitHub:
https://github.com/BabyPulmo/babypulmo/settings/actions/runners — should list `babypulmo-main` as **Idle**.

---

## 4. Trigger the first deploy

Three ways the workflow can fire:

**A. Auto on push to main** (the default — every commit Ferdous, Faiyad, Shanta, Abdullah push triggers a deploy):
```bash
# From anywhere — push a commit to main:
git push origin main
```
→ Actions tab shows "Deploy to VPS" running.

**B. Manual trigger from the GitHub UI**:
1. https://github.com/BabyPulmo/babypulmo/actions/workflows/deploy.yml
2. Click "Run workflow" → pick branch + mode (`update` / `up` / `up-phase2` / `reload-clinical`) → Run.

**C. Manual via gh CLI**:
```bash
gh workflow run deploy.yml -f mode=update
gh workflow run deploy.yml -f mode=reload-clinical    # after a clinical-content commit
```

---

## 5. Workflow modes (reference)

The `mode` input selects which `deploy.sh` subcommand to run:

| Mode | What it does | When to use |
|---|---|---|
| `update` (default) | `git pull` + rebuild web image + restart web | Every code commit (auto) |
| `up` | First-time bring-up of web only | Day 2 only |
| `up-phase2` | Bring up web + classifier together | After Wav2Vec2 ONNX is uploaded |
| `reload-clinical` | Pull `BabyPulmo/clinical-content` repo + refresh env vars + restart web | After Dr. Saadi edits a Bangla script |

Auto deploys (push events) always use `update`.

---

## 6. What gets skipped by auto-deploy

The workflow's `paths-ignore` skips deploys when only these change:
- `**.md` files (READMEs, plans, docs)
- `submission/**` (form drafts)
- `docs/**`
- `.gitignore`, `LICENSE`

Reasoning: those changes can't affect runtime, so rebuilding the Docker image is waste. Use manual `gh workflow run` if you want to force a deploy after a markdown-only change.

---

## 7. Failure modes + recovery

| Symptom | Cause | Fix |
|---|---|---|
| Workflow run hangs at "Waiting for runner" | Runner is offline or labels don't match | `sudo systemctl status actions.runner.BabyPulmo-babypulmo.babypulmo-main` |
| Workflow fails at `git reset --hard origin/main` | Local uncommitted changes in `/opt/babypulmo` | SSH in: `cd /opt/babypulmo && git status` — stash or discard |
| Workflow fails at `docker compose build` | Cache corruption | SSH in: `docker system prune -af` then re-trigger |
| Healthcheck step times out | Web container crash on new image | `docker compose logs web --tail 100` |
| Concurrency lock holds | A previous deploy is still running | Wait, or cancel in Actions tab |
| Runner registration token expired | Tokens expire in ~1 hour | Regenerate at GitHub Settings → Actions → Runners |

---

## 8. Removing the runner (only if you ever need to)

```bash
cd ~/runners/babypulmo
sudo ./svc.sh stop
sudo ./svc.sh uninstall
./config.sh remove --token YOUR_REMOVAL_TOKEN_FROM_GH
cd ~ && rm -rf runners/babypulmo
```

---

## 9. Security notes

- The runner has full access to the `ferdous` user's environment (including docker group). **Anyone with write access to `BabyPulmo/babypulmo` can execute arbitrary commands on this VPS via a malicious workflow.** Keep collaborator list tight.
- Public repos with self-hosted runners are higher-risk than private. Mitigations:
  - Don't add untrusted contributors with write access.
  - Set "Require approval for first-time contributors" in repo Actions settings.
- Branch protection on `main` prevents random force-pushes from auto-deploying junk:
  ```bash
  gh api -X PUT repos/BabyPulmo/babypulmo/branches/main/protection \
    --input - <<EOF
  {
    "required_status_checks": null,
    "enforce_admins": false,
    "required_pull_request_reviews": null,
    "restrictions": null,
    "allow_force_pushes": false,
    "allow_deletions": false
  }
  EOF
  ```
