-- AIM CG v43a: repair Tool Register persistence and permissions.
-- Safe to run more than once.

create or replace function public.aimcg_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.active, true)
  );
$$;

revoke all on function public.aimcg_is_admin() from public;
grant execute on function public.aimcg_is_admin() to authenticated;

grant select, insert, update on public.tools to authenticated;
grant select, insert on public.tool_transactions to authenticated;

alter table public.tools enable row level security;
alter table public.tool_transactions enable row level security;

drop policy if exists "Authenticated users can read tools" on public.tools;
drop policy if exists "Admins manage tools" on public.tools;
drop policy if exists "Trades sign out available tools" on public.tools;

create policy "Authenticated users can read tools"
on public.tools for select to authenticated
using (true);

create policy "Admins insert tools"
on public.tools for insert to authenticated
with check (public.aimcg_is_admin());

create policy "Admins update tools"
on public.tools for update to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());

create policy "Trades update own tool allocation"
on public.tools for update to authenticated
using (
  status = 'available'
  or assigned_worker_id in (
    select w.id from public.workers w where w.profile_id = auth.uid()
  )
)
with check (
  status in ('available', 'signed_out', 'out_of_service')
  and (
    assigned_worker_id is null
    or assigned_worker_id in (
      select w.id from public.workers w where w.profile_id = auth.uid()
    )
  )
);

drop policy if exists "Authenticated users read tool history" on public.tool_transactions;
drop policy if exists "Authenticated users create tool history" on public.tool_transactions;

create policy "Authenticated users read tool history"
on public.tool_transactions for select to authenticated
using (true);

create policy "Authenticated users create tool history"
on public.tool_transactions for insert to authenticated
with check (
  public.aimcg_is_admin()
  or worker_id in (select w.id from public.workers w where w.profile_id = auth.uid())
  or from_worker_id in (select w.id from public.workers w where w.profile_id = auth.uid())
);
