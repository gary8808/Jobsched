-- AIM CG v51: import housekeeping and machinery visibility for assigned trades.
-- Safe to run more than once.

begin;

alter table if exists public.fastfield_submissions
  add column if not exists is_cleared boolean not null default false,
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references auth.users(id) on delete set null;

alter table if exists public.job_pack_imports
  add column if not exists is_cleared boolean not null default false,
  add column if not exists cleared_at timestamptz,
  add column if not exists cleared_by uuid references auth.users(id) on delete set null;

create index if not exists fastfield_submissions_cleared_idx
  on public.fastfield_submissions (is_cleared, received_at desc);
create index if not exists job_pack_imports_cleared_idx
  on public.job_pack_imports (is_cleared, received_at desc);

-- A trade may need to display machinery that has since been made inactive or
-- out of service when it is already assigned to one of that trade's bookings.
drop policy if exists "Authenticated users can read active machinery" on public.machinery;
create policy "Authenticated users can read active machinery"
on public.machinery for select to authenticated
using (
  active = true
  or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true))
  or exists(
    select 1
    from public.machinery_bookings mb
    join public.workers w on w.id = mb.worker_id
    where mb.machine_id = machinery.id
      and w.profile_id = auth.uid()
      and w.inactive is distinct from true
      and w.access_revoked is distinct from true
  )
);

-- Admins may remove genuinely mistaken, unlinked imports from private storage.
drop policy if exists "Admins delete FastField closeouts" on storage.objects;
create policy "Admins delete FastField closeouts"
on storage.objects for delete to authenticated
using (bucket_id='fastfield-closeouts' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)));

drop policy if exists "Admins delete job pack imports" on storage.objects;
create policy "Admins delete job pack imports"
on storage.objects for delete to authenticated
using (bucket_id='job-pack-imports' and exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)));

notify pgrst, 'reload schema';
commit;
