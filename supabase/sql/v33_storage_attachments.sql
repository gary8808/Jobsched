-- Jobsched v33 - Supabase Storage attachments foundation

create extension if not exists "pgcrypto";

-- Storage buckets used by Jobsched. Private buckets are used; the app creates short-lived signed URLs for downloads.
insert into storage.buckets (id, name, public)
values
  ('job-photos', 'job-photos', false),
  ('job-files', 'job-files', false),
  ('accommodation-confirmations', 'accommodation-confirmations', false)
on conflict (id) do update set public = excluded.public;

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.jobs(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete set null,
  bucket text not null,
  object_path text not null,
  file_name text not null,
  mime_type text,
  size_bytes bigint default 0,
  attachment_type text not null default 'job_file',
  label text,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (bucket, object_path)
);

alter table public.attachments enable row level security;

grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on public.attachments to authenticated;
grant select, insert, update, delete on public.attachments to service_role;

-- Broad pilot policies. Tighten these before production launch.
drop policy if exists "Authenticated users can manage attachments during pilot" on public.attachments;
create policy "Authenticated users can manage attachments during pilot"
on public.attachments
for all
to authenticated
using (true)
with check (true);

-- Storage policies for pilot use. Tighten these before production launch so employees can only access files for assigned jobs.
drop policy if exists "Authenticated users can upload Jobsched files during pilot" on storage.objects;
create policy "Authenticated users can upload Jobsched files during pilot"
on storage.objects
for insert
to authenticated
with check (bucket_id in ('job-photos', 'job-files', 'accommodation-confirmations'));

drop policy if exists "Authenticated users can read Jobsched files during pilot" on storage.objects;
create policy "Authenticated users can read Jobsched files during pilot"
on storage.objects
for select
to authenticated
using (bucket_id in ('job-photos', 'job-files', 'accommodation-confirmations'));

drop policy if exists "Authenticated users can update Jobsched files during pilot" on storage.objects;
create policy "Authenticated users can update Jobsched files during pilot"
on storage.objects
for update
to authenticated
using (bucket_id in ('job-photos', 'job-files', 'accommodation-confirmations'))
with check (bucket_id in ('job-photos', 'job-files', 'accommodation-confirmations'));

drop policy if exists "Authenticated users can delete Jobsched files during pilot" on storage.objects;
create policy "Authenticated users can delete Jobsched files during pilot"
on storage.objects
for delete
to authenticated
using (bucket_id in ('job-photos', 'job-files', 'accommodation-confirmations'));
