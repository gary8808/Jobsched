-- AIM Jobsched v52
-- QR inventory issue source tracking + security refresh
-- Run once in Supabase SQL editor before deploying v52.

begin;

-- Replace the v51e Trade issue RPC with a source-aware version. The extra
-- parameter records whether stock was issued from manual search or a QR scan.
-- Keep the v51e four-argument RPC in place during deployment so the current
-- app continues to work. v52 calls this new five-argument overload.
drop function if exists public.aimcg_trade_issue_inventory(uuid,uuid,uuid,numeric,text);

create function public.aimcg_trade_issue_inventory(
  p_job_id uuid,
  p_item_id uuid,
  p_location_id uuid,
  p_quantity numeric,
  p_source text
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
  v_source text := lower(trim(coalesce(p_source,'manual')));
begin
  if p_quantity is null or p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if v_source not in ('manual','qr') then v_source := 'manual'; end if;

  select w.id into v_worker_id
  from public.workers w
  where w.profile_id=auth.uid()
    and w.inactive is distinct from true
    and w.access_revoked is distinct from true
  limit 1;

  if not public.aimcg_has_stores_access()
     and (v_worker_id is null or not exists(
       select 1 from public.job_bookings jb
       where jb.job_id=p_job_id and jb.worker_id=v_worker_id
     )) then
    raise exception 'You can only issue material to a job assigned to you' using errcode='42501';
  end if;

  -- Prevent concurrent scans/issues from taking stock below zero.
  perform pg_advisory_xact_lock(hashtextextended(p_item_id::text || ':' || p_location_id::text,0));
  v_available := public.aimcg_inventory_location_balance(p_item_id,p_location_id);
  if p_quantity > v_available then
    raise exception 'Insufficient stock. Available quantity is %.',v_available;
  end if;

  select coalesce(i.average_cost,i.unit_cost,0)
  into v_cost
  from public.inventory_items i
  where i.id=p_item_id and i.active is distinct from false;

  if not found then raise exception 'Material is not active'; end if;

  insert into public.inventory_movements(
    id,item_id,location_id,job_id,movement_type,quantity,unit_cost,total_cost,
    reference,notes,created_by
  ) values (
    v_id,p_item_id,p_location_id,p_job_id,'job_issue',p_quantity,v_cost,p_quantity*v_cost,
    case when v_source='qr' then 'QR scan material issue' else 'Trade View material issue' end,
    case when v_source='qr' then 'Issued from inventory QR scan' else 'Issued from Trade View manual search' end,
    auth.uid()
  );

  return v_id;
end;
$$;

revoke all on function public.aimcg_trade_issue_inventory(uuid,uuid,uuid,numeric,text) from public;
grant execute on function public.aimcg_trade_issue_inventory(uuid,uuid,uuid,numeric,text) to authenticated, service_role;

-- Reassert security-invoker behaviour on inventory reporting views where
-- supported. If these views already have the option, this is harmless.
do $$
begin
  if to_regclass('public.inventory_low') is not null then
    execute 'alter view public.inventory_low set (security_invoker = true)';
  end if;
  if to_regclass('public.inventory_stock') is not null then
    execute 'alter view public.inventory_stock set (security_invoker = true)';
  end if;
exception when undefined_table then
  null;
end $$;

notify pgrst, 'reload schema';
commit;
