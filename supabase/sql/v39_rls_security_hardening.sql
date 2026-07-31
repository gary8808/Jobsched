-- Jobsched v39 - RLS/security hardening
-- Run after v38 is deployed and tested.
-- This replaces broad pilot policies with role-based policies.
-- Keep a database backup/snapshot before running.

create extension if not exists "pgcrypto";

grant usage on schema public to authenticated, service_role;
revoke usage on schema public from anon;

-- Remove the early temporary public worker read test, if it still exists.
drop policy if exists "Temporary public read workers for connection test" on public.workers;
revoke select on public.workers from anon;

-- Helper functions used by RLS policies.
create or replace function public.jobsched_current_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select role from public.profiles where id = auth.uid() and active = true), 'employee');
$$;

create or replace function public.jobsched_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.jobsched_current_role() = 'admin';
$$;

create or replace function public.jobsched_current_worker_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from public.workers where profile_id = auth.uid() and inactive = false limit 1;
$$;

grant execute on function public.jobsched_current_role() to authenticated;
grant execute on function public.jobsched_is_admin() to authenticated;
grant execute on function public.jobsched_current_worker_id() to authenticated;

-- Enable RLS on core tables.
alter table public.profiles enable row level security;
alter table public.workers enable row level security;
alter table public.jobs enable row level security;
alter table public.job_bookings enable row level security;
alter table public.job_notes enable row level security;
alter table public.job_history enable row level security;

-- Drop broad pilot policies from earlier builds.
drop policy if exists "Authenticated users can read profiles" on public.profiles;
drop policy if exists "Authenticated users can manage profiles during pilot" on public.profiles;
drop policy if exists "Authenticated users can read workers" on public.workers;
drop policy if exists "Authenticated users can manage workers during pilot" on public.workers;
drop policy if exists "Authenticated users can read jobs" on public.jobs;
drop policy if exists "Authenticated users can manage jobs during pilot" on public.jobs;
drop policy if exists "Authenticated users can manage bookings during pilot" on public.job_bookings;
drop policy if exists "Authenticated users can manage notes during pilot" on public.job_notes;
drop policy if exists "Authenticated users can manage history during pilot" on public.job_history;

-- Profiles: admins can see/manage all; users can see their own profile.
create policy "profiles_select_admin_or_self"
on public.profiles
for select
to authenticated
using (public.jobsched_is_admin() or id = auth.uid());

create policy "profiles_manage_admin"
on public.profiles
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- Workers: admins can manage all; employees can read their own worker row.
create policy "workers_select_admin_or_self"
on public.workers
for select
to authenticated
using (public.jobsched_is_admin() or profile_id = auth.uid());

create policy "workers_manage_admin"
on public.workers
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- Jobs: admins can manage all. Employees can read/update jobs assigned to their worker.
-- Employee update is allowed during the pilot because completions/status currently update the job payload.
-- Tighten this later once completion/time-entry tables are fully separated.
create policy "jobs_select_admin_or_assigned"
on public.jobs
for select
to authenticated
using (
  public.jobsched_is_admin()
  or exists (
    select 1
    from public.job_bookings b
    where b.job_id = jobs.id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "jobs_insert_admin"
on public.jobs
for insert
to authenticated
with check (public.jobsched_is_admin());

create policy "jobs_update_admin_or_assigned_pilot"
on public.jobs
for update
to authenticated
using (
  public.jobsched_is_admin()
  or exists (
    select 1
    from public.job_bookings b
    where b.job_id = jobs.id
      and b.worker_id = public.jobsched_current_worker_id()
  )
)
with check (
  public.jobsched_is_admin()
  or exists (
    select 1
    from public.job_bookings b
    where b.job_id = jobs.id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "jobs_delete_admin"
on public.jobs
for delete
to authenticated
using (public.jobsched_is_admin());

-- Bookings: admins manage all; employees read their own bookings.
create policy "bookings_select_admin_or_self"
on public.job_bookings
for select
to authenticated
using (public.jobsched_is_admin() or worker_id = public.jobsched_current_worker_id());

create policy "bookings_manage_admin"
on public.job_bookings
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- Notes: admins can manage all. Employees can add/read notes for assigned jobs.
create policy "notes_select_admin_or_assigned"
on public.job_notes
for select
to authenticated
using (
  public.jobsched_is_admin()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_notes.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "notes_insert_admin_or_assigned"
on public.job_notes
for insert
to authenticated
with check (
  public.jobsched_is_admin()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_notes.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "notes_update_delete_admin"
on public.job_notes
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- History: admins can read/manage all. Employees can read assigned job history and insert status/completion history.
create policy "history_select_admin_or_assigned"
on public.job_history
for select
to authenticated
using (
  public.jobsched_is_admin()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_history.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "history_insert_admin_or_assigned"
on public.job_history
for insert
to authenticated
with check (
  public.jobsched_is_admin()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_history.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

create policy "history_update_delete_admin"
on public.job_history
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- Messages: admin-only in the app. ClickSend Edge Functions use service role and bypass normal user RLS.
do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'alter table public.messages enable row level security';
    execute 'drop policy if exists "Authenticated users can read messages during pilot" on public.messages';
    execute 'drop policy if exists "Authenticated users can manage messages during pilot" on public.messages';
    execute 'drop policy if exists "Service role can manage messages" on public.messages';
    execute 'create policy "messages_admin_all" on public.messages for all to authenticated using (public.jobsched_is_admin()) with check (public.jobsched_is_admin())';
  end if;
end $$;

-- Attachments metadata: admins manage all; employees can read/insert attachments for assigned jobs.
do $$
begin
  if to_regclass('public.attachments') is not null then
    execute 'alter table public.attachments enable row level security';
    execute 'drop policy if exists "Authenticated users can manage attachments during pilot" on public.attachments';
    execute 'create policy "attachments_select_admin_or_assigned" on public.attachments for select to authenticated using (public.jobsched_is_admin() or exists (select 1 from public.job_bookings b where b.job_id = attachments.job_id and b.worker_id = public.jobsched_current_worker_id()))';
    execute 'create policy "attachments_insert_admin_or_assigned" on public.attachments for insert to authenticated with check (public.jobsched_is_admin() or exists (select 1 from public.job_bookings b where b.job_id = attachments.job_id and b.worker_id = public.jobsched_current_worker_id()))';
    execute 'create policy "attachments_update_delete_admin" on public.attachments for all to authenticated using (public.jobsched_is_admin()) with check (public.jobsched_is_admin())';
  end if;
end $$;

-- Keep grants available to authenticated users and Edge Functions.
grant select, insert, update, delete on public.profiles to authenticated, service_role;
grant select, insert, update, delete on public.workers to authenticated, service_role;
grant select, insert, update, delete on public.jobs to authenticated, service_role;
grant select, insert, update, delete on public.job_bookings to authenticated, service_role;
grant select, insert, update, delete on public.job_notes to authenticated, service_role;
grant select, insert, update, delete on public.job_history to authenticated, service_role;

do $$
begin
  if to_regclass('public.messages') is not null then
    execute 'grant select, insert, update, delete on public.messages to authenticated, service_role';
  end if;
  if to_regclass('public.attachments') is not null then
    execute 'grant select, insert, update, delete on public.attachments to authenticated, service_role';
  end if;
end $$;
