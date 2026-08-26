-- AIM Jobsched v51c
-- Managed sites/trades/tags + inventory archive audit.
-- Run after the v51a stability/security migration.

create table if not exists public.app_reference_values (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('trade','site','tag')),
  name text not null,
  name_key text generated always as (lower(trim(name))) stored,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(kind,name_key)
);

alter table public.app_reference_values enable row level security;
drop policy if exists "reference_values_read" on public.app_reference_values;
create policy "reference_values_read" on public.app_reference_values for select to authenticated using (true);
drop policy if exists "reference_values_admin_manage" on public.app_reference_values;
create policy "reference_values_admin_manage" on public.app_reference_values for all to authenticated using (public.aimcg_is_admin()) with check (public.aimcg_is_admin());
grant select,insert,update,delete on public.app_reference_values to authenticated, service_role;

insert into public.app_reference_values(kind,name) values
 ('trade','Plumber'),('trade','Carpenter'),('trade','TA'),('trade','Electrician'),('trade','Refrigeration'),('trade','Boilermaker'),('trade','Concreter'),('trade','Supervisor'),
 ('site','Paraburdoo'),('site','Brockman'),('site','Busselton'),('site','Karratha'),('site','Tom Price'),('site','Perth'),('site','Other')
on conflict (kind,name_key) do update set active=true, updated_at=now();

create or replace function public.aimcg_rename_reference_value(p_kind text,p_old_name text,p_new_name text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare
  old_key text := lower(trim(coalesce(p_old_name,'')));
  new_name text := trim(coalesce(p_new_name,''));
begin
  if not public.aimcg_is_admin() then raise exception 'Admin access required'; end if;
  if p_kind not in ('trade','site','tag') or new_name = '' or old_key = '' then raise exception 'Invalid reference value'; end if;

  insert into public.app_reference_values(kind,name,active,updated_at)
  values(p_kind,new_name,true,now())
  on conflict(kind,name_key) do update set active=true,name=excluded.name,updated_at=now();

  if p_kind = 'site' then
    update public.workers set base_site=new_name,updated_at=now() where lower(trim(coalesce(base_site,'')))=old_key;
    update public.jobs set site=new_name, app_payload=jsonb_set(coalesce(app_payload,'{}'::jsonb),'{site}',to_jsonb(new_name),true), updated_at=now()
      where lower(trim(coalesce(site,'')))=old_key;
  elsif p_kind = 'trade' then
    update public.workers set trade=new_name,updated_at=now() where lower(trim(coalesce(trade,'')))=old_key;
    update public.jobs j
    set app_payload = jsonb_set(
      jsonb_set(
        coalesce(j.app_payload,'{}'::jsonb),
        '{requiredTrade}',
        to_jsonb(case when lower(trim(coalesce(j.app_payload->>'requiredTrade','')))=old_key then new_name else coalesce(j.app_payload->>'requiredTrade','') end),
        true
      ),
      '{requiredTrades}',
      coalesce((select jsonb_agg(case when lower(trim(t.value))=old_key then new_name else t.value end) from jsonb_array_elements_text(coalesce(j.app_payload->'requiredTrades','[]'::jsonb)) as t(value)),'[]'::jsonb),
      true
    ), updated_at=now()
    where lower(trim(coalesce(j.app_payload->>'requiredTrade','')))=old_key
       or exists (select 1 from jsonb_array_elements_text(coalesce(j.app_payload->'requiredTrades','[]'::jsonb)) as t(value) where lower(trim(t.value))=old_key);
  elsif p_kind = 'tag' then
    update public.jobs j
    set app_payload = jsonb_set(
      coalesce(j.app_payload,'{}'::jsonb),
      '{tags}',
      coalesce((select jsonb_agg(case when lower(trim(t.value))=old_key then new_name else t.value end) from jsonb_array_elements_text(coalesce(j.app_payload->'tags','[]'::jsonb)) as t(value)),'[]'::jsonb),
      true
    ), updated_at=now()
    where exists (select 1 from jsonb_array_elements_text(coalesce(j.app_payload->'tags','[]'::jsonb)) as t(value) where lower(trim(t.value))=old_key);
  end if;

  update public.app_reference_values set active=false,updated_at=now()
    where kind=p_kind and name_key=old_key and name_key<>lower(new_name);
end;
$$;
revoke all on function public.aimcg_rename_reference_value(text,text,text) from public;
grant execute on function public.aimcg_rename_reference_value(text,text,text) to authenticated, service_role;

create table if not exists public.inventory_item_audit (
  id uuid primary key default gen_random_uuid(),
  item_id uuid null,
  item_number text null,
  item_name text null,
  action text not null check(action in ('archived','deleted','restored')),
  performed_by uuid null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.inventory_item_audit enable row level security;
drop policy if exists "inventory_item_audit_admin" on public.inventory_item_audit;
create policy "inventory_item_audit_admin" on public.inventory_item_audit for all to authenticated using (public.aimcg_is_admin()) with check (public.aimcg_is_admin());
grant select,insert on public.inventory_item_audit to authenticated, service_role;
