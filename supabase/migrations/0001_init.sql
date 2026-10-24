-- Feedla shared backend. Run once in Supabase SQL Editor.
-- Prototype: no sign-in yet, so data tables allow anon access via the publishable key.
-- Replace these policies with user-based ones once auth is added.

create table if not exists public.babies (
  id                            text primary key,
  owner_user_id                 text,
  name                          text not null,
  date_of_birth                 text not null,
  premature_status              text not null default 'unknown'
                                check (premature_status in ('yes', 'no', 'unknown')),
  clinician_feeding_plan_status text not null default 'unknown'
                                check (clinician_feeding_plan_status in ('yes', 'no', 'unknown')),
  created_at                    bigint not null,
  updated_at                    bigint not null,
  deleted_at                    bigint,
  server_version                integer not null default 0 check (server_version >= 0)
);

create table if not exists public.baby_members (
  baby_id   text not null references public.babies(id) on delete cascade,
  user_id   text not null,
  role      text not null check (role in ('owner', 'caregiver')),
  joined_at bigint not null,
  primary key (baby_id, user_id)
);

create table if not exists public.weights (
  id               text primary key,
  baby_id          text not null references public.babies(id) on delete cascade,
  weight_kg        real not null check (weight_kg > 0),
  measurement_date text not null,
  created_at       bigint not null,
  updated_at       bigint not null,
  deleted_at       bigint,
  server_version   integer not null default 0 check (server_version >= 0)
);

create table if not exists public.activities (
  id                 text primary key,
  baby_id            text not null references public.babies(id) on delete cascade,
  milk_ml            integer check (milk_ml is null or milk_ml > 0),
  pee_level          integer check (pee_level is null or pee_level between 1 and 5),
  poop_level         integer check (poop_level is null or poop_level between 1 and 5),
  bath               integer not null default 0 check (bath in (0, 1)),
  occurred_at        bigint not null,
  created_by_user_id text,
  updated_by_user_id text,
  created_at         bigint not null,
  updated_at         bigint not null,
  deleted_at         bigint,
  server_version     integer not null default 0 check (server_version >= 0),
  check (milk_ml is not null or pee_level is not null or poop_level is not null or bath = 1)
);

alter table public.babies enable row level security;
alter table public.baby_members enable row level security;
alter table public.weights enable row level security;
alter table public.activities enable row level security;

create policy "prototype anon access babies" on public.babies
  for all to anon using (true) with check (true);
create policy "prototype anon access baby_members" on public.baby_members
  for all to anon using (true) with check (true);
create policy "prototype anon access weights" on public.weights
  for all to anon using (true) with check (true);
create policy "prototype anon access activities" on public.activities
  for all to anon using (true) with check (true);

-- Join by invite code. Code = first 6 characters of the baby id, uppercased (matches inviteCodeFor in the app).
create or replace function public.join_baby_by_code(p_code text, p_user_id text)
returns public.babies
language plpgsql
security definer
set search_path = public
as $$
declare
  b public.babies;
begin
  select * into b
  from public.babies
  where deleted_at is null
    and upper(left(id, 6)) = upper(p_code)
  order by created_at
  limit 1;

  if not found then
    raise exception 'invalid_code' using errcode = 'P0002';
  end if;

  insert into public.baby_members (baby_id, user_id, role, joined_at)
  values (b.id, p_user_id, 'caregiver', (extract(epoch from now()) * 1000)::bigint)
  on conflict (baby_id, user_id) do nothing;

  return b;
end;
$$;

grant execute on function public.join_baby_by_code(text, text) to anon;
