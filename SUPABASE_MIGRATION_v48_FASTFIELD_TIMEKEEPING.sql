-- AIM CG v48: FastField close-out intake and editable daily labour sessions.
-- Safe to run more than once.

create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public)
values ('fastfield-closeouts', 'fastfield-closeouts', false)
on conflict (id) do update set public = excluded.public;

create table if not exists public.fastfield_submissions (
  id uuid primary key default gen_random_uuid(),
  external_submission_id text not null unique,
  form_name text,
  form_id text,
  job_id uuid references public.jobs(id) on delete set null,
  raw_job_number text,
  normalised_job_number text,
  work_order_number text,
  reference_text text,
  submitted_by_email text,
  submitted_by_name text,
  submitted_at timestamptz,
  overall_job_complete boolean,
  trade_work_complete boolean,
  further_work_identified boolean not null default false,
  further_work_text text,
  additional_trade_required boolean,
  required_trade text,
  supervisor_checked boolean,
  closeout_summary jsonb not null default '{}'::jsonb,
  raw_payload jsonb not null default '{}'::jsonb,
  processing_status text not null default 'received',
  match_status text not null default 'unmatched',
  pdf_bucket text,
  pdf_object_path text,
  pdf_file_name text,
  attachment_id uuid references public.attachments(id) on delete set null,
  error_message text,
  received_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists fastfield_submissions_match_idx
  on public.fastfield_submissions (match_status, received_at desc);
create index if not exists fastfield_submissions_job_idx
  on public.fastfield_submissions (job_id, submitted_at desc);
create index if not exists fastfield_submissions_normalised_job_idx
  on public.fastfield_submissions (normalised_job_number, work_order_number);

alter table public.fastfield_submissions enable row level security;
grant select, insert, update, delete on public.fastfield_submissions to authenticated;
grant all on public.fastfield_submissions to service_role;

drop policy if exists "Admins manage FastField submissions" on public.fastfield_submissions;
create policy "Admins manage FastField submissions"
on public.fastfield_submissions
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)));

-- The Edge Function writes with the service role. Admins can read the private PDFs.
drop policy if exists "Admins read FastField closeouts" on storage.objects;
create policy "Admins read FastField closeouts"
on storage.objects for select to authenticated
using (
  bucket_id = 'fastfield-closeouts'
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true))
);

create table if not exists public.job_time_entries (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid not null references public.workers(id) on delete cascade,
  booking_id uuid references public.job_bookings(id) on delete set null,
  started_at timestamptz not null,
  ended_at timestamptz,
  duration_ms bigint not null default 0,
  source text not null default 'app_status',
  edited_by uuid references auth.users(id) on delete set null,
  edit_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists job_time_entries_job_idx on public.job_time_entries(job_id, started_at desc);
create index if not exists job_time_entries_worker_idx on public.job_time_entries(worker_id, started_at desc);
create unique index if not exists job_time_entries_one_open_session
  on public.job_time_entries(job_id, worker_id)
  where ended_at is null;

alter table public.job_time_entries enable row level security;
grant select, insert, update, delete on public.job_time_entries to authenticated;
grant all on public.job_time_entries to service_role;

drop policy if exists "Admins manage time entries" on public.job_time_entries;
create policy "Admins manage time entries" on public.job_time_entries
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)));

drop policy if exists "Employees read own time entries" on public.job_time_entries;
create policy "Employees read own time entries" on public.job_time_entries
for select to authenticated
using (exists (select 1 from public.workers w where w.id = job_time_entries.worker_id and w.profile_id = auth.uid()));

create or replace function public.aimcg_record_time_transition(
  p_job_id uuid,
  p_worker_id uuid,
  p_next_status text,
  p_transition_at timestamptz default now()
) returns void
language plpgsql security definer set search_path = public
as $$
declare
  v_booking_id uuid;
  v_open_id uuid;
  v_start timestamptz;
begin
  if not (
    exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true))
    or exists (select 1 from workers w join job_bookings jb on jb.worker_id=w.id and jb.job_id=p_job_id where w.id=p_worker_id and w.profile_id=auth.uid())
  ) then raise exception 'Not permitted'; end if;

  select id into v_booking_id from job_bookings where job_id=p_job_id and worker_id=p_worker_id order by updated_at desc nulls last limit 1;
  select id, started_at into v_open_id, v_start from job_time_entries where job_id=p_job_id and worker_id=p_worker_id and ended_at is null order by started_at desc limit 1;

  if lower(p_next_status) in ('running','onsite') then
    if v_open_id is null then
      insert into job_time_entries(job_id,worker_id,booking_id,started_at,source)
      values(p_job_id,p_worker_id,v_booking_id,p_transition_at,'app_status');
    end if;
  else
    if v_open_id is not null then
      update job_time_entries set ended_at=p_transition_at,
        duration_ms=greatest(0, floor(extract(epoch from (p_transition_at-v_start))*1000)::bigint),
        updated_at=now()
      where id=v_open_id;
    end if;
  end if;
end $$;

grant execute on function public.aimcg_record_time_transition(uuid,uuid,text,timestamptz) to authenticated;

create or replace function public.aimcg_update_time_entry(
  p_entry_id uuid,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_reason text default null
) returns void
language plpgsql security definer set search_path = public
as $$
declare v_entry job_time_entries%rowtype;
begin
  if not exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)) then
    raise exception 'Admin permission required';
  end if;
  if p_ended_at is not null and p_ended_at < p_started_at then raise exception 'End time cannot be before start time'; end if;
  select * into v_entry from job_time_entries where id=p_entry_id;
  if not found then raise exception 'Time entry not found'; end if;
  update job_time_entries set started_at=p_started_at, ended_at=p_ended_at,
    duration_ms=case when p_ended_at is null then 0 else greatest(0,floor(extract(epoch from (p_ended_at-p_started_at))*1000)::bigint) end,
    edited_by=auth.uid(), edit_reason=nullif(trim(p_reason),''), updated_at=now()
  where id=p_entry_id;
  update job_bookings jb set total_ms = coalesce((
    select sum(case when e.ended_at is null then greatest(0,floor(extract(epoch from (now()-e.started_at))*1000)::bigint) else e.duration_ms end)
    from job_time_entries e where e.job_id=v_entry.job_id and e.worker_id=v_entry.worker_id
  ),0), updated_at=now()
  where jb.job_id=v_entry.job_id and jb.worker_id=v_entry.worker_id;
  insert into job_history(job_id,action,details,created_by)
  values(v_entry.job_id,'Labour time edited',concat('Time entry adjusted. Reason: ',coalesce(nullif(trim(p_reason),''),'Not supplied')),auth.uid());
end $$;

grant execute on function public.aimcg_update_time_entry(uuid,timestamptz,timestamptz,text) to authenticated;

create or replace function public.aimcg_match_fastfield_submission(p_submission_id uuid, p_job_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare v fastfield_submissions%rowtype; v_attachment uuid;
begin
  if not exists (select 1 from profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)) then raise exception 'Admin permission required'; end if;
  select * into v from fastfield_submissions where id=p_submission_id;
  if not found then raise exception 'Submission not found'; end if;
  if not exists(select 1 from jobs where id=p_job_id) then raise exception 'Job not found'; end if;
  if v.pdf_bucket is not null and v.pdf_object_path is not null then
    insert into attachments(job_id,bucket,object_path,file_name,mime_type,size_bytes,attachment_type,label,uploaded_by)
    values(p_job_id,v.pdf_bucket,v.pdf_object_path,coalesce(v.pdf_file_name,'FastField close-out.pdf'),'application/pdf',0,'fastfield_closeout','FastField Job Close-Out',auth.uid())
    on conflict(bucket,object_path) do update set job_id=excluded.job_id
    returning id into v_attachment;
  end if;
  update fastfield_submissions set job_id=p_job_id, match_status='matched', processing_status=case when v.pdf_object_path is null then 'pdf_pending' else 'attached' end,
    attachment_id=coalesce(v_attachment,attachment_id), error_message=null, updated_at=now() where id=p_submission_id;
  insert into job_history(job_id,action,details,created_by) values(p_job_id,'FastField close-out matched',concat('FastField submission ',v.external_submission_id,' manually linked to this job.'),auth.uid());
end $$;

grant execute on function public.aimcg_match_fastfield_submission(uuid,uuid) to authenticated;

-- Add both tables to Realtime where supported.
do $$ begin
  alter publication supabase_realtime add table public.fastfield_submissions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_time_entries;
exception when duplicate_object then null; end $$;

notify pgrst, 'reload schema';
