-- Drops the premature and doctor-plan columns no longer used by the app. Run once in Supabase SQL Editor.
alter table public.babies
  drop column if exists premature_status,
  drop column if exists clinician_feeding_plan_status;
