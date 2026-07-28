-- Jobsched v29 - Supabase jobs and booking sync foundation
-- Run this after the earlier v24 user/invite setup.

alter table public.jobs add column if not exists app_payload jsonb not null default '{}'::jsonb;

-- Existing table should already have updated_at, but this keeps older test databases safe.
alter table public.jobs add column if not exists updated_at timestamptz not null default now();
alter table public.job_bookings add column if not exists updated_at timestamptz not null default now();

-- The app stores the full local job shape in app_payload for now while the backend is being phased in.
-- Core searchable fields remain normal columns.
create index if not exists jobs_category_idx on public.jobs (category);
create index if not exists jobs_updated_at_idx on public.jobs (updated_at desc);
create index if not exists job_bookings_job_id_idx on public.job_bookings (job_id);
create index if not exists job_bookings_worker_dates_idx on public.job_bookings (worker_id, start_date, end_date);

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.jobs to authenticated;
grant select, insert, update, delete on public.job_bookings to authenticated;
grant select, insert, update, delete on public.job_notes to authenticated;
grant select, insert, update, delete on public.job_history to authenticated;

grant usage on schema public to service_role;
grant select, insert, update, delete on public.jobs to service_role;
grant select, insert, update, delete on public.job_bookings to service_role;
grant select, insert, update, delete on public.job_notes to service_role;
grant select, insert, update, delete on public.job_history to service_role;
