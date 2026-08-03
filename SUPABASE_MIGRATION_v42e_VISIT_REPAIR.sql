-- AIM CG v42e: durable visit history and one-time repair of existing defects jobs.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.job_visit_history (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  visit_key text not null,
  visit_type text not null default 'rescheduled',
  start_date date,
  end_date date,
  assigned_to uuid[] not null default '{}',
  worker_status jsonb not null default '{}'::jsonb,
  worker_completions jsonb not null default '{}'::jsonb,
  total_ms bigint not null default 0,
  completed_confirmed boolean not null default false,
  archived_at timestamptz not null default now(),
  snapshot jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique(job_id, visit_key)
);

alter table public.job_visit_history enable row level security;
grant select, insert, update on public.job_visit_history to authenticated;

drop policy if exists "Admins manage job visit history" on public.job_visit_history;
create policy "Admins manage job visit history"
on public.job_visit_history
for all to authenticated
using (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.active, true)
  )
)
with check (
  exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.active, true)
  )
);

-- Archive the currently-carried completion/time for defects jobs before resetting it.
insert into public.job_visit_history (
  job_id, visit_key, visit_type, start_date, end_date, assigned_to,
  worker_status, worker_completions, total_ms, completed_confirmed, archived_at, snapshot
)
select
  j.id,
  'legacy-before-defect-reset-' || j.id::text,
  'defects_callback_legacy_repair',
  nullif(j.app_payload->>'startDate','')::date,
  nullif(coalesce(j.app_payload->>'endDate', j.app_payload->>'startDate'),'')::date,
  coalesce(array(select jsonb_array_elements_text(coalesce(j.app_payload->'assignedTo','[]'::jsonb))::uuid), '{}'),
  coalesce(j.app_payload->'workerStatus','{}'::jsonb),
  coalesce(j.app_payload->'workerCompletions','{}'::jsonb),
  coalesce((select sum(coalesce((value->>'totalMs')::bigint,0)) from jsonb_each(coalesce(j.app_payload->'workerStatus','{}'::jsonb))),0),
  true,
  now(),
  jsonb_build_object('source','v42e legacy defect repair','app_payload',j.app_payload)
from public.jobs j
where coalesce((j.app_payload->>'isDefectCallback')::boolean,false) = true
on conflict (job_id, visit_key) do nothing;

-- Give every existing defects job a fresh current visit and reset only the current visit state.
with repaired as (
  select id, gen_random_uuid()::text as new_visit_id, now() as reset_at
  from public.jobs
  where coalesce((app_payload->>'isDefectCallback')::boolean,false) = true
)
update public.jobs j
set
  completed_confirmed = false,
  category = 'Scheduled',
  app_payload = jsonb_set(
    jsonb_set(
      jsonb_set(
        jsonb_set(
          jsonb_set(coalesce(j.app_payload,'{}'::jsonb), '{currentVisitId}', to_jsonb(r.new_visit_id), true),
          '{currentVisitStartedAt}', to_jsonb(r.reset_at::text), true
        ),
        '{workerStatus}', '{}'::jsonb, true
      ),
      '{workerCompletions}', '{}'::jsonb, true
    ),
    '{completedConfirmed}', 'false'::jsonb, true
  ),
  updated_at = now()
from repaired r
where j.id = r.id;

-- Reset the live booking rows for the repaired current defects visit.
with current_visits as (
  select id, app_payload->>'currentVisitId' as visit_id
  from public.jobs
  where coalesce((app_payload->>'isDefectCallback')::boolean,false) = true
)
update public.job_bookings jb
set
  booking_status = 'notStarted',
  total_ms = 0,
  running_since = null,
  status_updated_at = now(),
  visit_id = cv.visit_id,
  updated_at = now()
from current_visits cv
where jb.job_id = cv.id;

comment on table public.job_visit_history is
  'Archived job visits, including previous labour, status and completion information retained when a job is rescheduled or returned for defects.';
