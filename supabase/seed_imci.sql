-- ShishuKantho — IMCI RAG seed
-- Adds the pgvector match function + a small set of sample chunks for demo.
-- For full production, run scripts/ingest_imci.ts to ingest the WHO IMCI handbook (~120 pages).

-- pgvector match function for RAG retrieval
create or replace function match_imci_chunks(
  query_embedding vector(3072),
  match_count int default 3,
  age_filter text default null
)
returns table (
  id uuid,
  source text,
  title text,
  age_range text,
  body text,
  similarity float
)
language sql
stable
as $$
  select
    imci_chunks.id,
    imci_chunks.source,
    imci_chunks.title,
    imci_chunks.age_range,
    imci_chunks.body,
    1 - (imci_chunks.embedding <=> query_embedding) as similarity
  from imci_chunks
  where age_filter is null or imci_chunks.age_range = age_filter or imci_chunks.age_range = 'all'
  order by imci_chunks.embedding <=> query_embedding
  limit match_count;
$$;

-- Sample IMCI chunks (without embeddings — populate via ingest script).
-- These are paraphrased from WHO IMCI public materials for demo purposes only.
insert into imci_chunks (source, title, age_range, body) values
  ('who_imci', 'Pneumonia: Severe — Chest Indrawing Signs', '2m-5y',
   'A child aged 2 months up to 5 years with cough or difficult breathing AND chest indrawing has severe pneumonia. URGENT: refer to hospital. Give first dose of intramuscular ampicillin or benzylpenicillin. Treat the child to prevent low blood sugar. Keep the child warm. Refer urgently.'),
  ('who_imci', 'Pneumonia: Fast Breathing Classification', '2m-5y',
   'A child with cough or difficult breathing with fast breathing (50+ breaths/minute for age 2m-12m, 40+ for age 12m-5y) without chest indrawing has pneumonia. Give amoxicillin for 5 days. Soothe the throat and relieve cough with safe remedy. Follow up in 3 days.'),
  ('who_imci', 'No Pneumonia: Cough or Cold', '2m-5y',
   'A child with cough or difficult breathing but NO fast breathing and NO chest indrawing has no pneumonia (cough or cold). If coughing for more than 14 days, refer for assessment of TB or asthma. Soothe the throat with a safe remedy. Advise mother when to return immediately.'),
  ('who_imci', 'Wheeze and Asthma Assessment', '2m-5y',
   'A child with wheezing should be assessed for asthma. If recurrent wheezing or first episode with no respiratory distress, give a trial of inhaled bronchodilator and reassess after 15-30 minutes. Severe wheeze with chest indrawing requires referral.'),
  ('who_imci', 'Stridor and Severe Croup', '2m-5y',
   'A child with stridor when calm has severe croup. Treat with single dose oral dexamethasone or inhaled budesonide. If severe respiratory distress with stridor, refer urgently to hospital for nebulized adrenaline.'),
  ('who_imci', 'Pertussis (Whooping Cough) Suspect', '0-5y',
   'Paroxysmal cough with inspiratory whoop, post-tussive vomiting, or apnoea in infants suggests pertussis. Give macrolide antibiotic (azithromycin or erythromycin). Infants under 6 months with apnoea require hospital admission. Notify public health for contact tracing.'),
  ('bd_dghs', 'Bangladesh DGHS — Pneumonia Treatment Protocol', '2m-5y',
   'According to Bangladesh DGHS Standard Treatment Guidelines, all children with pneumonia should receive oral amoxicillin 40mg/kg BD for 5 days. Severe pneumonia cases must be referred to upazila health complex or higher. Community health workers are authorized to give the first dose and refer.'),
  ('bd_dghs', 'Danger Signs Requiring Immediate Referral', 'all',
   'Any child with any of these danger signs needs urgent referral: not able to drink or breastfeed, vomits everything, convulsions, lethargic or unconscious, severe chest indrawing, oxygen saturation below 90%. Refer immediately to nearest hospital.'),
  ('unicef', 'Family Counselling: When to Return', 'all',
   'Counsel the mother to return immediately if: child cannot drink or breastfeed, child becomes sicker, child develops fever, child has fast or difficult breathing, or child has blood in stool. For uncomplicated cough, follow up in 5 days.'),
  ('who_imci', 'Normal Cough Reassurance', '2m-5y',
   'A child with mild cough, no fast breathing, no chest indrawing, eating and drinking normally, and active does not need antibiotics. Provide reassurance to the caregiver. Honey can be used as a safe cough soother for children over 1 year. Avoid over-the-counter cough syrups in young children.');
