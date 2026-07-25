-- Jobsched v24 - support app roles and invite status on workers
alter table public.workers add column if not exists app_role text not null default 'employee';
alter table public.workers add column if not exists invite_requested boolean not null default false;
alter table public.workers add column if not exists invite_status text;
alter table public.workers add column if not exists invited_at timestamptz;

-- Keep roles restricted to the two current app options.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'workers_app_role_check'
  ) then
    alter table public.workers
      add constraint workers_app_role_check
      check (app_role in ('admin', 'employee'));
  end if;
end $$;

-- Make sure the app can read/write the new columns under the existing pilot policies.
grant select, insert, update, delete on public.workers to authenticated;
grant select, insert, update on public.profiles to authenticated;

-- Confirm Gary/admin has an admin profile already. Replace the email if needed and run this again if required.
-- insert into public.profiles (id, full_name, role, active)
-- select id, 'Gary', 'admin', true
-- from auth.users
-- where email = 'YOUR_EMAIL_HERE'
-- on conflict (id) do update set role = 'admin', active = true;
