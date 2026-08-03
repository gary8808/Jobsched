-- AIM CG v43: per-note Trade View visibility and Tool Register
alter table if exists public.job_notes
  add column if not exists show_in_trade_view boolean not null default false;

create table if not exists public.tools (
  id uuid primary key default gen_random_uuid(),
  description text not null,
  tool_id text not null unique,
  serial_number text,
  brand_model text,
  status text not null default 'available' check (status in ('available','signed_out','out_of_service','lost','inactive')),
  assigned_worker_id uuid references public.workers(id) on delete set null,
  signed_out_at timestamptz,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tool_transactions (
  id uuid primary key default gen_random_uuid(),
  tool_id uuid not null references public.tools(id) on delete cascade,
  action text not null check (action in ('created','updated','sign_out','return','transfer','out_of_service','return_to_service','lost','inactive')),
  worker_id uuid references public.workers(id) on delete set null,
  from_worker_id uuid references public.workers(id) on delete set null,
  reason text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.tools enable row level security;
alter table public.tool_transactions enable row level security;

grant select, insert, update on public.tools to authenticated;
grant select, insert on public.tool_transactions to authenticated;

drop policy if exists "Authenticated users can read tools" on public.tools;
create policy "Authenticated users can read tools" on public.tools for select to authenticated using (true);

drop policy if exists "Admins manage tools" on public.tools;
create policy "Admins manage tools" on public.tools for all to authenticated
using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)))
with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and coalesce(p.active,true)));

drop policy if exists "Trades sign out available tools" on public.tools;
create policy "Trades sign out available tools" on public.tools for update to authenticated
using (
  status='available' or assigned_worker_id in (select id from public.workers where profile_id=auth.uid())
)
with check (
  status in ('available','signed_out','out_of_service') and
  (assigned_worker_id is null or assigned_worker_id in (select id from public.workers where profile_id=auth.uid()))
);

drop policy if exists "Authenticated users read tool history" on public.tool_transactions;
create policy "Authenticated users read tool history" on public.tool_transactions for select to authenticated using (true);

drop policy if exists "Authenticated users create tool history" on public.tool_transactions;
create policy "Authenticated users create tool history" on public.tool_transactions for insert to authenticated with check (true);

-- Add tables to Realtime publication where possible.
do $$ begin
  alter publication supabase_realtime add table public.tools;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tool_transactions;
exception when duplicate_object then null; end $$;
