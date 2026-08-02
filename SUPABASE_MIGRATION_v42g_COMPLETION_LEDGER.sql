-- AIM CG v42g: durable employee completion ledger.
-- This is the source of truth for completion notes and Admin Confirm Complete.
-- Safe to run more than once.

create extension if not exists pgcrypto;

create table if not exists public.job_completion_submissions (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  visit_id text not null default 'original',
  worker_id uuid not null references public.workers(id) on delete cascade,
  completion_description text not null default '',
  materials_used text not null default '',
  requires_another_trade boolean not null default false,
  follow_up_trade text,
  submitted_by uuid references auth.users(id) on delete set null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (job_id, visit_id, worker_id)
);

create index if not exists job_completion_submissions_job_visit_idx
  on public.job_completion_submissions (job_id, visit_id, submitted_at desc);

alter table public.job_completion_submissions enable row level security;

grant select, insert, update on public.job_completion_submissions to authenticated;

-- Admins can read and manage every completion submission.
drop policy if exists "Admins manage completion submissions" on public.job_completion_submissions;
create policy "Admins manage completion submissions"
on public.job_completion_submissions
for all
to authenticated
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

-- Employees can read their own submissions.
drop policy if exists "Employees read own completion submissions" on public.job_completion_submissions;
create policy "Employees read own completion submissions"
on public.job_completion_submissions
for select
to authenticated
using (
  exists (
    select 1
    from public.workers w
    where w.id = job_completion_submissions.worker_id
      and w.profile_id = auth.uid()
  )
);

-- Employees can create a submission only for themselves and a job booking
-- currently assigned to their worker record.
drop policy if exists "Employees create own completion submissions" on public.job_completion_submissions;
create policy "Employees create own completion submissions"
on public.job_completion_submissions
for insert
to authenticated
with check (
  exists (
    select 1
    from public.workers w
    join public.job_bookings jb
      on jb.worker_id = w.id
     and jb.job_id = job_completion_submissions.job_id
    where w.id = job_completion_submissions.worker_id
      and w.profile_id = auth.uid()
      and (
        coalesce(jb.visit_id, 'original') = job_completion_submissions.visit_id
        or job_completion_submissions.visit_id = 'original'
      )
  )
);

-- Employees can revise their own current submission.
drop policy if exists "Employees update own completion submissions" on public.job_completion_submissions;
create policy "Employees update own completion submissions"
on public.job_completion_submissions
for update
to authenticated
using (
  exists (
    select 1
    from public.workers w
    where w.id = job_completion_submissions.worker_id
      and w.profile_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.workers w
    join public.job_bookings jb
      on jb.worker_id = w.id
     and jb.job_id = job_completion_submissions.job_id
    where w.id = job_completion_submissions.worker_id
      and w.profile_id = auth.uid()
      and (
        coalesce(jb.visit_id, 'original') = job_completion_submissions.visit_id
        or job_completion_submissions.visit_id = 'original'
      )
  )
);

-- Backfill completion submissions from existing job notes where possible.
-- DISTINCT ON keeps the latest note for each job / visit / worker.
insert into public.job_completion_submissions (
  job_id,
  visit_id,
  worker_id,
  completion_description,
  materials_used,
  requires_another_trade,
  submitted_by,
  submitted_at,
  updated_at
)
select distinct on (n.job_id, coalesce(n.visit_id, 'original'), n.worker_id)
  n.job_id,
  coalesce(n.visit_id, 'original'),
  n.worker_id,
  coalesce(n.note_text, ''),
  '',
  n.note_type = 'completion_follow_up',
  n.created_by,
  n.created_at,
  n.created_at
from public.job_notes n
where n.worker_id is not null
  and n.note_type in ('completion', 'completion_follow_up')
order by n.job_id, coalesce(n.visit_id, 'original'), n.worker_id, n.created_at desc
on conflict (job_id, visit_id, worker_id) do nothing;

comment on table public.job_completion_submissions is
  'Durable per-worker, per-visit completion updates used by Admin notes and Confirm Complete.';
