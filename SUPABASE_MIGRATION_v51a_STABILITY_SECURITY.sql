-- AIM CG Jobsched v51a
-- Stability/security patch: inventory views + atomic stock protection.
-- Run after v51 migrations.

begin;

-- Views should execute with the caller's permissions so underlying RLS is honoured.
do $$
begin
  if to_regclass('public.inventory_stock_on_hand') is not null then
    execute 'alter view public.inventory_stock_on_hand set (security_invoker = true)';
  end if;
  if to_regclass('public.inventory_low_stock') is not null then
    execute 'alter view public.inventory_low_stock set (security_invoker = true)';
  end if;
  if to_regclass('public.inventory_stock') is not null then
    execute 'alter view public.inventory_stock set (security_invoker = true)';
  end if;
  if to_regclass('public.inventory_low') is not null then
    execute 'alter view public.inventory_low set (security_invoker = true)';
  end if;
end $$;

-- Anonymous users should never have direct inventory API access.
revoke all on public.inventory_locations from anon;
revoke all on public.inventory_items from anon;
revoke all on public.inventory_movements from anon;
do $$
begin
  if to_regclass('public.inventory_stock_on_hand') is not null then execute 'revoke all on public.inventory_stock_on_hand from anon'; end if;
  if to_regclass('public.inventory_low_stock') is not null then execute 'revoke all on public.inventory_low_stock from anon'; end if;
  if to_regclass('public.inventory_stock') is not null then execute 'revoke all on public.inventory_stock from anon'; end if;
  if to_regclass('public.inventory_low') is not null then execute 'revoke all on public.inventory_low from anon'; end if;
end $$;

-- Current quantity at one location. Security invoker callers still need stores access
-- through the RPC below; the helper is not exposed to anonymous users.
create or replace function public.aimcg_inventory_location_balance(p_item_id uuid, p_location_id uuid)
returns numeric
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(case
    when movement_type in ('opening_balance','receipt','job_return','adjustment_in','transfer_in') then quantity
    else -quantity end),0)
  from public.inventory_movements
  where item_id = p_item_id and location_id = p_location_id;
$$;

create or replace function public.aimcg_save_inventory_movement(p_movement jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid := gen_random_uuid();
  v_item uuid := (p_movement->>'item_id')::uuid;
  v_location uuid := (p_movement->>'location_id')::uuid;
  v_job uuid := nullif(p_movement->>'job_id','')::uuid;
  v_type text := p_movement->>'movement_type';
  v_qty numeric := (p_movement->>'quantity')::numeric;
  v_cost numeric := coalesce((p_movement->>'unit_cost')::numeric,0);
  v_available numeric;
begin
  if not public.aimcg_has_stores_access() then raise exception 'Stores permission required'; end if;
  if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  if v_type in ('job_issue','adjustment_out','write_off','transfer_out') then
    perform pg_advisory_xact_lock(hashtextextended(v_item::text || ':' || v_location::text,0));
    v_available := public.aimcg_inventory_location_balance(v_item,v_location);
    if v_qty > v_available then
      raise exception 'Insufficient stock. Available quantity is %.', v_available;
    end if;
  end if;
  insert into public.inventory_movements(id,item_id,location_id,job_id,movement_type,quantity,unit_cost,total_cost,reference,notes,created_by)
  values(v_id,v_item,v_location,v_job,v_type,v_qty,v_cost,v_qty*v_cost,nullif(p_movement->>'reference',''),nullif(p_movement->>'notes',''),auth.uid());
  return v_id;
end;
$$;

grant execute on function public.aimcg_save_inventory_movement(jsonb) to authenticated;

create or replace function public.aimcg_save_inventory_transfer(p_transfer jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_group uuid := gen_random_uuid();
  v_item uuid := (p_transfer->>'item_id')::uuid;
  v_from uuid := (p_transfer->>'from_location_id')::uuid;
  v_to uuid := (p_transfer->>'to_location_id')::uuid;
  v_qty numeric := (p_transfer->>'quantity')::numeric;
  v_cost numeric := coalesce((p_transfer->>'unit_cost')::numeric,0);
  v_available numeric;
  v_ref text := coalesce(nullif(p_transfer->>'reference',''),'Transfer '||now()::text);
begin
  if not public.aimcg_has_stores_access() then raise exception 'Stores permission required'; end if;
  if v_from = v_to then raise exception 'Source and destination locations must be different'; end if;
  if v_qty is null or v_qty <= 0 then raise exception 'Quantity must be greater than zero'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_item::text || ':' || v_from::text,0));
  v_available := public.aimcg_inventory_location_balance(v_item,v_from);
  if v_qty > v_available then raise exception 'Insufficient stock. Available quantity is %.',v_available; end if;

  insert into public.inventory_movements(item_id,location_id,movement_type,quantity,unit_cost,total_cost,reference,notes,created_by,transfer_group_id)
  values(v_item,v_from,'transfer_out',v_qty,v_cost,v_qty*v_cost,v_ref,nullif(p_transfer->>'notes',''),auth.uid(),v_group);
  insert into public.inventory_movements(item_id,location_id,movement_type,quantity,unit_cost,total_cost,reference,notes,created_by,transfer_group_id)
  values(v_item,v_to,'transfer_in',v_qty,v_cost,v_qty*v_cost,v_ref,nullif(p_transfer->>'notes',''),auth.uid(),v_group);
  return v_group;
end;
$$;

grant execute on function public.aimcg_save_inventory_transfer(jsonb) to authenticated;


-- Re-run PDF parsing under the corrected v51a FastField rules. Existing PDFs remain in Storage.
do $$
begin
  if to_regclass('public.fastfield_submissions') is not null then
    update public.fastfield_submissions
    set processing_status = 'parsing_pending',
        parse_attempted_at = null,
        error_message = null,
        updated_at = now()
    where pdf_object_path is not null and is_cleared is distinct from true;
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
