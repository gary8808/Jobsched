-- AIM Jobsched v53a
-- Warehouse limited job editing for materials + defensive warehouse role constraints.
-- Run once after the v53 migration / warehouse-role constraint patch.

begin;

-- Defensive role-constraint repair so warehouse remains a valid app role.
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.workers'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%app_role%'
  loop
    execute format('alter table public.workers drop constraint if exists %I', r.conname);
  end loop;

  alter table public.workers
    add constraint workers_app_role_check
    check (app_role in ('employee','warehouse','admin'));
exception when duplicate_object then
  null;
end $$;

-- Warehouse can update only material-related job fields. This SECURITY DEFINER
-- function intentionally does not expose scheduling, assignments, client fields,
-- job values, status/category or description edits.
create or replace function public.aimcg_warehouse_update_job_materials(
  p_job_id uuid,
  p_materials_status text,
  p_materials jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text := public.jobsched_current_role();
  v_status text := coalesce(nullif(trim(p_materials_status), ''), 'Parts from stock');
  v_materials jsonb := case when jsonb_typeof(coalesce(p_materials, '[]'::jsonb)) = 'array' then coalesce(p_materials, '[]'::jsonb) else '[]'::jsonb end;
begin
  if v_role not in ('admin','warehouse') then
    raise exception 'Warehouse or Admin permission required';
  end if;

  if not exists (select 1 from public.jobs where id = p_job_id) then
    raise exception 'Job not found';
  end if;

  update public.jobs
  set materials_status = v_status,
      app_payload = jsonb_set(
        jsonb_set(coalesce(app_payload, '{}'::jsonb), '{materialsStatus}', to_jsonb(v_status), true),
        '{materials}', v_materials, true
      ),
      updated_at = now()
  where id = p_job_id;
end;
$$;

grant execute on function public.aimcg_warehouse_update_job_materials(uuid,text,jsonb) to authenticated;

-- Reassert read-only access for Warehouse job notes and attachments.
-- Existing v53 policies already provide this; these statements are defensive.
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

do $$
begin
  if to_regclass('public.attachments') is not null then
    execute 'drop policy if exists "attachments_select_admin_warehouse_or_assigned" on public.attachments';
    execute 'create policy "attachments_select_admin_warehouse_or_assigned" on public.attachments for select to authenticated using (public.jobsched_is_admin() or public.jobsched_is_warehouse() or exists (select 1 from public.job_bookings b where b.job_id = attachments.job_id and b.worker_id = public.jobsched_current_worker_id()))';
  end if;
end $$;

-- Warehouse may open existing job files/photos from the attachment list.
-- This is read-only; upload/delete storage policies remain unchanged.
drop policy if exists "Warehouse read job attachments" on storage.objects;
create policy "Warehouse read job attachments"
on storage.objects
for select
to authenticated
using (
  bucket_id in ('job-files','job-photos')
  and public.jobsched_is_warehouse()
);

notify pgrst, 'reload schema';
commit;
