# Baby Pulmo — DNS records for babypulmo.com

> Set these at your domain registrar (where you bought `babypulmo.com`).
> All other apps on this VPS use `*.fintant.ai`, so there is **no conflict** —
> babypulmo.com and www.babypulmo.com are dedicated to this project.

---

## Records to add

Paste these into the registrar's DNS dashboard. TTL = 300 (5 minutes) for the first 24 hours so any typos are recoverable fast; bump to 3600 (1 hour) after the site is stable.

| Host | Type | Value | TTL | Notes |
|---|---|---|---|---|
| `@` | **A** | `86.48.31.193` | 300 | Apex → VPS IPv4. Some registrars use blank or `babypulmo.com` instead of `@`. |
| `www` | **A** | `86.48.31.193` | 300 | `www.babypulmo.com` → same VPS. |
| `@` | **AAAA** | `2605:a142:2295:6989::1` | 300 | Apex → VPS IPv6. Recommended; modern clients prefer it. |
| `www` | **AAAA** | `2605:a142:2295:6989::1` | 300 | `www.babypulmo.com` IPv6. |
| `@` | **CAA** | `0 issue "letsencrypt.org"` | 3600 | **Optional but recommended.** Restricts who can issue certs for this domain — only Let's Encrypt. Prevents accidental MITM via rogue CAs. |
| `@` | **CAA** | `0 iodef "mailto:klikk.ai.new@gmail.com"` | 3600 | **Optional.** Where to email if someone tries to issue an unauthorized cert. |

### What NOT to add (yet)

- **No MX records** unless you plan to receive email at `@babypulmo.com`. Skip for now — the postal `klikk.ai.new@gmail.com` is the contact email.
- **No CNAME for `@`** — apex domains can't be CNAMEs by RFC. Use the A/AAAA above.
- **No TXT records** unless you set up email or Google Search Console verification later.

### If your registrar splits IPv4 / IPv6 dashboards

Cloudflare, Namecheap, GoDaddy: all in one DNS panel. Use the table above as-is.

Bangladesh-based registrars (BTCL, exonhost): may have separate IPv4 / IPv6 panels. Add the A records to the IPv4 panel and AAAA to the IPv6 panel.

### If you don't want IPv6

You can skip the two AAAA records. The A records alone are sufficient — most clients still default to IPv4. But you lose the IPv6-only network paths from some carriers (rural BD mobile networks sometimes prefer IPv6).

---

## Verification (run from your laptop, NOT the VPS)

```bash
# IPv4
dig babypulmo.com +short A                # → 86.48.31.193
dig www.babypulmo.com +short A            # → 86.48.31.193

# IPv6
dig babypulmo.com +short AAAA             # → 2605:a142:2295:6989::1
dig www.babypulmo.com +short AAAA         # → 2605:a142:2295:6989::1

# CAA (if set)
dig babypulmo.com +short CAA

# Reverse confirm
host 86.48.31.193                         # may return a Contabo PTR; cosmetic only
```

DNS typically propagates in 5–60 minutes depending on registrar + TTL. **Test from multiple resolvers if it doesn't propagate quickly:**

```bash
# Cloudflare
dig @1.1.1.1 babypulmo.com +short
# Google
dig @8.8.8.8 babypulmo.com +short
# Quad9
dig @9.9.9.9 babypulmo.com +short
```

If all three return `86.48.31.193`, propagation is complete.

---

## After DNS resolves — get SSL

Once `dig babypulmo.com +short` returns the VPS IP from your laptop, SSH into the VPS and run:

```bash
sudo certbot --nginx \
  -d babypulmo.com -d www.babypulmo.com \
  --agree-tos -m klikk.ai.new@gmail.com --no-eff-email \
  --redirect
```

certbot will obtain certs from Let's Encrypt and rewrite `/etc/nginx/sites-available/babypulmo.com` in-place to add the SSL block + HTTP→HTTPS redirect. Auto-renewal is handled by the existing `certbot.timer` systemd unit (already running for fintant.ai's certs).

Verify after issuance:

```bash
curl -I https://babypulmo.com                              # HTTP/2 200, valid cert
curl -I http://babypulmo.com                               # 301 → https://
sudo certbot certificates | grep -A1 babypulmo.com         # shows expiry > 80 days
```

---

## VPS quick facts (for reference)

| | |
|---|---|
| Provider | Contabo (host `vmi2956989`) |
| OS | Ubuntu 24.04.3 LTS |
| Public IPv4 | `86.48.31.193` |
| Public IPv6 | `2605:a142:2295:6989::1` |
| User | `ferdous` (sudo + docker groups, passwordless sudo) |
| SSH | port `3003` (non-standard; see your `~/.ssh/config` `fintant-vps` alias) |
| Other apps on same VPS | api.fintant.ai, cal.fintant.ai, pgadmin.fintant.ai, test.* mirrors — **do not touch** |
| Web container host port (babypulmo) | `127.0.0.1:3010` (port 3000 is owned by `fintant-backend`) |
