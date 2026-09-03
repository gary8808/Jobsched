-- AIM Jobsched v53 - Warehouse role constraint fix
-- Run once in Supabase SQL Editor.
-- The original workers_app_role_check only allowed 'admin' and 'employee'.

begin;

alter table public.workers
  drop constraint if exists workers_app_role_check;

alter table public.workers
  add constraint workers_app_role_check
  check (app_role in ('admin', 'employee', 'warehouse'));

-- Defensive: if an older project has a profiles_role_check constraint with the
-- same two-role restriction, expand that one as well. This block only changes
-- a constraint named profiles_role_check; otherwise it does nothing.
do $$
begin
  if exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'profiles'
      and c.conname = 'profiles_role_check'
  ) then
    alter table public.profiles
      drop constraint profiles_role_check;

    alter table public.profiles
      add constraint profiles_role_check
      check (role in ('admin', 'employee', 'warehouse'));
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
