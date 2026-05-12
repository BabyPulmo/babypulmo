-- ShishuKantho Supabase schema
-- Paste into Supabase SQL editor and run

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists postgis;

-- Caregivers (parents/guardians who use the system)
create table if not exists caregivers (
  id uuid primary key default uuid_generate_v4(),
  whatsapp_number text unique not null,
  name text,
  district text,
  preferred_language text default 'bn',
  created_at timestamptz default now()
);

-- Children (subjects being screened)
create table if not exists children (
  id uuid primary key default uuid_generate_v4(),
  caregiver_id uuid references caregivers(id) on delete cascade,
  name text,
  date_of_birth date,
  sex text check (sex in ('M', 'F', 'O')),
  created_at timestamptz default now()
);

-- CHWs (community health workers)
create table if not exists chws (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  whatsapp_number text unique not null,
  district text not null,
  location geography(point, 4326) not null,
  available boolean default true,
  rating numeric default 0,
  created_at timestamptz default now()
);

-- Audio recordings (raw uploads)
create table if not exists recordings (
  id uuid primary key default uuid_generate_v4(),
  caregiver_id uuid references caregivers(id),
  child_id uuid references children(id),
  storage_path text not null,        -- Supabase Storage key
  duration_sec numeric,
  sample_rate int,
  source text default 'whatsapp',    -- whatsapp | ivr | web
  created_at timestamptz default now()
);

-- Classifications (model output, immutable)
create table if not exists classifications (
  id uuid primary key default uuid_generate_v4(),
  recording_id uuid references recordings(id) on delete cascade,
  predicted_class text not null,     -- pneumonia | bronchiolitis | asthma | croup | pertussis | normal | insufficient_quality
  confidence numeric not null,       -- 0..1
  class_probs jsonb,                 -- full softmax distribution
  heatmap_url text,                  -- Grad-CAM spectrogram
  model_version text,
  inference_ms int,
  created_at timestamptz default now()
);

-- Guidance (Claude-generated Bangla advice, grounded in RAG)
create table if not exists guidance (
  id uuid primary key default uuid_generate_v4(),
  classification_id uuid references classifications(id) on delete cascade,
  bangla_text text not null,
  audio_url text,                    -- ElevenLabs Bangla audio
  retrieved_chunks jsonb,            -- {ids, titles, scores} of IMCI chunks used
  recommended_action text,           -- see_chw_now | see_doctor_24h | observe_24h | normal
  created_at timestamptz default now()
);

-- Alerts (CHW escalations — only created when rules-gated severity triggers)
create table if not exists alerts (
  id uuid primary key default uuid_generate_v4(),
  classification_id uuid references classifications(id),
  caregiver_id uuid references caregivers(id),
  chw_id uuid references chws(id),
  child_id uuid references children(id),
  severity text not null check (severity in ('critical', 'high', 'moderate')),
  caregiver_location geography(point, 4326),
  status text default 'pending' check (status in ('pending', 'acknowledged', 'resolved', 'failed')),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz default now()
);

-- Immutable audit log of every interaction (responsible AI requirement)
create table if not exists audit_log (
  id uuid primary key default uuid_generate_v4(),
  event_type text not null,
  payload jsonb not null,
  recording_id uuid,
  classification_id uuid,
  caregiver_id uuid,
  created_at timestamptz default now()
);

-- WHO IMCI knowledge chunks for RAG
create table if not exists imci_chunks (
  id uuid primary key default uuid_generate_v4(),
  source text not null,              -- who_imci | bd_dghs | unicef_pneumonia
  title text not null,
  age_range text,                    -- '0-2m' | '2m-5y' | etc
  body text not null,
  embedding vector(3072),            -- text-embedding-3-large
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_chws_location on chws using gist (location);
create index if not exists idx_chws_available on chws (available) where available = true;
create index if not exists idx_alerts_status on alerts (status, severity);
create index if not exists idx_imci_chunks_embedding on imci_chunks using ivfflat (embedding vector_cosine_ops);

-- Nearest available CHW function (Haversine via PostGIS)
create or replace function find_nearest_chw(
  caregiver_lat numeric,
  caregiver_lon numeric
)
returns table (
  chw_id uuid,
  chw_name text,
  chw_whatsapp text,
  distance_km numeric
)
language sql
stable
as $$
  select
    id as chw_id,
    name as chw_name,
    whatsapp_number as chw_whatsapp,
    round((st_distance(
      location::geography,
      st_setsrid(st_makepoint(caregiver_lon, caregiver_lat), 4326)::geography
    ) / 1000.0)::numeric, 2) as distance_km
  from chws
  where available = true
  order by location <-> st_setsrid(st_makepoint(caregiver_lon, caregiver_lat), 4326)::geography
  limit 1;
$$;

-- Seed 3 mock CHWs in Bogura district for demo
insert into chws (name, whatsapp_number, district, location, available, rating) values
  ('CHW Salma Begum', 'whatsapp:+8801711111111', 'Bogura', st_setsrid(st_makepoint(89.3719, 24.8463), 4326)::geography, true, 4.8),
  ('CHW Rashida Khatun', 'whatsapp:+8801722222222', 'Bogura', st_setsrid(st_makepoint(89.3850, 24.8500), 4326)::geography, true, 4.6),
  ('CHW Nasrin Akter', 'whatsapp:+8801733333333', 'Bogura', st_setsrid(st_makepoint(89.3650, 24.8400), 4326)::geography, true, 4.7)
on conflict (whatsapp_number) do nothing;

-- RLS (relax for demo; tighten before production)
alter table caregivers enable row level security;
alter table children enable row level security;
alter table chws enable row level security;
alter table recordings enable row level security;
alter table classifications enable row level security;
alter table guidance enable row level security;
alter table alerts enable row level security;
alter table audit_log enable row level security;
alter table imci_chunks enable row level security;

-- Allow service role (server-side) to do anything; deny anon writes
create policy "service role full access" on caregivers for all using (auth.role() = 'service_role');
create policy "service role full access" on children for all using (auth.role() = 'service_role');
create policy "service role full access" on chws for all using (auth.role() = 'service_role');
create policy "service role full access" on recordings for all using (auth.role() = 'service_role');
create policy "service role full access" on classifications for all using (auth.role() = 'service_role');
create policy "service role full access" on guidance for all using (auth.role() = 'service_role');
create policy "service role full access" on alerts for all using (auth.role() = 'service_role');
create policy "service role full access" on audit_log for all using (auth.role() = 'service_role');
create policy "service role full access" on imci_chunks for all using (auth.role() = 'service_role');

-- Allow anon read of alerts (for CHW dashboard demo)
create policy "anon read alerts" on alerts for select using (true);
create policy "anon read chws" on chws for select using (true);
