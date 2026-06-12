-- seed_demo.sql — Track A demo data (alerts + audit_log) to light up /chw and /docs.
-- Run AFTER schema.sql and seed_imci.sql, in the Supabase SQL editor.
-- Safe to re-run (it deletes its own demo rows first).
--
-- NOTE on the /docs analytics export: scripts/export-audit-parquet.ts exports a single
-- UTC day. These audit rows are stamped now() and now()-1day, so run the exporter with
-- an explicit date, e.g.:  npx tsx --env-file=.env.local scripts/export-audit-parquet.ts --date=YYYY-MM-DD

-- ── Alerts (CHW dashboard) ──────────────────────────────────────────────
-- severity check constraint allows only: critical | high | moderate.
-- caregiver_location is geography(point,4326); use ST_MakePoint(lon,lat) or omit.
delete from alerts where caregiver_id is null and classification_id is null;
insert into alerts (severity, status, caregiver_location, created_at) values
  ('critical', 'pending',      ST_SetSRID(ST_MakePoint(89.3719, 24.8463), 4326), now() - interval '4 minutes'),
  ('high',     'pending',      ST_SetSRID(ST_MakePoint(89.3801, 24.8512), 4326), now() - interval '21 minutes'),
  ('critical', 'acknowledged', ST_SetSRID(ST_MakePoint(89.3600, 24.8400), 4326), now() - interval '2 hours'),
  ('moderate', 'resolved',     ST_SetSRID(ST_MakePoint(89.3900, 24.8600), 4326), now() - interval '5 hours'),
  ('high',     'resolved',     ST_SetSRID(ST_MakePoint(89.3500, 24.8300), 4326), now() - interval '1 day');

-- ── Audit log (feeds /docs DuckDB-WASM analytics) ───────────────────────
-- payload keys match what export-audit-parquet.ts flattens (class, confidence,
-- breathsPerMin, severity, mustEscalate, decisionReason, profile*).
delete from audit_log where event_type = 'classification_complete' and payload ? 'demo';
insert into audit_log (event_type, payload, created_at)
select
  'classification_complete',
  jsonb_build_object(
    'demo', true,
    'class', c.class,
    'confidence', c.confidence,
    'breathsPerMin', c.bpm,
    'rrConfidence', 'medium',
    'profileAgeMonths', c.age,
    'profileFever', c.fever,
    'severity', c.severity,
    'mustEscalate', c.escalate,
    'decisionReason', c.reason
  ),
  now() - (c.mins || ' minutes')::interval
from (values
  ('pneumonia',     0.82, 52,  9,  true,  'critical', true,  'tachypnea_override', 3),
  ('pneumonia',     0.74, 30,  24, true,  'critical', true,  'audio_class',        12),
  ('bronchiolitis', 0.61, 55,  6,  true,  'critical', true,  'tachypnea_override', 27),
  ('bronchiolitis', 0.58, 38,  18, false, 'high',     true,  'audio_class',        44),
  ('croup',         0.67, 30,  30, false, 'high',     true,  'audio_class',        70),
  ('asthma',        0.71, 28,  40, false, 'moderate', false, 'audio_class',        95),
  ('normal',        0.88, 26,  24, false, 'low',      false, 'audio_class',        130),
  ('normal',        0.79, 24,  12, false, 'low',      false, 'audio_class',        160),
  ('pneumonia',     0.55, null,15, true,  'critical', true,  'cxr_override',       190),
  ('pertussis',     0.63, 35,  20, false, 'high',     true,  'audio_class',        220),
  ('normal',        0.40, 22,  36, false, 'high',     true,  'fail_closed_default',260),
  ('insufficient_quality', 0.31, null, 12, false, 'low', false, 'audio_class',     300)
) as c(class, confidence, bpm, age, fever, severity, escalate, reason, mins);

-- Verify
select severity, status, count(*) from alerts group by severity, status order by 1,2;
select payload->>'decisionReason' as reason, count(*) from audit_log
  where event_type='classification_complete' group by 1 order by 2 desc;
