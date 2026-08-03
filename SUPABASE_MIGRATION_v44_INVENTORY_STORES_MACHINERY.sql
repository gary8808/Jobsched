-- AIM CG v44
-- Phase 1 inventory, Stores permission and employee calendar ordering.

begin;

alter table public.workers
  add column if not exists stores_permission boolean not null default false,
  add column if not exists calendar_order integer not null default 0;

create index if not exists workers_calendar_order_idx
  on public.workers (inactive, calendar_order, name);

create table if not exists public.inventory_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text,
  parent_id uuid references public.inventory_locations(id) on delete set null,
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (name)
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  item_number text not null unique,
  name text not null,
  description text,
  category text,
  brand text,
  supplier_name text,
  supplier_item_number text,
  unit_of_measure text not null default 'each',
  default_location_id uuid references public.inventory_locations(id) on delete set null,
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  average_cost numeric(14,2) not null default 0 check (average_cost >= 0),
  minimum_quantity numeric(14,3) not null default 0 check (minimum_quantity >= 0),
  reorder_quantity numeric(14,3) not null default 0 check (reorder_quantity >= 0),
  barcode text,
  qr_code text,
  notes text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists inventory_items_barcode_unique
  on public.inventory_items (barcode)
  where barcode is not null and btrim(barcode) <> '';

create unique index if not exists inventory_items_qr_unique
  on public.inventory_items (qr_code)
  where qr_code is not null and btrim(qr_code) <> '';

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.inventory_items(id) on delete restrict,
  location_id uuid not null references public.inventory_locations(id) on delete restrict,
  job_id uuid references public.jobs(id) on delete set null,
  movement_type text not null check (movement_type in (
    'opening_balance','receipt','job_issue','job_return',
    'adjustment_in','adjustment_out','write_off','transfer_in','transfer_out'
  )),
  quantity numeric(14,3) not null check (quantity > 0),
  unit_cost numeric(14,2) not null default 0 check (unit_cost >= 0),
  total_cost numeric(14,2) not null default 0 check (total_cost >= 0),
  reference text,
  notes text,
  transfer_group_id uuid,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists inventory_movements_item_idx on public.inventory_movements(item_id, created_at desc);
create index if not exists inventory_movements_location_idx on public.inventory_movements(location_id, created_at desc);
create index if not exists inventory_movements_job_idx on public.inventory_movements(job_id, created_at desc);

create or replace view public.inventory_stock_on_hand as
select
  i.id as item_id,
  i.item_number,
  i.name,
  m.location_id,
  l.name as location_name,
  coalesce(sum(case
    when m.movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then m.quantity
    else -m.quantity
  end),0)::numeric(14,3) as quantity_on_hand,
  i.minimum_quantity,
  i.reorder_quantity,
  i.average_cost,
  (coalesce(sum(case
    when m.movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then m.quantity
    else -m.quantity
  end),0) * i.average_cost)::numeric(14,2) as stock_value
from public.inventory_items i
left join public.inventory_movements m on m.item_id = i.id
left join public.inventory_locations l on l.id = m.location_id
group by i.id, i.item_number, i.name, m.location_id, l.name, i.minimum_quantity, i.reorder_quantity, i.average_cost;

create or replace view public.inventory_low_stock as
select
  i.id as item_id,
  i.item_number,
  i.name,
  i.default_location_id,
  l.name as default_location_name,
  coalesce(sum(case
    when m.movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then m.quantity
    else -m.quantity
  end),0)::numeric(14,3) as quantity_on_hand,
  i.minimum_quantity,
  i.reorder_quantity
from public.inventory_items i
left join public.inventory_movements m on m.item_id = i.id
left join public.inventory_locations l on l.id = i.default_location_id
where i.active = true
group by i.id, i.item_number, i.name, i.default_location_id, l.name, i.minimum_quantity, i.reorder_quantity
having coalesce(sum(case
    when m.movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then m.quantity
    else -m.quantity
  end),0) <= i.minimum_quantity;

create or replace function public.aimcg_has_stores_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active is distinct from false and p.role = 'admin'
  ) or exists (
    select 1 from public.workers w
    where w.profile_id = auth.uid()
      and w.inactive is distinct from true
      and w.access_revoked is distinct from true
      and w.stores_permission = true
  );
$$;

grant execute on function public.aimcg_has_stores_access() to authenticated;

alter table public.inventory_locations enable row level security;

alter table public.inventory_items enable row level security;
alter table public.inventory_movements enable row level security;

drop policy if exists inventory_locations_stores_access on public.inventory_locations;
create policy inventory_locations_stores_access on public.inventory_locations
for all to authenticated
using (public.aimcg_has_stores_access())
with check (public.aimcg_has_stores_access());

drop policy if exists inventory_items_stores_access on public.inventory_items;
create policy inventory_items_stores_access on public.inventory_items
for all to authenticated
using (public.aimcg_has_stores_access())
with check (public.aimcg_has_stores_access());

drop policy if exists inventory_movements_stores_access on public.inventory_movements;
create policy inventory_movements_stores_access on public.inventory_movements
for all to authenticated
using (public.aimcg_has_stores_access())
with check (public.aimcg_has_stores_access());

grant select, insert, update, delete on public.inventory_locations to authenticated;
grant select, insert, update, delete on public.inventory_items to authenticated;
grant select, insert on public.inventory_movements to authenticated;
grant select on public.inventory_stock_on_hand to authenticated;
grant select on public.inventory_low_stock to authenticated;

insert into public.inventory_locations(name, code)
values ('Main Store', 'MAIN-STORE')
on conflict (name) do nothing;

notify pgrst, 'reload schema';
commit;
