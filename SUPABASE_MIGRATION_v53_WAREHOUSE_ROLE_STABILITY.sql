-- AIM Jobsched v53
-- Warehouse role, read-only Admin calendar access, inventory permissions,
-- and legacy Awaiting Parts cleanup.
-- Run once in Supabase SQL Editor before deploying v53.

begin;

-- ---------------------------------------------------------------------------
-- Role helpers
-- ---------------------------------------------------------------------------
create or replace function public.jobsched_is_warehouse()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.jobsched_current_role() = 'warehouse';
$$;

grant execute on function public.jobsched_is_warehouse() to authenticated;

create or replace function public.jobsched_can_view_admin_calendar()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.jobsched_current_role() in ('admin','warehouse');
$$;

grant execute on function public.jobsched_can_view_admin_calendar() to authenticated;

-- Admin-only helper used by the People screen so changing an existing employee
-- between Employee / Warehouse / Admin updates the linked profile as well as the
-- worker row. Warehouse automatically receives stores permission.
create or replace function public.aimcg_set_worker_app_role(p_worker_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := lower(trim(coalesce(p_role,'')));
  v_profile_id uuid;
begin
  if public.jobsched_current_role() <> 'admin' then
    raise exception 'Admin permission required';
  end if;

  if v_role not in ('employee','warehouse','admin') then
    raise exception 'Invalid app role';
  end if;

  select profile_id into v_profile_id
  from public.workers
  where id = p_worker_id;

  if not found then
    raise exception 'Worker not found';
  end if;

  update public.workers
  set app_role = v_role,
      stores_permission = case
        when v_role in ('warehouse','admin') then true
        else stores_permission
      end,
      updated_at = now()
  where id = p_worker_id;

  if v_profile_id is not null then
    update public.profiles
    set role = v_role,
        active = true
    where id = v_profile_id;
  end if;
end;
$$;

grant execute on function public.aimcg_set_worker_app_role(uuid,text) to authenticated;

-- ---------------------------------------------------------------------------
-- Warehouse may READ the full scheduling calendar, but cannot mutate jobs,
-- bookings, workers, notes/history or financial tables.
-- ---------------------------------------------------------------------------

drop policy if exists "workers_select_admin_or_self" on public.workers;
drop policy if exists "workers_select_admin_warehouse_or_self" on public.workers;
create policy "workers_select_admin_warehouse_or_self"
on public.workers
for select
to authenticated
using (
  public.jobsched_is_admin()
  or public.jobsched_is_warehouse()
  or profile_id = auth.uid()
);

-- Keep worker mutation Admin-only. Drop/recreate defensively in case names differ.
drop policy if exists "workers_manage_admin" on public.workers;
create policy "workers_manage_admin"
on public.workers
for all
to authenticated
using (public.jobsched_is_admin())
with check (public.jobsched_is_admin());

-- Jobs: Warehouse sees all rows, but assigned-job updates are Employee-only.
drop policy if exists "jobs_select_admin_or_assigned" on public.jobs;
drop policy if exists "jobs_select_admin_warehouse_or_assigned" on public.jobs;
create policy "jobs_select_admin_warehouse_or_assigned"
on public.jobs
for select
to authenticated
using (
  public.jobsched_is_admin()
  or public.jobsched_is_warehouse()
  or exists (
    select 1
    from public.job_bookings b
    where b.job_id = jobs.id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

drop policy if exists "jobs_update_admin_or_assigned_pilot" on public.jobs;
create policy "jobs_update_admin_or_assigned_pilot"
on public.jobs
for update
to authenticated
using (
  public.jobsched_is_admin()
  or (
    public.jobsched_current_role() = 'employee'
    and exists (
      select 1 from public.job_bookings b
      where b.job_id = jobs.id
        and b.worker_id = public.jobsched_current_worker_id()
    )
  )
)
with check (
  public.jobsched_is_admin()
  or (
    public.jobsched_current_role() = 'employee'
    and exists (
      select 1 from public.job_bookings b
      where b.job_id = jobs.id
        and b.worker_id = public.jobsched_current_worker_id()
    )
  )
);

-- Bookings: Warehouse gets calendar read access only.
drop policy if exists "bookings_select_admin_or_self" on public.job_bookings;
drop policy if exists "bookings_select_admin_warehouse_or_self" on public.job_bookings;
create policy "bookings_select_admin_warehouse_or_self"
on public.job_bookings
for select
to authenticated
using (
  public.jobsched_is_admin()
  or public.jobsched_is_warehouse()
  or worker_id = public.jobsched_current_worker_id()
);

-- Notes/history can be read for operational context, but Warehouse cannot write.
drop policy if exists "notes_select_admin_or_assigned" on public.job_notes;
drop policy if exists "notes_select_admin_warehouse_or_assigned" on public.job_notes;
create policy "notes_select_admin_warehouse_or_assigned"
on public.job_notes
for select
to authenticated
using (
  public.jobsched_is_admin()
  or public.jobsched_is_warehouse()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_notes.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

drop policy if exists "notes_insert_admin_or_assigned" on public.job_notes;
create policy "notes_insert_admin_or_assigned"
on public.job_notes
for insert
to authenticated
with check (
  public.jobsched_is_admin()
  or (
    public.jobsched_current_role() = 'employee'
    and exists (
      select 1 from public.job_bookings b
      where b.job_id = job_notes.job_id
        and b.worker_id = public.jobsched_current_worker_id()
    )
  )
);

drop policy if exists "history_select_admin_or_assigned" on public.job_history;
drop policy if exists "history_select_admin_warehouse_or_assigned" on public.job_history;
create policy "history_select_admin_warehouse_or_assigned"
on public.job_history
for select
to authenticated
using (
  public.jobsched_is_admin()
  or public.jobsched_is_warehouse()
  or exists (
    select 1 from public.job_bookings b
    where b.job_id = job_history.job_id
      and b.worker_id = public.jobsched_current_worker_id()
  )
);

drop policy if exists "history_insert_admin_or_assigned" on public.job_history;
create policy "history_insert_admin_or_assigned"
on public.job_history
for insert
to authenticated
with check (
  public.jobsched_is_admin()
  or (
    public.jobsched_current_role() = 'employee'
    and exists (
      select 1 from public.job_bookings b
      where b.job_id = job_history.job_id
        and b.worker_id = public.jobsched_current_worker_id()
    )
  )
);

-- Attachments: Warehouse may view attached job documents but not add/delete them.
do $$
begin
  if to_regclass('public.attachments') is not null then
    execute 'drop policy if exists "attachments_select_admin_or_assigned" on public.attachments';
    execute 'drop policy if exists "attachments_select_admin_warehouse_or_assigned" on public.attachments';
    execute 'create policy "attachments_select_admin_warehouse_or_assigned" on public.attachments for select to authenticated using (public.jobsched_is_admin() or public.jobsched_is_warehouse() or exists (select 1 from public.job_bookings b where b.job_id = attachments.job_id and b.worker_id = public.jobsched_current_worker_id()))';
    execute 'drop policy if exists "attachments_insert_admin_or_assigned" on public.attachments';
    execute 'create policy "attachments_insert_admin_or_assigned" on public.attachments for insert to authenticated with check (public.jobsched_is_admin() or (public.jobsched_current_role() = ''employee'' and exists (select 1 from public.job_bookings b where b.job_id = attachments.job_id and b.worker_id = public.jobsched_current_worker_id())))';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Financial/private reporting remains Admin-only. Reassert this defensively so
-- Warehouse cannot query job values or internal hourly costs directly.
-- ---------------------------------------------------------------------------
do $$
begin
  if to_regclass('public.job_financials') is not null then
    execute 'alter table public.job_financials enable row level security';
    execute 'drop policy if exists "job_financials_admin_all" on public.job_financials';
    execute 'drop policy if exists "Admins manage job financials" on public.job_financials';
    execute 'create policy "job_financials_admin_all" on public.job_financials for all to authenticated using (public.jobsched_is_admin()) with check (public.jobsched_is_admin())';
  end if;
  if to_regclass('public.employee_costs') is not null then
    execute 'alter table public.employee_costs enable row level security';
    execute 'drop policy if exists "employee_costs_admin_all" on public.employee_costs';
    execute 'drop policy if exists "Admins manage employee costs" on public.employee_costs';
    execute 'create policy "employee_costs_admin_all" on public.employee_costs for all to authenticated using (public.jobsched_is_admin()) with check (public.jobsched_is_admin())';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Full inventory management for Warehouse.
-- Existing inventory RLS policies call this helper, so replacing it expands
-- inventory access without opening Admin-only scheduling/financial tables.
-- ---------------------------------------------------------------------------
create or replace function public.aimcg_has_stores_access()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.active is distinct from false
      and p.role in ('admin','warehouse')
  ) or exists (
    select 1 from public.workers w
    where w.profile_id = auth.uid()
      and w.inactive is distinct from true
      and w.access_revoked is distinct from true
      and w.stores_permission = true
  );
$$;

grant execute on function public.aimcg_has_stores_access() to authenticated;

-- Inventory audit follows stores access as well.
do $$
begin
  if to_regclass('public.inventory_item_audit') is not null then
    execute 'drop policy if exists "inventory_item_audit_admin" on public.inventory_item_audit';
    execute 'drop policy if exists "inventory_item_audit_stores" on public.inventory_item_audit';
    execute 'drop policy if exists "inventory_item_audit_stores_insert" on public.inventory_item_audit';
    execute 'create policy "inventory_item_audit_stores" on public.inventory_item_audit for select to authenticated using (public.aimcg_has_stores_access())';
    execute 'create policy "inventory_item_audit_stores_insert" on public.inventory_item_audit for insert to authenticated with check (public.aimcg_has_stores_access())';
    execute 'grant select, insert on public.inventory_item_audit to authenticated';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Legacy cleanup: Awaiting Parts was removed as a bucket. Preserve material
-- status but return any historical jobs in that bucket to To be rescheduled.
-- ---------------------------------------------------------------------------
update public.jobs
set category = 'To be rescheduled',
    app_payload = case
      when app_payload is null then app_payload
      else jsonb_set(
        jsonb_set(app_payload, '{category}', '"To be rescheduled"'::jsonb, true),
        '{jobStatus}', '"To be rescheduled"'::jsonb, true
      )
    end,
    updated_at = now()
where lower(trim(coalesce(category,''))) = 'awaiting parts';

notify pgrst, 'reload schema';
commit;
