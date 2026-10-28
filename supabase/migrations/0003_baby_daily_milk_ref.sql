-- Adds the exact daily milk reference (ml) set in the baby profile. Run once in Supabase SQL Editor.
alter table public.babies
  add column if not exists daily_milk_ref_ml integer check (daily_milk_ref_ml > 0);
