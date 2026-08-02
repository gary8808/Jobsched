-- AIM CG v41: admin-only job values and employee internal hourly costs
create table if not exists public.employee_costs (
  worker_id uuid primary key references public.workers(id) on delete cascade,
  hourly_cost numeric(12,2),
  updated_at timestamptz not null default now()
);

create table if not exists public.job_financials (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  job_value numeric(14,2),
  updated_at timestamptz not null default now()
);

alter table public.employee_costs enable row level security;
alter table public.job_financials enable row level security;

grant select, insert, update, delete on public.employee_costs to authenticated;
grant select, insert, update, delete on public.job_financials to authenticated;

drop policy if exists "Admins manage employee costs" on public.employee_costs;
create policy "Admins manage employee costs" on public.employee_costs
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)));

drop policy if exists "Admins manage job financials" on public.job_financials;
create policy "Admins manage job financials" on public.job_financials
for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and coalesce(p.active,true)));
