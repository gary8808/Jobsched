-- AIM CG v43b: diagnostic only. This query does not change data.
-- Run in Supabase SQL Editor to confirm each login is linked to the correct worker.

select
  w.id as worker_id,
  w.name as worker_name,
  w.trade,
  w.email as worker_email,
  w.profile_id,
  u.email as login_email,
  p.full_name as profile_name,
  p.role as login_role,
  p.active as profile_active,
  w.inactive as worker_inactive
from public.workers w
left join auth.users u on u.id = w.profile_id
left join public.profiles p on p.id = w.profile_id
order by lower(w.name), lower(coalesce(w.trade, ''));

-- Also check for duplicate links. A profile_id should normally appear once.
select
  profile_id,
  count(*) as linked_worker_count,
  string_agg(name || coalesce(' (' || trade || ')', ''), ', ' order by name) as linked_workers
from public.workers
where profile_id is not null
group by profile_id
having count(*) > 1;
