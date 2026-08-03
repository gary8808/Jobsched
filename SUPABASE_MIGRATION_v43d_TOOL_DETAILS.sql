-- AIM CG v43d: optional purchase date and admin-only permanent deletion.
-- Safe to run more than once.

alter table public.tools
  add column if not exists purchase_date date;

grant delete on public.tools to authenticated;
grant delete on public.tool_transactions to authenticated;

alter table public.tools enable row level security;
alter table public.tool_transactions enable row level security;

drop policy if exists "Admins delete tools" on public.tools;
create policy "Admins delete tools"
on public.tools for delete to authenticated
using (public.aimcg_is_admin());

drop policy if exists "Admins delete tool history" on public.tool_transactions;
create policy "Admins delete tool history"
on public.tool_transactions for delete to authenticated
using (public.aimcg_is_admin());
