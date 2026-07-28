-- Jobsched v26 role-gating support
-- No mandatory SQL is required if your profiles.role values are already set to 'admin' or 'employee'.
-- Check/update Gary admin access with:
-- update public.profiles set role = 'admin', active = true where id = '<gary auth user id>';
-- Check/update an employee with:
-- update public.profiles set role = 'employee', active = true where id = '<employee auth user id>';

-- Optional helper view/check query:
select
  p.id,
  p.full_name,
  p.role,
  p.active,
  w.name as worker_name,
  w.email as worker_email,
  w.profile_id
from public.profiles p
left join public.workers w on w.profile_id = p.id
order by p.full_name nulls last;
