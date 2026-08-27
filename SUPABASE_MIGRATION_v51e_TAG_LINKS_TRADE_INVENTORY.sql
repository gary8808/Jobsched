-- AIM Jobsched v51e
-- Reliable job tag persistence + restricted Trade inventory read/issue workflow.
-- Run after v51c migration.

begin;

-- ---------------------------------------------------------------------------
-- Job tags: store job/tag relationships explicitly rather than relying only on
-- the jobs.app_payload JSON blob. app_payload remains populated for backwards
-- compatibility, but this table is authoritative for search/reload.
-- ---------------------------------------------------------------------------
create table if not exists public.job_tag_links (
  job_id uuid not null references public.jobs(id) on delete cascade,
  tag_name text not null,
  tag_key text generated always as (lower(trim(tag_name))) stored,
  created_at timestamptz not null default now(),
  primary key (job_id, tag_key)
);

alter table public.job_tag_links enable row level security;
drop policy if exists job_tag_links_read on public.job_tag_links;
create policy job_tag_links_read on public.job_tag_links
for select to authenticated using (true);
drop policy if exists job_tag_links_admin_manage on public.job_tag_links;
create policy job_tag_links_admin_manage on public.job_tag_links
for all to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());
grant select, insert, update, delete on public.job_tag_links to authenticated, service_role;

-- Backfill links from any tags that were successfully written to app_payload.
insert into public.job_tag_links(job_id, tag_name)
select j.id, trim(t.value)
from public.jobs j
cross join lateral jsonb_array_elements_text(coalesce(j.app_payload->'tags','[]'::jsonb)) as t(value)
where trim(t.value) <> ''
on conflict (job_id, tag_key) do update set tag_name = excluded.tag_name;

create or replace function public.aimcg_replace_job_tags(p_job_id uuid, p_tags jsonb default '[]'::jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.aimcg_is_admin() then
    raise exception 'Admin access required' using errcode='42501';
  end if;
  if p_job_id is null then raise exception 'Job ID required'; end if;
  if p_tags is null or jsonb_typeof(p_tags) <> 'array' then p_tags := '[]'::jsonb; end if;

  delete from public.job_tag_links where job_id = p_job_id;
  insert into public.job_tag_links(job_id, tag_name)
  select p_job_id, min(trim(value))
  from jsonb_array_elements_text(p_tags) t(value)
  where trim(value) <> ''
  group by lower(trim(value))
  on conflict (job_id, tag_key) do update set tag_name=excluded.tag_name;

  update public.jobs
  set app_payload = jsonb_set(
        coalesce(app_payload,'{}'::jsonb),
        '{tags}',
        coalesce((select jsonb_agg(tag_name order by tag_name) from public.job_tag_links where job_id=p_job_id),'[]'::jsonb),
        true
      ),
      updated_at=now()
  where id=p_job_id;
end;
$$;
revoke all on function public.aimcg_replace_job_tags(uuid,jsonb) from public;
grant execute on function public.aimcg_replace_job_tags(uuid,jsonb) to authenticated, service_role;

-- Keep explicit links in sync when an Admin renames a tag definition.
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
    insert into public.job_tag_links(job_id,tag_name)
    select job_id,new_name from public.job_tag_links where tag_key=old_key
    on conflict (job_id,tag_key) do update set tag_name=excluded.tag_name;
    delete from public.job_tag_links where tag_key=old_key and tag_key<>lower(new_name);
    update public.jobs j
    set app_payload = jsonb_set(
      coalesce(j.app_payload,'{}'::jsonb),
      '{tags}',
      coalesce((select jsonb_agg(l.tag_name order by l.tag_name) from public.job_tag_links l where l.job_id=j.id),'[]'::jsonb),
      true
    ), updated_at=now()
    where exists (select 1 from public.job_tag_links l where l.job_id=j.id and l.tag_key=lower(new_name));
  end if;

  update public.app_reference_values set active=false,updated_at=now()
    where kind=p_kind and name_key=old_key and name_key<>lower(new_name);
end;
$$;
revoke all on function public.aimcg_rename_reference_value(text,text,text) from public;
grant execute on function public.aimcg_rename_reference_value(text,text,text) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Restricted Trade inventory access. Trades can see active stock and available
-- quantity, and issue stock only to a job they are actually booked on. They do
-- not receive direct table edit/delete permissions through this workflow.
-- ---------------------------------------------------------------------------
create or replace function public.aimcg_trade_inventory_catalog()
returns table(
  item_id uuid,
  item_number text,
  item_name text,
  item_description text,
  unit_of_measure text,
  location_id uuid,
  location_name text,
  qr_code text,
  quantity_available numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
begin
  if not (
    public.aimcg_has_stores_access()
    or exists (
      select 1 from public.workers w
      where w.profile_id=auth.uid()
        and w.inactive is distinct from true
        and w.access_revoked is distinct from true
    )
  ) then
    raise exception 'Active employee access required' using errcode='42501';
  end if;

  return query
  select i.id,
         i.item_number,
         i.name,
         coalesce(i.description,''),
         coalesce(i.unit_of_measure,'each'),
         l.id,
         coalesce(l.name,''),
         coalesce(i.qr_code,i.item_number,i.id::text),
         coalesce(sum(case
           when m.movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then m.quantity
           else -m.quantity end),0)::numeric
  from public.inventory_items i
  left join public.inventory_locations l on l.active is distinct from false
    and (l.id=i.default_location_id or exists(select 1 from public.inventory_movements mx where mx.item_id=i.id and mx.location_id=l.id))
  left join public.inventory_movements m on m.item_id=i.id and m.location_id=l.id
  where i.active is distinct from false
  group by i.id,i.item_number,i.name,i.description,i.unit_of_measure,l.id,l.name,i.qr_code
  having l.id is not null
  order by i.name,l.name;
end;
$$;
revoke all on function public.aimcg_trade_inventory_catalog() from public;
grant execute on function public.aimcg_trade_inventory_catalog() to authenticated, service_role;

create or replace function public.aimcg_trade_job_materials(p_job_id uuid)
returns table(
  item_id uuid,
  item_number text,
  item_name text,
  unit_of_measure text,
  location_id uuid,
  location_name text,
  net_quantity numeric
)
language plpgsql
stable
security definer
set search_path=public
as $$
declare
  v_worker_id uuid;
begin
  select w.id into v_worker_id from public.workers w
  where w.profile_id=auth.uid() and w.inactive is distinct from true and w.access_revoked is distinct from true
  limit 1;

  if not public.aimcg_has_stores_access()
     and (v_worker_id is null or not exists(select 1 from public.job_bookings jb where jb.job_id=p_job_id and jb.worker_id=v_worker_id)) then
    raise exception 'You can only view materials for a job assigned to you' using errcode='42501';
  end if;

  return query
  select i.id,i.item_number,i.name,coalesce(i.unit_of_measure,'each'),l.id,coalesce(l.name,''),
         coalesce(sum(case when m.movement_type='job_issue' then m.quantity when m.movement_type='job_return' then -m.quantity else 0 end),0)::numeric
  from public.inventory_movements m
  join public.inventory_items i on i.id=m.item_id
  left join public.inventory_locations l on l.id=m.location_id
  where m.job_id=p_job_id and m.movement_type in ('job_issue','job_return')
  group by i.id,i.item_number,i.name,i.unit_of_measure,l.id,l.name
  having coalesce(sum(case when m.movement_type='job_issue' then m.quantity when m.movement_type='job_return' then -m.quantity else 0 end),0) <> 0
  order by i.name,l.name;
end;
$$;
revoke all on function public.aimcg_trade_job_materials(uuid) from public;
grant execute on function public.aimcg_trade_job_materials(uuid) to authenticated, service_role;

create or replace function public.aimcg_trade_issue_inventory(
  p_job_id uuid,
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric
)
returns uuid
language plpgsql
security definer
set search_path=public
as $$
declare
  v_worker_id uuid;
  v_available numeric;
  v_cost numeric;
  v_id uuid := gen_random_uuid();
begin
  if p_quantity is null or p_quantity <= 0 then raise exception 'Quantity must be greater than zero'; end if;

  select w.id into v_worker_id from public.workers w
  where w.profile_id=auth.uid() and w.inactive is distinct from true and w.access_revoked is distinct from true
  limit 1;

  if not public.aimcg_has_stores_access()
     and (v_worker_id is null or not exists(select 1 from public.job_bookings jb where jb.job_id=p_job_id and jb.worker_id=v_worker_id)) then
    raise exception 'You can only issue material to a job assigned to you' using errcode='42501';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_location_id::text,0));
  v_available := public.aimcg_inventory_location_balance(p_item_id,p_location_id);
  if p_quantity > v_available then raise exception 'Insufficient stock. Available quantity is %.',v_available; end if;

  select coalesce(i.average_cost,i.unit_cost,0) into v_cost from public.inventory_items i where i.id=p_item_id and i.active is distinct from false;
  if not found then raise exception 'Material is not active'; end if;

  insert into public.inventory_movements(id,item_id,location_id,job_id,movement_type,quantity,unit_cost,total_cost,reference,notes,created_by)
  values(v_id,p_item_id,p_location_id,p_job_id,'job_issue',p_quantity,v_cost,p_quantity*v_cost,'Trade View material issue','Issued from Trade View',auth.uid());
  return v_id;
end;
$$;
revoke all on function public.aimcg_trade_issue_inventory(uuid,uuid,uuid,numeric) from public;
grant execute on function public.aimcg_trade_issue_inventory(uuid,uuid,uuid,numeric) to authenticated, service_role;

notify pgrst, 'reload schema';
commit;
