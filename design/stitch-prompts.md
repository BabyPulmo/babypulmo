# Baby Pulmo — Stitch (Google) UI Prompts

> 22 paste-ready prompts for **Stitch by Google** (https://stitch.withgoogle.com) to generate Figma-quality mockups for every Baby Pulmo screen.
>
> **Owner:** Shanta (UI/UX + Presentation Lead).
> **Goal:** Have polished Figma designs for every page by **2026-05-30** so Ferdous can paste live URLs into the BuildFest form.

---

## A. How to use this file

1. Open https://stitch.withgoogle.com (sign in with Google account).
2. Start a new design.
3. **Paste the [Global Brand Context](#b-global-brand-context-paste-this-first-every-time) block first.** Stitch carries it forward through the session — but if you start a new session, paste it again.
4. Then paste any single screen prompt from Section C below.
5. Iterate with follow-up messages: "make the CTA larger," "use the Bangla string verbatim," "tighten the spacing." Stitch supports conversational refinement.
6. When you like a screen, click **Export to Figma**. Save the `.fig` file as `babypulmo-{module}-{slug}.fig` (e.g. `babypulmo-chw-alert-detail.fig`).
7. Drop exported `.fig` files into the team Google Drive `BabyPulmo/design/figma/` OR commit them to `BabyPulmo/docs/figma/` for git-versioned history.
8. Hand each Figma screen to Ferdous + the codebase: each screen → `app/{route}/page.tsx` using existing tailwind `pulmo-*` classes from `tailwind.config.ts`.

**Credit budget:** Stitch free tier ≈ 10 generations/day. If you hit the cap, follow the priority order in [Section D](#d-priority--credit-budget). Must-have screens (★) first.

---

## B. Global Brand Context (paste this first, every time)

```
We are designing UI for Baby Pulmo — an AI-native WhatsApp service that listens
to a child's cough recording and tells a rural Bangladeshi caregiver, in Bangla
audio, whether the child shows signs of pneumonia and needs to see a Community
Health Worker (CHW). Decision-support framing — never claims to diagnose.

BRAND
- Logo word: "Baby Pulmo" (English) + "বেবি পুলমো" (Bangla) — usually side by side.
- Tone: warm + clinical, Bangla-first, urgent-but-calm. Never panicky. Honest
  about limits ("signs of pneumonia", not "has pneumonia").

COLOR PALETTE (only these — do not invent new colors)
- Background:   #fef7ed (cream / pulmo-50)
- Accent:       #f97316 (warm orange / pulmo-500) — for CTAs, badges, links, highlights
- Deep brand:   #7c2d12 (deep brown / pulmo-900) — for headers, strong text
- Body text:    #1e293b (slate-800)
- Subtle text:  #64748b (slate-500)
- Borders:      #e2e8f0 (slate-200)
- Severity scale (left-border + badge):
    Critical → #ef4444 / bg #fee2e2 / text #991b1b (red)
    High     → #f97316 / bg #ffedd5 / text #9a3412 (orange)
    Moderate → #eab308 / bg #fef9c3 / text #854d0e (yellow)
    Low      → #22c55e / bg #dcfce7 / text #166534 (green)

TYPOGRAPHY
- Bangla:  Noto Sans Bengali (400 / 500 / 700). Used for all Bangla strings.
- English: Inter (or system UI sans). 600 weight for headlines, 400 for body.
- Sizes:   h1 text-5xl bold, h2 text-2xl semibold, body text-base, eyebrow text-xs uppercase tracking-wide.

COMPONENT RHYTHM (this is the visual signature — apply across every screen)
- Card:     bg #ffffff, border 1px #e2e8f0, rounded-xl (16px), shadow-sm, padding 24px.
- Severity card: same as Card + 4px left border in severity color + colored badge in top-right.
- Buttons:  rounded-lg, bold, 12px+ vertical padding. Primary = pulmo-500 bg + white text. Secondary = white bg + pulmo-500 border + pulmo-700 text.
- Stat block: large bold number (text-3xl) in pulmo-500, label below in slate-500 text-xs uppercase.
- Lists:    space-y-3 between items, never tightly packed.
- Mobile:   single column, large 48px+ tap targets, generous padding for low-literacy users.

AUDIENCE
- Caregivers: rural Bangladesh, low-literacy, low-bandwidth phones, voice-first.
- CHWs: trained community health workers, mobile-first, in the field.
- Admins / clinicians: desktop, data-dense.
- Judges / investors: read English, expect production-grade polish.

ACCESSIBILITY
- Color contrast WCAG AA minimum (large tap targets, never rely on color alone).
- All severity also has an icon (warning triangle, info circle).
- Bangla and English never overlap typographically — separate lines or columns.
```

---

## C. Screen prompts

Each prompt below assumes the Global Brand Context above is already in the Stitch session.
Numbering: **{module}.{screen}** so you can match exports to filenames.

---

### Module 1 — Public marketing site

#### 1.1 Landing page (`/`) ★ MUST-HAVE

```
Design a modern, responsive landing page for Baby Pulmo. Desktop primary, mobile responsive.

LAYOUT (top → bottom):

1. NAVBAR — pulmo-50 bg, sticky, 72px tall.
   Left:  "Baby Pulmo" wordmark in pulmo-900 + small Bangla "বেবি পুলমো" beside it.
   Right: nav links "How it works", "/docs", "Team", "Contact" in slate-700.
   Far right: orange primary button "Try the demo" → links to WhatsApp.

2. HERO — pulmo-50 bg, ~640px tall.
   Eyebrow text-xs uppercase pulmo-500: "THE INFINITY AI BUILDFEST 2026 · HealthTech"
   h1 text-6xl bold pulmo-900: "Baby Pulmo"
   Subhead Bangla text-2xl pulmo-700: "বেবি পুলমো — listening to your child's breath"
   Body text-lg slate-700: "A Bangla voice-first WhatsApp AI that listens to a child's cough and tells the mother, in her own language, whether her baby has signs of pneumonia. In 10 seconds. For free."
   Two buttons: primary "Try on WhatsApp →" + secondary "How it works ↓".
   Right side: hero illustration — a Bangladeshi mother holding a young child + phone in hand, soft warm light, watercolor-like, no faces visible (privacy). Set against pulmo-50 with subtle pulmo-500 glow.

3. STAT BAND — 3-column grid, pulmo-500 bg, white text.
   Each stat: huge number text-5xl bold, label small text-sm uppercase tracking-wide.
   Stats:
   • 740,000 — children under 5 die from pneumonia globally, every year (WHO)
   • 1 in 8,000 — doctor-to-patient ratio in rural Bangladesh
   • $179M — Pfizer acquired ResApp Health (adult cough-AI) in 2022

4. "HOW IT WORKS" — alternating left/right rows, 5 steps with illustration.
   Step 1: Caregiver records a 30-second cough on WhatsApp.
   Step 2: Wav2Vec2 classifier (CPU, 5 seconds) identifies pneumonia / bronchiolitis / croup / normal.
   Step 3: pgvector RAG pulls matching WHO IMCI protocol.
   Step 4: Deterministic severity rules (not LLM) pick one of 7 clinician-vetted Bangla scripts.
   Step 5: Mother receives Bangla audio reply; severe cases auto-route to nearest CHW.
   Each step: numbered circle in pulmo-500, text-lg headline, short body, small architecture-style icon.

5. "RESPONSIBLE AI" — white bg, 5-card grid of principles, each card with icon + headline + body.
   Principles:
   • Decision-support, not diagnosis
   • Rules-gated severity (no LLM at runtime)
   • Clinician-vetted Bangla scripts (Dr. Al Muktafi Saadi, Pediatrician)
   • Immutable audit log
   • BMRC ethics review path

6. "WHY BANGLA, WHY WHATSAPP" — 2-column text + quote. Slate-700 body. End with a pull quote in pulmo-900 italic: "63% of Bangladeshi children with pneumonia never reach a clinician."

7. FINAL CTA — pulmo-500 bg, white text, centered. h2 "Send a cough. Get an answer."
   Big button "Open WhatsApp" + below "or join the sandbox: +1 415 523 8886, join 'sleep-purple'".

8. FOOTER — pulmo-900 bg, white/pulmo-50 text. Columns:
   - About: tagline + 2026 © Baby Pulmo
   - Product: How it works, /docs, /chw dashboard
   - Legal: Privacy & Ethics
   - GitHub link, contact email klikk.ai.new@gmail.com

Style notes: use pulmo-50 background for the page body, white for cards, pulmo-500 only as accent. Generous spacing between sections (96px). Mobile: stack everything single-column, hero illustration becomes a smaller centered image.
```

---

#### 1.2 `/docs` portal ★ MUST-HAVE

```
Design a public documentation portal at babypulmo.com/docs. Single-page long-scroll layout, desktop primary, mobile responsive. Purpose: give judges, investors, and clinicians one URL where they can audit Baby Pulmo's architecture, accuracy claims, ethics, and team.

LAYOUT:

1. NAVBAR — same as landing page (sticky pulmo-50 bg). Add "/docs" to indicate active page.

2. PAGE HEADER — pulmo-50 bg, 240px tall.
   Eyebrow "Technical & ethical reference"
   h1 "How Baby Pulmo works, and what it can't do"
   Subtitle text-lg slate-700: "Auditable architecture, honest accuracy expectations, clinical governance."

3. STICKY SIDE-NAV — left rail (only on desktop), pulmo-500 text on hover. Sections:
   - Architecture
   - Data sources
   - Accuracy
   - Severity rules
   - Clinical content
   - Audit log
   - Team & advisors
   - Roadmap

4. ARCHITECTURE SECTION — large card with Mermaid-style architecture diagram embedded. 8 layers: WhatsApp → Audio preprocessing → Wav2Vec2 classifier → pgvector RAG → Severity rules → Bangla TTS → CHW dispatch → Audit log. Each layer in a colored box, arrows in pulmo-500.

5. DATA SOURCES — 3-card grid.
   Card 1: Training audio (Coswara IISc + COUGHVID EPFL + ICBHI). Each with sample count, license, citation.
   Card 2: Clinical knowledge (WHO IMCI handbook, Bangladesh DGHS pediatric guidelines). Public domain badge.
   Card 3: Field data (caregiver voice notes, opt-in, BMRC ethics path).

6. ACCURACY SECTION — banner table.
   Title: "What our model actually does — and where it fails honestly."
   Two-column band:
   • Lab pediatric pneumonia sensitivity: 70–78%
   • Field (rural BD, real phones, real noise): 58–68% expected
   Below: "Why 65% is enough for triage — confidence gate + rules-gated severity + human-in-loop." Link to /accuracy detail page.

7. SEVERITY RULES — collapsible table of 7 rows (one per cough class):
   Pneumonia → Critical → Escalate to CHW immediately
   Bronchiolitis → High → Escalate to CHW
   Croup → High → Escalate to CHW
   Pertussis → High → See doctor within 24h
   Asthma → Moderate → See doctor within 24h
   Normal → Low → Observe 24h
   Insufficient quality → Low → Re-record (no escalation)
   Each row: severity badge in correct color + recommended action.

8. CLINICAL CONTENT — card explaining stock Bangla scripts. List 7 (class, severity) pairs with the first 12 Bangla words of each script (truncated, ellipsis). Footer: "Reviewed by Dr. Al Muktafi Saadi, Bangladesh Medical College & Hospital."

9. AUDIT LOG — illustrated panel showing a sample audit row: timestamp, caregiver phone (last 4 digits only), classification, confidence, IMCI chunk IDs, CHW dispatched, model version. "Immutable. Required for BMRC ethics review."

10. TEAM & ADVISORS — 5 photo-cards grid: Ferdous (Lead), Faiyad (Backend, NRB Canada), Shanta (UI + Presentation), Abdullah (Business + Data), Dr. Saadi (Clinical Advisor — pending). Each card: name, role, 1-line bio.

11. ROADMAP — horizontal Gantt-style timeline.
   May 2026: Preliminary submission
   Jun 2026: Finals + first pilot
   Q3 2026: BRAC pilot (5 districts)
   Q4 2026: BMRC ethics submission
   2027: Series A + Madrid trademark + LMIC expansion

12. FOOTER — same as landing.

Style: lots of whitespace, single-column on mobile, pulmo-50 page bg, white cards, pulmo-500 accents on links and stat numbers. Aim for "investor-readable technical doc," not "developer wiki."
```

---

#### 1.3 `/team` — bios page ☆ nice-to-have

```
Design a team bios page at babypulmo.com/team. Desktop primary, mobile responsive. Purpose: BuildFest judges + investors evaluating who built this.

LAYOUT:

1. NAVBAR — sticky pulmo-50, "Team" highlighted.

2. PAGE HEADER — pulmo-50 bg, centered.
   Eyebrow "People"
   h1 "Built in Dhaka, Bangladesh"
   Subtitle slate-700: "4 builders + 1 clinical advisor."

3. CORE TEAM GRID — 4 photo cards, equal size, 2-col on tablet, 4-col on desktop.
   Each card: square photo placeholder (use Bangla initial in pulmo-500 circle if no photo), name (text-xl bold), role (text-sm uppercase pulmo-500), short bio (3 sentences slate-700), country flag badge, role-tag chip (Leader / Backend / UI / Business).

   Names + roles + countries:
   • Engr Md Ferdous Alam — Team Leader / Project Coordinator — 🇧🇩 Bangladesh
     Bio: "AI/ML engineer + deployment lead. Owns infrastructure, deployment, and finals pitch. Building Baby Pulmo solo until this team assembled around the vision."
   • Faiyad Irfan Hares — Backend / Database / Scraper Engineer — 🇨🇦 Canada (NRB)
     Bio: "Bangladeshi-Canadian software engineer specializing in data pipelines and ML deployment. Owns Wav2Vec2 training, WHO IMCI corpus indexing, Meta WhatsApp Cloud API integration."
   • Shanta Khatun — UI/UX / Frontend + Presentation Lead — 🇧🇩 Bangladesh (Female)
     Bio: "Designer and front-end engineer. Owns visual identity, the /docs portal, and the investor-deck storytelling. Believes a 60-year-old mother in Bogura should never need a manual."
   • Abdullah Al Masum — Business Analyst / Data Scientist — 🇧🇩 Bangladesh
     Bio: "Owns the unit economics, pilot partnerships (BRAC, icddr,b, Smiling Sun), and Coswara dataset analysis. Translates clinical impact into pitch-deck numbers."

4. CLINICAL ADVISOR — separate spotlight card (full-width, pulmo-500 left border).
   Photo placeholder + name "Dr. Al Muktafi Saadi, MBBS, PGT (Pediatrics), PGPN (Boston, USA)"
   Title: "Clinical Advisor — Pediatrician"
   Affiliation: "Japan Bangladesh Friendship Hospital, Dhaka"
   Bio: "Reviews every Bangla guidance script that Baby Pulmo speaks to a caregiver. Ensures clinical safety and cultural appropriateness."
   Badge: "(Confirmation pending)" in slate-500 italic if not yet confirmed.

5. ADVISORY ECOSYSTEM — 3-col logo row.
   Placeholder logos: BMRC (ethics review path), BRAC (pilot partner), Anthropic / Claude Code (built with).

6. JOIN US CTA — pulmo-500 bg full-width card.
   "We're hiring after BuildFest. Roles: ML engineer, CHW operations, BD partnerships. → klikk.ai.new@gmail.com"

7. FOOTER — same as landing.

Style: lots of whitespace, photo cards have rounded-2xl + subtle shadow, names in pulmo-900 bold, roles in pulmo-500 uppercase. On mobile: single-column with photo above name.
```

---

#### 1.4 `/privacy-ethics` — policy page ☆ nice-to-have

```
Design a combined privacy + clinical-ethics policy page at babypulmo.com/privacy-ethics. Desktop primary, mobile responsive. Purpose: serious-tone document that judges, BMRC reviewers, and lawyers can cite.

LAYOUT:

1. NAVBAR — sticky, "Privacy & Ethics" highlighted.

2. PAGE HEADER — pulmo-50 bg, centered.
   Eyebrow "Policy"
   h1 "How we treat your child's data — and what we will never do with it."
   Subtitle slate-700: "Last updated: 2026-05-25. Plain language above; formal version below."

3. PLAIN-LANGUAGE SUMMARY — pulmo-500 left-border card.
   Five bullet points, large text-lg slate-800:
   • We only listen to the cough recording you send us. We never turn on your microphone.
   • We never sell your data. Never. To anyone.
   • Your child's audio is stored encrypted on Supabase Storage (Singapore region) and auto-deleted after 90 days unless you ask us to keep it for research (separate opt-in).
   • This is not a doctor. We tell you "signs of pneumonia" — never "your child has pneumonia." A real clinician makes the diagnosis.
   • In an emergency, call 999 (Bangladesh national emergency) immediately.

4. FORMAL POLICY — accordion sections, each collapsed by default:
   • Data we collect (audio, phone number, GPS for CHW routing, opt-in child age/sex)
   • Data we don't collect (browsing history, location outside CHW routing, personal identifiers beyond phone number)
   • Where data lives (Supabase Singapore, GCP TTS, Modal CPU classifier — all listed)
   • Retention (90 days default, 5 years if you opt in to research)
   • Sharing (only with the CHW you're dispatched to, only the audio + classification — never your name)
   • Your rights (request deletion, request export, withdraw consent)
   • Children's data (under-16 data treated as sensitive per Bangladesh DGHS + GDPR-grade rules)

5. CLINICAL ETHICS — separate card with pulmo-900 bg, pulmo-50 text.
   Title: "Why we say 'signs of', not 'diagnosed with'"
   Body: 3-paragraph essay explaining decision-support framing, rules-gated severity (no LLM bias at runtime), human-in-loop on every escalation, BMRC review path. End with: "If we ever break these principles, we want you to call us out."

6. CONTACT — 3-card grid.
   • Data requests → klikk.ai.new@gmail.com
   • Clinical concern → Dr. Al Muktafi Saadi (via klikk.ai.new@gmail.com)
   • Press / partnerships → klikk.ai.new@gmail.com

7. FOOTER — same as landing.

Style: serious, dense, accessible. Use slate-700 for body text. Pulmo-500 only on link underlines. Wide reading column max-w-3xl. On mobile: accordion stays collapsed; user expands as needed.
```

---

#### 1.5 404 + system status ☆ nice-to-have

```
Design a clean 404 page that doubles as a system-status indicator. Desktop + mobile responsive.

LAYOUT:

1. NAVBAR — same as landing.

2. CENTERED HERO — pulmo-50 bg, vertical center, ~520px tall.
   Big illustration: a stethoscope laid on a desk with a dotted line going off-screen (suggesting "we lost the trail"). Watercolor-style, warm.
   Eyebrow text-xs pulmo-500 uppercase: "404"
   h1 text-4xl pulmo-900: "This page doesn't exist."
   Bangla subhead text-xl: "এই পৃষ্ঠাটি পাওয়া যায়নি।"
   Body slate-700: "Maybe a typo, maybe an old link. Try one of these:"

3. NAV LINK GRID — 4 cards.
   • Landing → "Start over"
   • /chw → "CHW Dashboard"
   • /docs → "How it works"
   • /team → "Meet the team"
   Each card: icon + label, hover pulmo-500.

4. SYSTEM STATUS STRIP — bottom of page, slate-100 bg, single row.
   Three pill indicators in a row, each with a colored dot + service name + status:
   • 🟢 Web (Vercel/Docker)
   • 🟢 WhatsApp webhook (Meta Cloud API)
   • 🟢 Classifier (Modal)
   • 🟢 Bangla TTS (GCP)
   "All systems operational." or red if any down.
   Link: "Status history →" → routes to /status (a future page).

5. FOOTER — same as landing.

Style: friendly, not apologetic. Bangla and English equally weighted. The illustration should make a designer smile, not look corporate-bland.
```

---

### Module 2 — CHW web app

#### 2.1 CHW login / OTP ☆ nice-to-have

```
Design a CHW login screen. Mobile-first (CHWs primarily use phones), desktop responsive. Single-step phone OTP login.

LAYOUT (mobile):

1. STATUS BAR — system bar at top (battery, time). Don't draw it; let phone OS handle it.

2. APP HEADER — 80px tall, pulmo-500 bg.
   Centered: "Baby Pulmo" white wordmark + tiny "বেবি পুলমো" below it.

3. WELCOME PANEL — pulmo-50 bg, 24px padding.
   h1 text-2xl pulmo-900 bold: "Welcome, CHW."
   Body slate-700: "Sign in to see alerts in your area."

4. PHONE INPUT CARD — white bg card, rounded-xl, shadow-sm.
   Label "Phone number (Bangladesh)" text-xs uppercase slate-500.
   Input field, 56px tall, large text, prefix "+880" in slate-400, then 10-digit input. Border slate-200, focus border pulmo-500.
   Helper text "We'll text you a 6-digit code."
   Primary button "Send code" — full-width, pulmo-500 bg, white, 56px tall, rounded-lg.

5. OTP STATE (after Send code tapped) — replace input with 6-box OTP entry.
   6 separate input boxes, each 48px × 56px, centered. Auto-focus next on type.
   Below: "Didn't get the code? Resend in 0:30" — slate-500, "Resend" link in pulmo-500.
   Submit button "Verify and sign in" — full-width pulmo-500.

6. HELP STRIP — bottom of screen, slate-100 bg, single row.
   "Not a CHW? Open caregiver WhatsApp →"
   "Trouble signing in? Call +880XXXXXXXXX"

Style: extremely large tap targets (CHWs may have phones with cracked screens, dust, etc.). Generous vertical spacing. Use pulmo-500 only for the primary CTA — everything else slate. No fancy animations.

Edge cases to render:
- Loading state: button shows spinner + "Sending..." + disabled.
- Error: red border on input + error message below in red-600.
- Success: green checkmark above the OTP boxes after verify.

Desktop version: same layout, max-w-md centered, with a left-side illustration of a CHW with a phone in a Bangladesh rural setting.
```

---

#### 2.2 CHW dashboard — live alerts ★ MUST-HAVE

```
Design the CHW live alerts dashboard at babypulmo.com/chw. Mobile-first (primary use case), desktop responsive. Purpose: a CHW opens this on their phone and immediately sees the most urgent active alerts in their area.

LAYOUT (mobile):

1. APP HEADER — sticky 64px, pulmo-500 bg, white text.
   Left: "Baby Pulmo · CHW" small wordmark.
   Right: avatar circle with CHW initial; tap → profile menu.

2. PAGE TITLE BAR — pulmo-50 bg, 96px tall, 24px padding.
   Eyebrow text-xs uppercase pulmo-700: "Bogura district · 8 active"
   h1 text-2xl pulmo-900 bold: "Live alerts"
   Subtitle slate-600 text-sm: "Pediatric cough escalations from the rules-gated severity layer."

3. FILTER ROW — horizontal scroll on mobile, full row on desktop. Pills (chips).
   • All (active default, pulmo-500 bg)
   • Critical (red border)
   • High (orange border)
   • Moderate (yellow border)
   • Last 24h
   • Within 5km
   Tap a pill to filter.

4. ALERT CARD LIST — vertical, space-y-3.
   Each card: white bg, rounded-xl, 4px colored left-border (severity), shadow-sm, 16px padding.

   Top row of card:
   - Left: severity badge (e.g. "CRITICAL" in red-700 on red-100, uppercase, px-3 py-1 rounded-md).
   - Right: timestamp "2 min ago" text-xs slate-500.

   Middle of card:
   - h3 text-lg slate-900: "Pneumonia signs · 87% confidence"
   - Bangla subtitle text-sm pulmo-700: "শিশুর কাশিতে নিউমোনিয়ার আলামত"
   - Two-line meta: "Caregiver +880****8492 · 12-month-old · Distance 2.3 km"

   Bottom row:
   - Status chip: "PENDING" (text-xs uppercase, yellow-700 on yellow-100). Or "ACKNOWLEDGED" green, "RESOLVED" slate.
   - Right: small icon row — phone icon (call), map-pin icon (directions), play icon (listen to audio).

5. EMPTY STATE — if no alerts, show a friendly card.
   Dashed border slate-300, white bg, centered text.
   Icon (a feather drawing of a phone with no notifications).
   "No active alerts. You're all caught up."

6. BOTTOM NAV — 4 tabs on mobile, hidden on desktop.
   Live · History · Map · Profile.
   Active = pulmo-500, inactive = slate-500.

Realistic sample data — render 5 alert cards in this order:
1. CRITICAL · Pneumonia 87% · 2 min ago · "+880****8492" · 2.3 km · PENDING
2. HIGH · Bronchiolitis 79% · 14 min ago · "+880****1247" · 4.1 km · PENDING
3. HIGH · Croup 71% · 38 min ago · "+880****9302" · 6.8 km · ACKNOWLEDGED
4. MODERATE · Asthma 68% · 1 hour ago · "+880****4519" · 8.2 km · PENDING
5. LOW · Normal 92% · 2 hours ago · "+880****6701" · 3.7 km · RESOLVED

Style: mobile-first, real responsive. On desktop: 2-column alert grid, max-w-5xl, side filter rail instead of horizontal pills. All times in relative format ("2 min ago") + tooltip with full timestamp.

States to render: loading skeleton, empty state, and a card mid-tap with pressed visual feedback.
```

---

#### 2.3 CHW alert detail ★ MUST-HAVE

```
Design the alert detail screen — the CHW taps an alert card and lands here. Mobile-first, desktop responsive.

LAYOUT (mobile, top → bottom):

1. APP HEADER — pulmo-500 bg, 64px. Left: back arrow + "Alert detail". Right: 3-dot menu (mark as priority, report issue).

2. SEVERITY BANNER — full-width strip, severity color (red for critical).
   "CRITICAL · Pneumonia signs · 87% confidence"
   Caption: "Routed to you 2 minutes ago. Pending acknowledgement."

3. AUDIO PLAYER CARD — white bg, rounded-xl, shadow-sm.
   Wavefrom visualization (gray bars + pulmo-500 overlay showing playback position).
   Big play button pulmo-500 circle, 56px.
   Duration "0:00 / 0:30".
   Caption: "Original cough recording sent by caregiver at 14:32 BDT."
   Below: small button "Listen to Bangla reply we sent" (secondary style).

4. CLASSIFICATION CARD — white bg, rounded-xl.
   h3 text-lg "Classifier output"
   Mini-table:
     Class:        Pneumonia
     Confidence:   87%
     Top-2:        Pneumonia 87% / Bronchiolitis 8%
     Model:        babypulmo-wav2vec2-int8 v0.1.2
     Inference:    4.2 sec on Modal CPU
   Bottom: collapsible "Show Grad-CAM heatmap →" (image of mel-spectrogram with red overlay where features fired).

5. IMCI GUIDANCE CARD — pulmo-500 left border.
   h3: "WHO IMCI recommendation"
   Body text-sm slate-700: "Children 2–11 months with fast breathing (>50/min) OR chest indrawing should be classified as pneumonia and treated with first-line antibiotic (amoxicillin)."
   Tag chip below: "Source: WHO IMCI Chart Booklet 2024, p. 47"

6. CAREGIVER + CHILD CARD — white bg.
   Caregiver phone (last 4 visible, rest masked): +880 **** 8492
   Tap to call (pulmo-500 phone icon).
   Child profile: "Age 12 months · Female · Bogura sadar"
   GPS: small Mapbox-style mini-map with a pin. Caption "2.3 km from your last known location." Tap → opens directions in Google Maps.

7. ACTION BUTTONS — sticky bottom row, white bg, top border.
   Primary: "Acknowledge & dispatch" — pulmo-500 full-width 56px.
   Secondary row: 3 small buttons: "Call now", "Send WhatsApp", "Forward to doctor".

8. AUDIT TRAIL CARD — collapsed by default.
   "Show audit trail" toggle.
   Expanded: list of events (alert created at 14:32, routed to you at 14:34, etc.).

Style: high-information density but breathing. Every card rounded-xl with shadow-sm. On desktop: 2-column layout (audio + classification on left, IMCI + caregiver + actions on right). Severity color bleeds into a subtle 4-px left border on every card.

Sample copy uses real Bangla — for example, the "Bangla reply we sent" tooltip shows: "Apnar shishur cough-e pneumonia-r alamat dekha jacche. Ekjon CHW alert peyechen ebong drukito ashben." (verbatim from lib/tts.ts).
```

---

#### 2.4 CHW alert acknowledge modal ☆ nice-to-have

```
Design a modal that pops over the alert detail screen when the CHW taps "Acknowledge & dispatch". Mobile-first.

LAYOUT:

1. BACKDROP — semi-transparent slate-900/60 over the underlying page.

2. MODAL CARD — white bg, rounded-2xl, slides up from bottom on mobile / centered on desktop. Max-w-md.

3. MODAL HEADER — close X icon top-right.
   Icon: pulmo-500 circle with a checkmark.
   h2 text-xl pulmo-900: "Confirm dispatch"
   Body slate-700: "You're telling the system you're going to this caregiver now. Caregiver will be notified via WhatsApp."

4. STATUS PICKER — 3 radio buttons stacked.
   ◉ "Dispatching now — I'm heading there" (default)
   ◯ "Acknowledged — will dispatch within 1 hour"
   ◯ "Cannot dispatch — forward to another CHW"

5. ETA INPUT — only visible if "Dispatching now" or "within 1 hour" selected.
   Label text-xs uppercase slate-500: "ETA"
   Quick chips: 15 min · 30 min · 1 hour · Custom

6. NOTE FIELD — optional.
   Multi-line textarea, slate-200 border, placeholder "Add a note (visible to caregiver in Bangla auto-translation)."

7. FORWARD STATE — if "Cannot dispatch" selected.
   Dropdown: pick another CHW from a list (3-4 names with distance to caregiver).

8. ACTION BUTTONS — bottom row.
   Cancel (secondary, white bg + pulmo-500 border).
   Primary: "Confirm dispatch" — pulmo-500 bg, white text, full-width on mobile, half on desktop.

9. SUCCESS STATE (after confirm) — modal swaps to a checkmark animation + "Dispatched. Caregiver notified. ETA 15 min." + auto-closes after 2 seconds.

Style: warm, deliberate, no rush. Tap target sizes 56px+. Show the dispatch action clearly because it has real-world consequence — a mother is waiting. Match the existing severity color theme (this modal often opens on a critical alert, so a subtle red tint on the header bar is appropriate).
```

---

#### 2.5 CHW history / closed alerts ☆ nice-to-have

```
Design the CHW history screen. Mobile-first, desktop responsive. Purpose: a CHW reviews past cases — for follow-up calls, for portfolio, for understanding patterns in their area.

LAYOUT (mobile):

1. APP HEADER — sticky, pulmo-500. Back arrow + "History".

2. STATS STRIP — pulmo-50 bg, 3 columns.
   "47" → Cases this month
   "92%" → Acknowledged within 30 min
   "11" → Active follow-ups
   Each column: number text-3xl bold pulmo-500, label text-xs uppercase slate-500.

3. DATE-RANGE PICKER — horizontal scroll chips.
   Today · 7 days · 30 days · 90 days · Custom
   Tap "Custom" → opens a calendar.

4. FILTER ROW — second row of chips.
   All · Resolved · Dispatched · Forwarded · Closed
   Severity chips: Critical · High · Moderate · Low (with severity colors)

5. CASES LIST — vertical, space-y-3. Each row:
   Compact card, white bg, rounded-lg, 12px padding.
   Left: severity dot (small colored circle, no left-border because list is dense).
   Center: 2 lines — top: "Pneumonia 87% · Dispatched · Resolved" / bottom: "+880****8492 · 12mo F · 2.3 km · May 24, 14:32".
   Right: chevron arrow (slate-400) → tap goes to alert detail (read-only mode).

6. EMPTY STATE — "No cases in this range. Try a wider date filter."

7. EXPORT BAR — sticky bottom on desktop only.
   "Export 47 cases as CSV" (text link, pulmo-500).
   "Print summary" (secondary).

Style: dense but readable. Borders softer than the live-alerts screen (this is reference data, not action data). On desktop: table layout with sortable columns instead of cards. Date column left, severity center, status right.

Sample data: render 10 historical cases spanning Apr-May 2026, varied severity, varied status.
```

---

#### 2.6 CHW profile + availability toggle ☆ nice-to-have

```
Design the CHW profile / settings screen. Mobile-first.

LAYOUT (top → bottom):

1. APP HEADER — pulmo-500, "Profile". Back arrow + edit icon.

2. PROFILE CARD — pulmo-50 bg, 24px padding, centered.
   Large avatar (96px), CHW initial in pulmo-500 circle.
   Name text-xl bold: "Rashida Begum, CHW"
   Title small slate-500: "BRAC Community Health Worker · Bogura sadar"
   Tap-to-edit pencil icon next to name.

3. AVAILABILITY TOGGLE CARD — full-width white bg, rounded-xl.
   Big toggle switch (52px wide), green when ON.
   Label: "On duty — alerts will route to you"
   When OFF: "Off duty since 18:42. Alerts route to backup CHWs."
   Tap toggle → smooth animation.

4. AREA SETTINGS CARD — white bg.
   "Coverage area: 5 km radius around current location"
   Mini-map showing the circle.
   "Edit area →"

5. CONTACT INFO CARD — white bg.
   Phone: +880 17xx xxx xxx (visible to caregivers in critical cases)
   Backup phone: +880 18xx xxx xxx
   Languages spoken: Bangla, Chittagonian
   "Edit →"

6. WORKLOAD CARD — white bg.
   "Max alerts per day: 25" with stepper +/-
   "Current load: 8/25 today"
   Small horizontal bar showing 32% capacity, pulmo-500 fill.

7. NOTIFICATION PREFS CARD — white bg.
   Toggles:
   - WhatsApp ping for new alerts (ON)
   - SMS fallback if WhatsApp fails (ON)
   - Quiet hours 22:00 – 06:00 (OFF)

8. ACCOUNT ACTIONS — slate-100 bg, list rows.
   - Change PIN
   - Sign out (red-600 text)
   - Help & support
   - Privacy policy → /privacy-ethics

9. APP VERSION at very bottom, slate-400 text-xs, centered.

Style: settings-app convention. Toggles are obvious. Edit pencils on every editable row. Use pulmo-500 for the primary on-duty toggle's "ON" state. Red-600 only for destructive actions like sign-out.

Edge case to render: a "Verification pending — your BRAC ID is being verified, you can't accept critical alerts yet" banner at top of the screen if applicable.
```

---

### Module 3 — Admin console

#### 3.1 Admin dashboard ☆ nice-to-have

```
Design the internal admin dashboard at babypulmo.com/admin. Desktop primary, tablet responsive (admins don't use phones for this). Purpose: Ferdous (and later, an operations lead) monitors system health + clinical KPIs.

LAYOUT:

1. APP HEADER — slate-900 bg (this is a darker, more "operational" surface than the public site), white text.
   Left: "Baby Pulmo · Admin" + pulmo-500 dot indicator.
   Right: env switch (Production / Sandbox), avatar, settings cog.

2. LEFT SIDE NAV — 220px wide, slate-100 bg.
   - Dashboard (active)
   - Alerts
   - CHWs
   - Audit log
   - Clinical content
   - Analytics
   - Settings

3. MAIN GRID — 12-col grid, 24px gutters, max-w-7xl.

   TOP ROW — 4 KPI cards, equal width.
   • "Active alerts" 47 → today, 18% above 30-day median.
   • "CHW response (median)" 23 min → target 30 min.
   • "Classifier accuracy (rolling 7d)" 71% → in-range.
   • "TTS cache hit" 94% → target >90%.
   Each card: large number text-4xl bold, label text-sm slate-500, delta in green/red.

   SECOND ROW — 2 chart cards (each 6-col).
   Left: "Alert volume — last 7 days" line chart, pulmo-500 line on slate-50 bg.
   Right: "Severity distribution — last 24h" stacked bar chart (critical/high/moderate/low/insufficient).

   THIRD ROW — 2 cards.
   Left (8-col): "Top 5 districts by alert volume" table.
   Right (4-col): "System health" — 5 status pills.
     - Web (Vercel/Docker) 🟢
     - Classifier (Modal) 🟢
     - WhatsApp webhook 🟢
     - GCP TTS 🟡 (12% errors last 1h)
     - Supabase 🟢

   FOURTH ROW — 1 wide card.
   "Recent escalations" — table of last 10 critical/high alerts with timestamp, CHW assigned, status, time-to-acknowledge.

4. FOOTER — small slate-400 text-xs row.
   "babypulmo.com · Production · Commit 887eca4 · Deploy 2 hours ago"

Style: data-dense, slate-100 + white + pulmo-500 accents. Numbers in tabular font (Inter Tight or Mono). Chart colors: pulmo-500 + severity colors. NO emojis on KPI cards (use real icons).

Sample data: realistic Bangladesh-context numbers — 47 alerts/day in early pilot, 23-min response, 71% accuracy.
```

---

#### 3.2 Audit log viewer ☆ nice-to-have

```
Design the immutable audit log viewer at babypulmo.com/admin/audit. Desktop primary. Purpose: BMRC ethics reviewers, legal auditors, and Ferdous trace any caregiver call end-to-end.

LAYOUT:

1. APP HEADER + LEFT NAV — same as admin dashboard. "Audit log" highlighted.

2. PAGE TITLE BAR.
   h1 "Audit log"
   Subtitle slate-500: "Immutable per-interaction record. Read-only. Cannot be modified."

3. FILTER BAR — horizontal row, slate-50 bg, sticky.
   Date range picker · Caregiver phone (search) · Severity dropdown · Class dropdown · CHW dropdown · Status dropdown · "Export CSV" button.

4. TABLE — full-width, sticky header, virtual-scroll for large datasets.
   Columns:
   - Timestamp (ISO, sortable)
   - Audit ID (short hash, clickable)
   - Caregiver phone (masked: +880**** + last 4)
   - Class
   - Confidence
   - Severity
   - Action
   - CHW assigned
   - Status
   - Model version
   - IMCI chunks (count + tap to see)

5. ROW DETAIL DRAWER — clicking a row slides in a right-side drawer.
   Drawer header: "Audit row · {short hash}"
   Body:
   - Full timeline: alert created → routed → CHW acknowledged → resolved.
   - Audio playback (with playback-attempted counter).
   - Classifier full output JSON.
   - IMCI chunks retrieved (list of 3-5 chunk titles + similarity scores).
   - Bangla script selected (verbatim).
   - WhatsApp message IDs (caregiver + CHW).
   - All env vars + commit hash at time of call (for reproducibility).

6. CHAIN-OF-CUSTODY FOOTER — at bottom of drawer.
   "SHA-256: 7a3c8b2e... · Signed by audit_log table immutability constraint · Last verified 2026-05-25 14:32:11 UTC"

7. SAMPLE DATA — render 12 rows with realistic Bangladesh dates, masked phones, mix of severity, mix of CHWs.

Style: dense table, slate-100 row hover, pulmo-500 only on the short-hash links and "Export CSV" button. Mono font for hashes + timestamps. The drawer is the "wow" moment for ethics auditors — make it feel comprehensive but readable.
```

---

#### 3.3 Clinical content editor — Dr. Saadi interface ☆ nice-to-have

```
Design the clinical-content editor where Dr. Saadi (or a future clinical reviewer) edits the 7 Bangla scripts. Desktop primary, web-only.

LAYOUT:

1. APP HEADER + LEFT NAV — Admin nav. "Clinical content" highlighted.

2. PAGE TITLE BAR.
   h1 "Bangla scripts — clinician review"
   Subtitle slate-500: "Only clinical reviewers can edit. All edits are versioned and require a 2-clinician approval before live."

3. LANGUAGE TOGGLE — top right. "Romanized Bangla" / "Bangla script" / "English translation" tabs.

4. SCRIPT GRID — 7 cards, one per (class, severity) tuple. Each card:
   - Header: severity badge + class name (e.g. "CRITICAL · pneumonia").
   - Audio preview button: "Listen to current TTS" (small pulmo-500 button).
   - Three text panes side-by-side:
     • Romanized Bangla (edit field, large, 6 lines)
     • Bangla script (read-only, auto-rendered from romanized)
     • English literal translation (read-only, auto-translated)
   - Edit history: "v3 · Last edited by Dr. Saadi on 2026-06-08" with a "View history →" link.
   - Approval status badge: Approved (green) / Pending review (yellow) / Rejected (red).

5. EDIT FLOW — clicking edit transforms a card.
   - Romanized field becomes editable.
   - Below it: comment box "Why are you changing this?" (mandatory).
   - Two buttons: "Save as draft" / "Submit for approval".
   - Right-side panel slides in: diff view (red = removed text, green = added).

6. APPROVAL SIDEBAR — fixed right rail, 320px.
   "Pending approvals" list — 2 cards.
   Each: "v4 of pneumonia:critical · Submitted by Dr. Saadi 2 hours ago · Awaiting 2nd reviewer."
   Approve / Reject buttons (only visible if you're a 2nd reviewer).
   Comment thread below.

7. LIVE DEPLOY PANEL — bottom of page.
   "Currently live in production: stock-bangla.json v12 (deployed 2026-05-30 by Ferdous)."
   "Reload on production →" button (re-runs `./deploy.sh reload-clinical` via webhook).

Style: trust + accountability. Lots of metadata (who, when, why). Pulmo-500 only on primary "Submit" actions; red-600 on reject; green-600 on approve. Diff view uses GitHub-style red/green block backgrounds. Audio buttons are obvious (large pulmo-500 play circles).

Sample content for one card — pneumonia:critical:
Romanized Bangla (current):
"Apnar shishur cough-e pneumonia-r alamat dekha jacche. Ekjon CHW alert peyechen ebong drukito ashben. Doya kore shishuke shojaye boshiye rakhun ebong tarol khabar din. Joruri obostha-ye 999 kol korun. Ei tothyo doctor-er bikolpo noy."
English translation:
"Your child's cough shows signs of pneumonia. A CHW has been alerted and is coming urgently. Please keep the child upright and give fluids. In an emergency, call 999. This information is not a substitute for a doctor."
```

---

#### 3.4 CHW roster + GPS map ☆ nice-to-have

```
Design a CHW roster and live-map admin page at babypulmo.com/admin/chws. Desktop primary, tablet responsive.

LAYOUT:

1. APP HEADER + LEFT NAV — "CHWs" highlighted.

2. PAGE TITLE BAR.
   h1 "Community Health Workers"
   Subtitle slate-500: "23 active CHWs across 4 districts. 1,247 caregivers in coverage area."
   Right side: button "Add CHW" (pulmo-500 primary).

3. SPLIT VIEW — 60/40 horizontal.
   LEFT (60%): map view (Mapbox-style or OpenStreetMap), zoomed to Bogura district by default.
   - Each CHW = pulmo-500 pin with their initial.
   - Each pin has a 5 km circle around it (their coverage area) in pulmo-500/10% opacity.
   - Click a pin → mini-popover with name, on-duty status, current load.
   - Map controls: zoom +/-, "Show coverage gaps" toggle (highlights areas with no CHW within 10 km in red).

   RIGHT (40%): CHW list table, scrollable.
   Columns: Avatar + Name · Status (on/off duty) · District · Active alerts · Total this month · Last login.
   Each row has a small action menu (3-dot): view profile, suspend, send message.

4. DISTRICT TABS — top of left side. Bogura · Sirajganj · Naogaon · Joypurhat. Tap to switch the map view.

5. STATS STRIP — top of right side.
   "23" total CHWs · "18" on duty · "4" with capacity available · "1" district has coverage gap.

6. INVITE FLOW — clicking "Add CHW" opens a modal.
   Fields: Name, phone, language(s), district, coverage radius, BRAC ID number.
   Generate invite link → CHW receives WhatsApp message with link to onboard.

Style: this is the "operations command center" feel. Map dominates. Pulmo-500 pins on a soft slate map style (not Google Maps default). Severity colors used if you toggle "show active alerts as overlays". Show empty coverage gaps clearly — that's the actionable signal.

Sample CHWs (render 5–6):
- Rashida Begum, Bogura sadar, on duty, 8 alerts today
- Hasina Akter, Bogura north, on duty, 3 alerts
- Mohammed Iqbal, Sirajganj east, off duty (last seen 18:42)
- Nasreen Begum, Naogaon, on duty, 5 alerts
- Faruque Ahmed, Joypurhat, on duty, 12 alerts (high load)
```

---

### Module 4 — WhatsApp conversation mockups

> These prompts produce phone-shape WhatsApp chat renders for the pitch deck + YouTube demo video. They are not real screens — they're visual mockups.

#### 4.1 First-time caregiver flow ★ MUST-HAVE

```
Design a WhatsApp chat conversation mockup on an iPhone-style phone frame. Portrait orientation. Single image showing the full conversation. This is for our investor deck + YouTube demo — it must look exactly like the real WhatsApp app on an Android phone (since most rural BD caregivers use Android).

CONTEXT
- WhatsApp visual style: light theme, WhatsApp green accents (#075E54 for sent bubbles, white for received bubbles, light-gray background).
- The caregiver is messaging the Baby Pulmo WhatsApp number (saved as "Baby Pulmo · বেবি পুলমো" in their contacts).
- All Baby Pulmo replies are in Romanized Bangla. The caregiver's messages are short, in Bangla script.

PHONE FRAME
- Android phone outline (not iPhone — be specific).
- Status bar: 100% battery, 4G signal, 14:32 BDT.

WHATSAPP HEADER
- Back arrow + Baby Pulmo avatar (small orange pulmo-500 circle with a tiny lung icon) + "Baby Pulmo · বেবি পুলমো" + status "online".
- Right: video call icon, voice call icon, 3-dot menu.

CONVERSATION (top → bottom, oldest first):

Received bubble (white, left-aligned, 14:30):
"Assalamu alaikum! Ami Baby Pulmo. Apnar shishur cough-er 30 second voice record-kore amake pathan. Ami 10 second-er moddhe bole debo ki problem ache.
(Disclaimer: Ei tothyo doctor-er bikolpo noy. Joruri obostha-ye 999 kol korun.)"

Time stamp small below: 14:30

Sent bubble (light green, right-aligned, 14:32):
"আসসালামু আলাইকুম। আমার শিশুর কাশি ভালো হচ্ছে না।"
(English subtitle below in tiny gray: "Peace be with you. My child's cough isn't getting better.")

Received bubble (white, 14:32):
"Onek dhonnobad. Doya kore shishur cough-er ekti spoint 30 second voice note pathan. Shanto poribeshe record korun."
(English subtitle: "Thank you. Please send a clear 30-second voice note of the child's cough. Record in a quiet place.")

Sent bubble (light green, 14:33) — VOICE MESSAGE.
- Show the voice-message UI: WhatsApp green wave bars + duration "0:30" + play button.
- Caption below "Listening..." (3 animated dots).

Received bubble (white, 14:33, "typing..." appears briefly then resolves) — TYPING INDICATOR.

[CHAT CONTINUES IN PROMPT 4.2 — show only this far for prompt 4.1]

STYLE NOTES
- Bubble corners exactly like WhatsApp (rounded except inner-side corner).
- Bangla text is in Bangla script (Noto Sans Bengali). Romanized Bangla in regular sans.
- Sent messages have double check marks (delivered + read) in slate-400 / pulmo-500.
- Background: WhatsApp's default doodle wallpaper (very subtle, almost white).

Render this as a single image, ~1080×2400 px, phone outline included with subtle drop shadow.
```

---

#### 4.2 Classification result ★ MUST-HAVE

```
Same WhatsApp phone-frame mockup. Direct continuation of conversation 4.1. This is the "money shot" for the demo video — the moment the caregiver receives the AI's response.

CONTINUE FROM 14:33 (after the typing indicator resolves):

Received bubble (white, 14:34) — TEXT CARD.
"📋 *Baby Pulmo*
SEVERE · *Pneumonia* (87% confidence)
A community health worker has been alerted and is coming."

Received bubble (white, 14:34) — VOICE MESSAGE FROM BABY PULMO.
- Same voice-message UI as before, but green-tinted indicating it's an audio response.
- Duration 0:24.
- Caption below in slate-500 italic: "Bangla audio guidance (clinician-vetted)"
- Tap-to-play hint: small pulmo-500 play button overlay.

Received bubble (white, 14:34) — IMAGE CARD.
- A pediatric pneumonia severity card with:
  Title "What to do right now" in pulmo-900 bold
  3 bullets in Bangla (Romanized):
  1. "Shishuke shojaye boshiye rakhun" (Keep the child seated upright)
  2. "Tarol khabar din" (Give fluids)
  3. "Drukito CHW asbe — opekkha korun" (CHW is coming urgently — please wait)
  Bottom: small red banner "Joruri obostha-ye 999 kol korun" (In emergency call 999)
- Subtle pulmo-500 left border on the card.

Sent bubble (light green, 14:35) — TEXT.
"ধন্যবাদ। আমি অপেক্ষা করছি।"
(English subtitle: "Thank you. I'm waiting.")

Received bubble (white, 14:35) — TEXT.
"Rashida Begum (BRAC CHW) apnar dike rowna hoyechhen. ETA 15 minute. Tar number: +880 1712 345 678."
(English subtitle: "Rashida Begum (BRAC CHW) is heading to you. ETA 15 minutes. Her number: +880 1712 345 678.")

Below this last message, show WhatsApp's "online" status changed to "last seen at 14:35".

STYLE NOTES
- The text card and image card both have rounded corners; image card slightly raised with subtle shadow.
- Severity/urgency color is communicated by the pulmo-500 left border and the red emergency banner — never by red speech bubbles (that would look like an error).
- Show a small "✓ Delivered" indicator on the sent message in green.

Render at 1080×2400 px with phone frame + subtle drop shadow.

DESIGN NOTE FOR THIS PROMPT
This is the screen we'll freeze on at 1:30 of the YouTube demo video. The story is: "Mother sends cough → AI listens → AI responds with clinical guidance in her language + dispatches a real CHW." Every visual choice should reinforce: legible Bangla, fast (timestamps tight), and SAFE (CHW name + phone visible, escalation explicit, emergency line cited).
```

---

#### 4.3 Severe case + CHW notification (split-screen) ☆ nice-to-have

```
Design a side-by-side phone mockup showing the caregiver's WhatsApp on the left AND the CHW's WhatsApp on the right — same moment in time. Communicates the automatic CHW-dispatch flow visually.

LEFT PHONE — Caregiver's chat with Baby Pulmo (re-use the closing 3 bubbles from prompt 4.2 ending with "Rashida Begum apnar dike rowna hoyechhen").

RIGHT PHONE — Rashida Begum (CHW)'s chat with Baby Pulmo dispatch.

WhatsApp Header (right): "Baby Pulmo · CHW dispatch · বেবি পুলমো"

Received bubble (white, 14:34) — TEXT alert.
"🚨 *Baby Pulmo ALERT* (CRITICAL)
Class: Pneumonia · 87% conf
Caregiver: +880 **** 8492
Recommended action: see_chw_now
Distance: 2.3 km"

Below this — VOICE MESSAGE (the original cough recording from the caregiver, 0:30 duration, blue play button to differentiate from caregiver-side audio).

Below this — IMAGE CARD with:
- Mini-map showing the caregiver's location and a route from the CHW's current position. Pulmo-500 route line.
- "Open in Google Maps →" button.

Below this — ACTION BUTTONS (rendered as WhatsApp interactive-template buttons):
[ Acknowledge ]  [ Dispatch now ]  [ Forward ]

Sent bubble (light green, 14:35) — CHW Rashida selects "Dispatch now":
"DISPATCHED · ETA 15 min"

System notification (slate-100 bg, centered): "Caregiver +880**** 8492 has been notified."

STYLE NOTES
- Both phones share a horizontal separator at the top with two small labels: "Caregiver's view" on left, "CHW's view" on right.
- Subtle connection line between them — a curved pulmo-500 arrow showing the message flow from caregiver → AI → CHW (do not overdraw; subtle).
- Both phones have same Android frame style.
- This image is for the pitch deck slide titled "Auto-dispatch in 90 seconds."

Render at 2400×2400 px, both phones side-by-side, subtle pulmo-50 background gradient.
```

---

#### 4.4 Insufficient quality — retry prompt ☆ nice-to-have

```
Single WhatsApp phone mockup showing what happens when the cough recording is too quiet or too short. Demonstrates Baby Pulmo's quality-gate ethics: it never guesses on bad data.

PHONE FRAME — same Android style.

CONVERSATION:

Sent bubble (light green, 14:42) — VOICE MESSAGE.
- WhatsApp green wave bars + duration "0:12".
- Volume looks low (smaller wave amplitudes).
- Caption: "Listening..."

Received bubble (white, 14:42) — TEXT.
"📋 *Baby Pulmo*
Audio sposhto chhilo na. Doya kore aro shanto jaygay giye 30 second-er ekti spoint cough record kore abar pathan."

(English subtitle below in tiny gray: "The audio wasn't clear. Please go to a quieter place and send a clear 30-second cough recording.")

Received bubble (white, 14:42) — IMAGE CARD with 3 tips.
Title pulmo-900 bold: "How to record a good cough"
Tips:
1. "Shanto jayga" (Quiet place — no fan/TV)
2. "30 second" (Full 30 seconds — start before child coughs, end after)
3. "Phone-er kachhe" (Hold phone close to child's mouth, ~6 inches)

Visual icons accompany each tip — small flat-color illustrations.

Received bubble (white, 14:43) — TEXT.
"Aro shahajjo dorkar? +880 XXXX XXX XXX number-e WhatsApp korun, ekjon manush apnake shahajjo korbe."
(English subtitle: "Need more help? WhatsApp +880 XXXX XXX XXX, a real person will help you.")

Sent bubble (light green, 14:45) — VOICE MESSAGE (retry, 0:30, better wave amplitude).
- Caption: "Listening..."

[Conversation ends here — the next reply would be a normal classification.]

STYLE NOTES
- This screen is important for the "ethics + safety" pitch slide. Show that Baby Pulmo is HONEST when it can't help — it doesn't fake a diagnosis. Make the tone supportive, not blaming the caregiver.
- The retry voice message at the end has visually larger wave amplitude than the first, subtly showing improvement.
- All Bangla is Romanized except the rendered tips which use Bangla script for the title and Romanized for the explanation.

Render at 1080×2400 px with phone frame and pulmo-50 background.
```

---

### Module 5 — Brand assets

#### 5.1 Logo lockup variants ★ MUST-HAVE

```
Design a logo system for Baby Pulmo. Single Stitch generation that produces a sheet with all variants. SVG-style flat vector aesthetic.

VARIANTS TO RENDER (in a 4×3 grid on a white canvas, each cell 480×240):

ROW 1 (primary, on white bg):
  1A. Horizontal lockup: ICON + WORDMARK side by side.
      Icon: a stylized lung silhouette (organic, soft curves) in pulmo-500 with a tiny soundwave coming out of one side. ~64px.
      Wordmark: "Baby Pulmo" in bold sans (Inter SemiBold or similar), pulmo-900, with Bangla "বেবি পুলমো" in Noto Sans Bengali below in smaller pulmo-700.
  1B. Stacked: icon on top, wordmark + Bangla below.
  1C. Icon only: the lung+soundwave alone, no wordmark.

ROW 2 (monochrome variants, on white bg):
  2A. Horizontal lockup in pulmo-900 only (no orange).
  2B. Horizontal lockup in black only (#0F172A / slate-900).
  2C. Icon only in pulmo-500.

ROW 3 (dark mode, on pulmo-900 bg):
  3A. Horizontal lockup with cream wordmark + pulmo-500 icon (preserves contrast on dark bg).
  3B. Stacked, same color treatment.
  3C. Icon only in pulmo-500.

ROW 4 (favicon-ready):
  4A. Icon at 32×32 — simplified for tiny size (lung shape thicker, soundwave removed).
  4B. Icon at 16×16 — even simpler, just the lung silhouette.
  4C. App icon at 1024×1024 — rounded-square iOS-style with the lung+soundwave centered on a pulmo-50 background, pulmo-500 lung.

DESIGN PRINCIPLES
- The lung-with-soundwave concept reads as: "we listen, we hear breath, we're about lungs."
- Avoid medical clichés (no plus-cross symbol, no stethoscope outline).
- Bangla typography must look as considered as the English (not a tacked-on translation).
- All curves should feel organic and warm — this is a pediatric product, not a corporate clinical brand.

OUTPUT
Single canvas, 12 cells (4 rows × 3 columns), labeled below each cell with the variant name (1A / 1B / etc.) in small slate-500 text.

EXPORT
Should be exportable to SVG (vector). Each cell becomes a separate Figma component when imported.
```

---

#### 5.2 App icon / favicon family ☆ nice-to-have

```
Design the full Baby Pulmo app icon family for web favicon + iOS + Android + PWA install. Single Stitch generation showing all sizes on a single canvas.

ICON CONCEPT (recap from 5.1)
A stylized lung silhouette with a small soundwave emanating from one side. Color: pulmo-500 lung on pulmo-50 background, no text.

SIZES TO RENDER (one row per platform, on a clean white canvas with subtle dividers):

ROW 1 — Web favicons:
  - 16×16 (super-simplified, no soundwave detail)
  - 32×32 (with soundwave, slightly thicker stroke)
  - 48×48 (Windows favicon)
  - 96×96 (Chrome new-tab)
  Each labeled with the size below.

ROW 2 — iOS app icons:
  - 180×180 (iPhone)
  - 152×152 (iPad)
  - 1024×1024 (App Store).
  All with iOS rounded-square mask (22% corner radius).

ROW 3 — Android app icons:
  - 192×192 (xxxhdpi)
  - 512×512 (Play Store)
  Both: full bleed (no mask — Android applies adaptive icon masks).

ROW 4 — PWA install icons:
  - 192×192 (with iOS-style rounded square)
  - 512×512 maskable variant (4% safe zone around the icon).

ROW 5 — Apple Touch icon + Open Graph variants:
  - Apple Touch 180×180.
  - Social-share Open Graph image 1200×630: same icon centered on pulmo-50 bg with "Baby Pulmo · বেবি পুলমো" wordmark below it and tagline "AI Pediatric Cough Diagnostic" in slate-700.

DESIGN PRINCIPLES
- At 16px the icon must still be readable as "lungs". Simplify aggressively — even drop the soundwave at the smallest sizes.
- iOS rounded-square should have the icon centered with ~8% padding from each edge.
- Background colors:
  - iOS: pulmo-50 (cream)
  - Android adaptive: pulmo-50 with pulmo-500 lung
  - Favicon dark-mode variant: invert to pulmo-500 background + pulmo-50 lung.

OUTPUT
Single landscape canvas (~3200×2400), every size labeled, with hex codes annotated below each row in slate-500.
```

---

#### 5.3 Hero illustration ★ MUST-HAVE

```
Design a single full-color illustration for the Baby Pulmo landing page hero and the investor-deck cover slide.

SUBJECT
A Bangladeshi mother seated on a low wooden stool in a rural-Bangladesh setting (tin-roofed house, soft afternoon light), holding a young child (~12-18 months old) on her lap. The mother is holding a smartphone close to the child, mid-recording. The child's face is turned slightly away from the viewer — we do NOT see the child's full face (privacy + dignity).

A subtle visual representation of the AI listening:
- Soft pulmo-500 audio waves emanating from the phone, traveling upward and then dissolving into small geometric stethoscope outlines and Bangla glyphs ("কাশি" — cough; "ভাল" — good) suggesting language understanding.

ENVIRONMENT
- Background: indoor / outdoor liminal space — open doorway with tropical greenery visible (jute, banana leaves), but interior of the home is the dominant area.
- Soft "golden hour" warm light coming through the doorway.
- A small woven basket and a tin cup on the floor (everyday rural BD details, not stereotyped).

STYLE
- Watercolor + flat geometric hybrid. Soft edges, but distinct color blocks. NOT photorealistic.
- Color palette MUST match brand: pulmo-50 cream walls, pulmo-500 sari (the mother wears a warm orange sari), pulmo-900 deep brown for the stool and shadows, slate-700 for skin tone shadows.
- Skin tones: warm brown, no exaggerated saturation. Avoid any caricature.
- No identifiable face for the mother either — she's looking down at the child; we see her profile or 3/4 from behind. Privacy + universality.

EMOTIONAL TONE
- Tender. Calm. Hopeful.
- Not anxious (no clinical urgency).
- Not staged "stock photo" smiling — just a quiet moment of care.

COMPOSITION
- Mother + child centered, occupying about 60% of the vertical space.
- Phone in mother's hand is the focal point — slight glow around it (pulmo-500 audio waves).
- Lots of negative space at the top for the hero h1 to overlay.
- Aspect ratio: 16:10 (landscape) for the landing hero. Also produce a 4:5 portrait crop for the investor deck cover slide.

OUTPUT
Two crops on a single canvas — 16:10 wide above, 4:5 portrait below — both showing the same illustration zoomed to suit.

REFERENCES (don't copy, but tonally match)
- The illustration style of Médecins Sans Frontières recent campaigns (warm watercolor, real settings).
- The "humans of Bangladesh" Instagram aesthetic — dignified, candid.
- BRAC's photo storytelling.

AVOID
- Stock-illustration look (geometric blob people).
- Overly saturated colors that scream "health tech app."
- Religious imagery (no hijab/skullcap unless requested — keep it culturally neutral).
- Western suburban kitchen settings.
```

---

## D. Priority + credit budget

Stitch's free tier limits generations. If you can only do ~10, hit the **★ MUST-HAVE** rows first:

| # | Module | Screen | Priority | Used for |
|---|---|---|---|---|
| 1.1 | Public | Landing page | **★** | First impression — judges hit this first |
| 1.2 | Public | `/docs` portal | **★** | Judges' reference page — required for full-points |
| 2.2 | CHW | Live alerts dashboard | **★** | Main demo screen for video + finals |
| 2.3 | CHW | Alert detail | **★** | Proves the human-in-loop story |
| 4.1 | WhatsApp | First-time flow | **★** | Opens the YouTube demo video |
| 4.2 | WhatsApp | Classification result | **★** | The "money shot" at 1:30 in video |
| 5.1 | Brand | Logo lockups | **★** | Used in every deliverable |
| 5.3 | Brand | Hero illustration | **★** | Landing + deck cover slide |
| 1.3 | Public | Team page | ☆ | Helps Dr. Saadi credibility + NRB pts |
| 2.4 | CHW | Acknowledge modal | ☆ | Polish for finals demo |
| 3.1 | Admin | Admin dashboard | ☆ | Shows "operational thinking" to judges |
| 4.3 | WhatsApp | Severe case split-screen | ☆ | Deck slide "Auto-dispatch in 90s" |
| 2.1 | CHW | Login / OTP | ☆ | Onboarding story |
| 3.2 | Admin | Audit log viewer | ☆ | BMRC ethics talk track |
| 1.4 | Public | Privacy & Ethics | ☆ | Defensive — only if asked |
| 1.5 | Public | 404 | ☆ | Polish |
| 2.5 | CHW | History | ☆ | Operations completeness |
| 2.6 | CHW | Profile | ☆ | Operations completeness |
| 3.3 | Admin | Clinical editor | ☆ | Dr. Saadi narrative |
| 3.4 | Admin | CHW roster + map | ☆ | "Scale to 100k caregivers" narrative |
| 4.4 | WhatsApp | Insufficient quality | ☆ | Ethics talk track |
| 5.2 | Brand | App icon family | ☆ | Future when shipping native app |

**Recommended sprint plan for Shanta:**
- **Day 2 morning (3 hrs):** Generate ★ 1.1, 1.2, 5.1, 5.3 (the public + brand essentials).
- **Day 2 afternoon (3 hrs):** Generate ★ 2.2, 2.3 (the CHW core), then 4.1, 4.2 (the WhatsApp money shots).
- **Day 3 (if credits + time remain):** 1.3 Team page, 3.1 Admin dashboard, 4.3 split-screen.
- **Days 4-5 + Phase 2:** Everything else, only if it improves the pitch story.

---

## E. Post-generation workflow

After each successful Stitch generation:

1. **Export to Figma.** File menu → Export → Figma. Save the `.fig` to `~/babypulmo-figma/{module}/{slug}.fig`.
2. **Rename consistently.** Pattern: `babypulmo-{module-letter}-{prompt-number}-{slug}.fig`. Example: `babypulmo-2-2-2-chw-dashboard.fig`.
3. **Drop into Google Drive** team folder `BabyPulmo > design > figma/`. OR commit to `BabyPulmo/docs/figma/`.
4. **Tell Ferdous** in Slack/Discord: "1.2 /docs is ready, here's the Figma link." Ferdous reviews + greenlights.
5. **Reimplement in React/Tailwind.** Open the Figma file, copy spacing/colors/text into a new file at `babypulmo/app/{route}/page.tsx`. Use the existing `pulmo-*` Tailwind classes — **do not** re-create the palette.
6. **Commit + push.** The GitHub Actions self-hosted runner auto-deploys to babypulmo.com on every push to `main`. No manual deploy.
7. **Verify live.** Visit https://babypulmo.com/{route} within 2 minutes of push. If it doesn't match the Figma, iterate.

### Naming convention reference

| Module | Letter | Example slug |
|---|---|---|
| 1. Public marketing | `pub` | `pub-landing`, `pub-docs`, `pub-team` |
| 2. CHW web app | `chw` | `chw-dashboard`, `chw-alert-detail` |
| 3. Admin console | `admin` | `admin-dashboard`, `admin-audit-log` |
| 4. WhatsApp mockup | `wa` | `wa-first-flow`, `wa-classification` |
| 5. Brand asset | `brand` | `brand-logo-lockups`, `brand-hero-illustration` |

---

*Last updated: 2026-05-25. Ferdous owns this file. Edits welcome — push directly to `BabyPulmo/babypulmo/design/stitch-prompts.md`.*
