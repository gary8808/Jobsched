-- AIM CG v43e: consolidated data sync, booking visibility and transaction safety.
-- This migration is intentionally idempotent and can be rerun.
-- Run once in Supabase SQL Editor before deploying src/main.jsx.
-- Safe to run more than once.

create extension if not exists pgcrypto;

-- Compatibility for pilot databases that did not receive every earlier build.
alter table if exists public.jobs
  add column if not exists item_type text not null default 'normal_job',
  add column if not exists app_payload jsonb not null default '{}'::jsonb,
  add column if not exists updated_at timestamptz not null default now();

alter table if exists public.tools
  add column if not exists purchase_date date;

-- Keep this migration compatible with projects that only ran part of the
-- earlier defects/time migrations.
alter table if exists public.job_notes
  add column if not exists show_in_trade_view boolean not null default false,
  add column if not exists visit_id text;

alter table if exists public.job_bookings
  add column if not exists total_ms bigint not null default 0,
  add column if not exists running_since timestamptz,
  add column if not exists status_updated_at timestamptz,
  add column if not exists visit_id text,
  add column if not exists updated_at timestamptz not null default now();

create index if not exists job_bookings_job_worker_dates_idx
  on public.job_bookings(job_id, worker_id, start_date, end_date);
create index if not exists workers_profile_id_lookup_idx
  on public.workers(profile_id)
  where profile_id is not null;

-- One login should resolve to one employee. If old duplicate links exist, do
-- not abort deployment; report them so they can be corrected deliberately.
do $$
begin
  if not exists (
    select 1
    from public.workers
    where profile_id is not null
    group by profile_id
    having count(*) > 1
  ) then
    execute 'create unique index if not exists workers_profile_id_unique_idx on public.workers(profile_id) where profile_id is not null';
  else
    raise notice 'AIM CG: duplicate workers.profile_id links exist; unique login protection was not added.';
  end if;
end $$;

create or replace function public.aimcg_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and coalesce(p.active, true)
  );
$$;

revoke all on function public.aimcg_is_admin() from public;
grant execute on function public.aimcg_is_admin() to authenticated;

-- Authenticated staff need employee names for the Tool Register's current
-- holder display, but should not receive phone, email or payroll fields from
-- the workers table. This directory exposes names only.
create or replace function public.aimcg_worker_name_directory()
returns table(id uuid, name text)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name
  from public.workers w
  where auth.uid() is not null
    and coalesce(w.inactive, false) = false
  order by w.name;
$$;

revoke all on function public.aimcg_worker_name_directory() from public;
grant execute on function public.aimcg_worker_name_directory() to authenticated;

create or replace function public.aimcg_replace_job_bookings(
  p_job_id uuid,
  p_bookings jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  existing public.job_bookings%rowtype;
  requested_id uuid;
  booking_id uuid;
  worker_id_value uuid;
  start_date_value date;
  end_date_value date;
  status_value text;
  total_ms_value bigint;
  running_since_value timestamptz;
  status_updated_at_value timestamptz;
  visit_id_value text;
  kept_ids uuid[] := '{}'::uuid[];
begin
  if not public.aimcg_is_admin() then
    raise exception 'Only an active admin can replace job bookings.' using errcode = '42501';
  end if;

  if p_job_id is null then
    raise exception 'A job ID is required.' using errcode = '22023';
  end if;

  if p_bookings is null then
    p_bookings := '[]'::jsonb;
  end if;

  if jsonb_typeof(p_bookings) <> 'array' then
    raise exception 'p_bookings must be a JSON array.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_bookings)
  loop
    existing := null;
    begin
      requested_id := nullif(item->>'id', '')::uuid;
    exception when invalid_text_representation then
      requested_id := null;
    end;

    begin
      worker_id_value := nullif(item->>'worker_id', '')::uuid;
      start_date_value := nullif(item->>'start_date', '')::date;
      end_date_value := coalesce(nullif(item->>'end_date', '')::date, start_date_value);
    exception when others then
      raise exception 'Invalid booking data for job %: %', p_job_id, item using errcode = '22023';
    end;

    if worker_id_value is null or start_date_value is null or end_date_value is null then
      raise exception 'Each booking requires worker_id, start_date and end_date.' using errcode = '22023';
    end if;

    if end_date_value < start_date_value then
      raise exception 'Booking end date cannot be before its start date.' using errcode = '22023';
    end if;

    select jb.*
      into existing
      from public.job_bookings jb
     where jb.job_id = p_job_id
       and (
         (requested_id is not null and jb.id = requested_id)
         or (
           jb.worker_id = worker_id_value
           and jb.start_date = start_date_value
           and jb.end_date = end_date_value
         )
       )
     order by case when requested_id is not null and jb.id = requested_id then 0 else 1 end,
              jb.updated_at desc nulls last
     limit 1;

    -- Never allow a client-supplied booking ID to overwrite a row belonging
    -- to another job. Generate a new ID if that UUID is already in use.
    if existing.id is null and requested_id is not null and exists (
      select 1 from public.job_bookings other where other.id = requested_id
    ) then
      requested_id := null;
    end if;

    booking_id := coalesce(existing.id, requested_id, gen_random_uuid());
    visit_id_value := nullif(item->>'visit_id', '');
    status_value := coalesce(nullif(item->>'booking_status', ''), 'notStarted');
    total_ms_value := greatest(coalesce((item->>'total_ms')::bigint, 0), 0);
    running_since_value := nullif(item->>'running_since', '')::timestamptz;
    status_updated_at_value := nullif(item->>'status_updated_at', '')::timestamptz;

    -- An admin can have a slightly older copy of a job open while a trade changes
    -- status. Preserve the newer server-side status/time when the visit is the same.
    if existing.id is not null
       and existing.worker_id = worker_id_value
       and coalesce(existing.visit_id, '') = coalesce(visit_id_value, '')
       and existing.status_updated_at is not null
       and (status_updated_at_value is null or existing.status_updated_at > status_updated_at_value)
    then
      status_value := existing.booking_status;
      total_ms_value := coalesce(existing.total_ms, 0);
      running_since_value := existing.running_since;
      status_updated_at_value := existing.status_updated_at;
    end if;

    insert into public.job_bookings (
      id,
      job_id,
      worker_id,
      start_date,
      end_date,
      booking_status,
      total_ms,
      running_since,
      status_updated_at,
      visit_id,
      updated_at
    ) values (
      booking_id,
      p_job_id,
      worker_id_value,
      start_date_value,
      end_date_value,
      status_value,
      total_ms_value,
      running_since_value,
      coalesce(status_updated_at_value, now()),
      visit_id_value,
      now()
    )
    on conflict (id) do update set
      worker_id = excluded.worker_id,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      booking_status = excluded.booking_status,
      total_ms = excluded.total_ms,
      running_since = excluded.running_since,
      status_updated_at = excluded.status_updated_at,
      visit_id = excluded.visit_id,
      updated_at = now();

    kept_ids := array_append(kept_ids, booking_id);
  end loop;

  if cardinality(kept_ids) = 0 then
    delete from public.job_bookings where job_id = p_job_id;
  else
    delete from public.job_bookings
     where job_id = p_job_id
       and not (id = any(kept_ids));
  end if;
end;
$$;

revoke all on function public.aimcg_replace_job_bookings(uuid, jsonb) from public;
grant execute on function public.aimcg_replace_job_bookings(uuid, jsonb) to authenticated;

-- Save the job row and its complete booking set in one transaction. Employees
-- can never observe the job without its replacement booking, and a booking
-- validation failure rolls the job update back as well.
create or replace function public.aimcg_save_job_with_bookings(
  p_job jsonb,
  p_bookings jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  job_id_value uuid;
begin
  if not public.aimcg_is_admin() then
    raise exception 'Only an active admin can save jobs and schedules.' using errcode = '42501';
  end if;

  if p_job is null or jsonb_typeof(p_job) <> 'object' then
    raise exception 'p_job must be a JSON object.' using errcode = '22023';
  end if;

  begin
    job_id_value := nullif(p_job->>'id', '')::uuid;
  exception when invalid_text_representation then
    job_id_value := null;
  end;
  if job_id_value is null then
    raise exception 'A valid job ID is required.' using errcode = '22023';
  end if;

  insert into public.jobs (
    id,
    title,
    client,
    site,
    address,
    job_number,
    quote_number,
    work_order_number,
    po_number,
    description,
    category,
    materials_status,
    client_contact,
    client_phone,
    appointment_sent,
    client_accepted,
    completed_confirmed,
    item_type,
    app_payload,
    updated_at
  ) values (
    job_id_value,
    coalesce(nullif(p_job->>'title', ''), 'Untitled job'),
    nullif(p_job->>'client', ''),
    nullif(p_job->>'site', ''),
    nullif(p_job->>'address', ''),
    nullif(p_job->>'job_number', ''),
    nullif(p_job->>'quote_number', ''),
    nullif(p_job->>'work_order_number', ''),
    nullif(p_job->>'po_number', ''),
    nullif(p_job->>'description', ''),
    coalesce(nullif(p_job->>'category', ''), 'To be scheduled'),
    coalesce(nullif(p_job->>'materials_status', ''), 'Parts from stock'),
    nullif(p_job->>'client_contact', ''),
    nullif(p_job->>'client_phone', ''),
    coalesce((p_job->>'appointment_sent')::boolean, false),
    coalesce((p_job->>'client_accepted')::boolean, false),
    coalesce((p_job->>'completed_confirmed')::boolean, false),
    coalesce(nullif(p_job->>'item_type', ''), 'normal_job'),
    coalesce(p_job->'app_payload', '{}'::jsonb),
    now()
  )
  on conflict (id) do update set
    title = excluded.title,
    client = excluded.client,
    site = excluded.site,
    address = excluded.address,
    job_number = excluded.job_number,
    quote_number = excluded.quote_number,
    work_order_number = excluded.work_order_number,
    po_number = excluded.po_number,
    description = excluded.description,
    category = excluded.category,
    materials_status = excluded.materials_status,
    client_contact = excluded.client_contact,
    client_phone = excluded.client_phone,
    appointment_sent = excluded.appointment_sent,
    client_accepted = excluded.client_accepted,
    completed_confirmed = excluded.completed_confirmed,
    item_type = excluded.item_type,
    app_payload = excluded.app_payload,
    updated_at = now();

  perform public.aimcg_replace_job_bookings(job_id_value, p_bookings);
end;
$$;

revoke all on function public.aimcg_save_job_with_bookings(jsonb, jsonb) from public;
grant execute on function public.aimcg_save_job_with_bookings(jsonb, jsonb) to authenticated;

-- Move legacy note arrays out of jobs.app_payload before removing that copy.
-- This keeps per-note Trade View visibility enforceable by RLS.
create or replace function public.aimcg_try_timestamptz(p_value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if nullif(p_value, '') is null then return null; end if;
  return p_value::timestamptz;
exception when others then
  return null;
end;
$$;

insert into public.job_notes (
  id, job_id, worker_id, note_text, note_type, visit_id,
  show_in_trade_view, created_by, created_at
)
select
  case
    when coalesce(note.value->>'id', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (note.value->>'id')::uuid
    else gen_random_uuid()
  end,
  j.id,
  case
    when coalesce(note.value->>'workerId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and exists (select 1 from public.workers w where w.id = (note.value->>'workerId')::uuid)
      then (note.value->>'workerId')::uuid
    else null
  end,
  coalesce(note.value->>'text', ''),
  coalesce(nullif(note.value->>'noteType', ''), 'general'),
  nullif(note.value->>'visitId', ''),
  lower(coalesce(note.value->>'showInTradeView', 'false')) in ('true', '1', 'yes'),
  null,
  coalesce(public.aimcg_try_timestamptz(note.value->>'date'), j.updated_at, now())
from public.jobs j
cross join lateral jsonb_array_elements(
  case
    when jsonb_typeof(j.app_payload->'noteHistory') = 'array' then j.app_payload->'noteHistory'
    else '[]'::jsonb
  end
) as note(value)
where nullif(trim(coalesce(note.value->>'text', '')), '') is not null
on conflict (id) do update set
  note_text = excluded.note_text,
  note_type = excluded.note_type,
  visit_id = excluded.visit_id,
  show_in_trade_view = excluded.show_in_trade_view;

update public.jobs
set app_payload = app_payload - 'noteHistory'
where app_payload ? 'noteHistory';

create or replace function public.aimcg_replace_admin_job_notes(
  p_job_id uuid,
  p_notes jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  note_id uuid;
  kept_ids uuid[] := '{}'::uuid[];
begin
  if not public.aimcg_is_admin() then
    raise exception 'Only an active admin can replace job notes.' using errcode = '42501';
  end if;

  if p_job_id is null then
    raise exception 'A job ID is required.' using errcode = '22023';
  end if;

  p_notes := coalesce(p_notes, '[]'::jsonb);
  if jsonb_typeof(p_notes) <> 'array' then
    raise exception 'p_notes must be a JSON array.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_notes)
  loop
    begin
      note_id := coalesce(nullif(item->>'id', '')::uuid, gen_random_uuid());
    exception when invalid_text_representation then
      note_id := gen_random_uuid();
    end;

    if nullif(trim(coalesce(item->>'note_text', '')), '') is null then
      continue;
    end if;

    insert into public.job_notes (
      id, job_id, worker_id, note_text, note_type, visit_id,
      show_in_trade_view, created_by, created_at
    ) values (
      note_id,
      p_job_id,
      null,
      trim(item->>'note_text'),
      coalesce(nullif(item->>'note_type', ''), 'admin_note'),
      nullif(item->>'visit_id', ''),
      lower(coalesce(item->>'show_in_trade_view', 'false')) in ('true', '1', 'yes'),
      auth.uid(),
      coalesce(public.aimcg_try_timestamptz(item->>'created_at'), now())
    )
    on conflict (id) do update set
      note_text = excluded.note_text,
      note_type = excluded.note_type,
      visit_id = excluded.visit_id,
      show_in_trade_view = excluded.show_in_trade_view;

    kept_ids := array_append(kept_ids, note_id);
  end loop;

  if cardinality(kept_ids) = 0 then
    delete from public.job_notes
     where job_id = p_job_id
       and worker_id is null
       and note_type in ('general', 'admin_note');
  else
    delete from public.job_notes
     where job_id = p_job_id
       and worker_id is null
       and note_type in ('general', 'admin_note')
       and not (id = any(kept_ids));
  end if;
end;
$$;

revoke all on function public.aimcg_replace_admin_job_notes(uuid, jsonb) from public;
grant execute on function public.aimcg_replace_admin_job_notes(uuid, jsonb) to authenticated;

-- Save one calendar/ad-hoc machinery booking with a per-machine transaction
-- lock. This closes the race where two admins could both pass the browser-side
-- conflict check before either insert became visible.
create or replace function public.aimcg_save_machinery_booking(
  p_booking jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  booking_id_value uuid;
  machine_id_value uuid;
  job_id_value uuid;
  worker_id_value uuid;
  start_date_value date;
  end_date_value date;
  period_value text;
  booking_type_value text;
  description_value text;
begin
  if not public.aimcg_is_admin() then
    raise exception 'Only an active admin can save machinery bookings.' using errcode = '42501';
  end if;
  if p_booking is null or jsonb_typeof(p_booking) <> 'object' then
    raise exception 'p_booking must be a JSON object.' using errcode = '22023';
  end if;

  begin
    booking_id_value := nullif(p_booking->>'id', '')::uuid;
  exception when invalid_text_representation then
    booking_id_value := null;
  end;

  begin
    machine_id_value := nullif(p_booking->>'machine_id', '')::uuid;
    job_id_value := nullif(p_booking->>'job_id', '')::uuid;
    worker_id_value := nullif(p_booking->>'worker_id', '')::uuid;
    start_date_value := nullif(p_booking->>'start_date', '')::date;
    end_date_value := coalesce(nullif(p_booking->>'end_date', '')::date, start_date_value);
  exception when others then
    raise exception 'Invalid machinery booking data: %', p_booking using errcode = '22023';
  end;

  period_value := coalesce(nullif(p_booking->>'period', ''), 'full_day');
  booking_type_value := coalesce(nullif(p_booking->>'booking_type', ''), 'ad_hoc');
  description_value := nullif(p_booking->>'description', '');

  if machine_id_value is null or start_date_value is null or end_date_value is null then
    raise exception 'Machine, start date and end date are required.' using errcode = '22023';
  end if;
  if end_date_value < start_date_value then
    raise exception 'Machinery booking end date cannot be before its start date.' using errcode = '22023';
  end if;
  if period_value not in ('am', 'pm', 'full_day') then
    raise exception 'Invalid machinery booking period: %', period_value using errcode = '22023';
  end if;
  if booking_type_value not in ('job', 'ad_hoc', 'maintenance', 'repairs') then
    raise exception 'Invalid machinery booking type: %', booking_type_value using errcode = '22023';
  end if;
  if booking_type_value = 'job' and (job_id_value is null or worker_id_value is null) then
    raise exception 'Job machinery bookings require both a job and an employee.' using errcode = '22023';
  end if;
  if booking_type_value <> 'job' and description_value is null then
    raise exception 'A description is required for ad hoc, maintenance and repair bookings.' using errcode = '22023';
  end if;

  -- Serialise all conflict checks and writes for one machine.
  perform pg_advisory_xact_lock(hashtextextended(machine_id_value::text, 0));

  if not exists (
    select 1 from public.machinery m
    where m.id = machine_id_value
      and m.active = true
      and m.status = 'available'
  ) then
    raise exception 'The selected machine is inactive or out of service.' using errcode = '23514';
  end if;

  if exists (
    select 1
    from public.machinery_bookings mb
    where mb.machine_id = machine_id_value
      and (booking_id_value is null or mb.id <> booking_id_value)
      and mb.start_date <= end_date_value
      and start_date_value <= mb.end_date
      and (mb.period = 'full_day' or period_value = 'full_day' or mb.period = period_value)
  ) then
    raise exception 'The selected machine is already booked for part of this period.' using errcode = '23P01';
  end if;

  if booking_id_value is null then
    booking_id_value := gen_random_uuid();
  elsif exists (
    select 1 from public.machinery_bookings mb
    where mb.id = booking_id_value and mb.machine_id <> machine_id_value
  ) then
    raise exception 'This booking ID belongs to a different machine.' using errcode = '23505';
  end if;

  insert into public.machinery_bookings (
    id, machine_id, job_id, worker_id, start_date, end_date, period,
    booking_type, description, created_by, updated_at
  ) values (
    booking_id_value, machine_id_value, job_id_value, worker_id_value,
    start_date_value, end_date_value, period_value, booking_type_value,
    description_value, auth.uid(), now()
  )
  on conflict (id) do update set
    machine_id = excluded.machine_id,
    job_id = excluded.job_id,
    worker_id = excluded.worker_id,
    start_date = excluded.start_date,
    end_date = excluded.end_date,
    period = excluded.period,
    booking_type = excluded.booking_type,
    description = excluded.description,
    updated_at = now();

  return booking_id_value;
end;
$$;

revoke all on function public.aimcg_save_machinery_booking(jsonb) from public;
grant execute on function public.aimcg_save_machinery_booking(jsonb) to authenticated;

-- Machinery conflicts must be enforced in the database as well as the UI.
-- The advisory lock serialises simultaneous attempts to book the same asset.
create or replace function public.aimcg_validate_machinery_booking()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  machine_status text;
  machine_active boolean;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.machine_id::text, 0));

  select m.status, m.active
    into machine_status, machine_active
    from public.machinery m
   where m.id = new.machine_id;

  if not found then
    raise exception 'The selected machine does not exist.' using errcode = '23503';
  end if;

  if coalesce(machine_active, false) = false or machine_status in ('out_of_service', 'inactive') then
    -- Existing bookings remain valid history when an asset is subsequently
    -- taken out of service. Permit an update that does not change the reserved
    -- machine/date/period, but reject every new or moved booking.
    if not (
      tg_op = 'UPDATE'
      and old.machine_id = new.machine_id
      and old.start_date = new.start_date
      and old.end_date = new.end_date
      and old.period = new.period
    ) then
      raise exception 'This machine is unavailable and cannot be booked.' using errcode = '23514';
    end if;
  end if;

  if exists (
    select 1
    from public.machinery_bookings other
    where other.machine_id = new.machine_id
      and other.id <> new.id
      and other.start_date <= new.end_date
      and new.start_date <= other.end_date
      and (
        other.period = 'full_day'
        or new.period = 'full_day'
        or other.period = new.period
      )
  ) then
    raise exception 'This machine is already booked for the selected dates and period.' using errcode = '23P01';
  end if;

  return new;
end;
$$;

revoke all on function public.aimcg_validate_machinery_booking() from public;

drop trigger if exists aimcg_validate_machinery_booking_trigger on public.machinery_bookings;
create trigger aimcg_validate_machinery_booking_trigger
before insert or update on public.machinery_bookings
for each row execute function public.aimcg_validate_machinery_booking();

create or replace function public.aimcg_replace_job_machinery_bookings(
  p_job_id uuid,
  p_bookings jsonb default '[]'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  item jsonb;
  requested_id uuid;
  booking_id uuid;
  machine_id_value uuid;
  worker_id_value uuid;
  start_date_value date;
  end_date_value date;
  period_value text;
  kept_ids uuid[] := '{}'::uuid[];
begin
  if not public.aimcg_is_admin() then
    raise exception 'Only an active admin can replace machinery bookings.' using errcode = '42501';
  end if;

  if p_job_id is null then
    raise exception 'A job ID is required.' using errcode = '22023';
  end if;

  p_bookings := coalesce(p_bookings, '[]'::jsonb);
  if jsonb_typeof(p_bookings) <> 'array' then
    raise exception 'p_bookings must be a JSON array.' using errcode = '22023';
  end if;

  for item in select value from jsonb_array_elements(p_bookings)
  loop
    begin
      requested_id := nullif(item->>'id', '')::uuid;
    exception when invalid_text_representation then
      requested_id := null;
    end;

    begin
      machine_id_value := nullif(item->>'machine_id', '')::uuid;
      worker_id_value := nullif(item->>'worker_id', '')::uuid;
      start_date_value := nullif(item->>'start_date', '')::date;
      end_date_value := coalesce(nullif(item->>'end_date', '')::date, start_date_value);
    exception when others then
      raise exception 'Invalid machinery booking data for job %: %', p_job_id, item using errcode = '22023';
    end;

    period_value := coalesce(nullif(item->>'period', ''), 'full_day');
    if machine_id_value is null or start_date_value is null or end_date_value is null then
      raise exception 'Each machinery booking requires a machine and dates.' using errcode = '22023';
    end if;
    if end_date_value < start_date_value then
      raise exception 'Machinery booking end date cannot be before its start date.' using errcode = '22023';
    end if;
    if period_value not in ('am', 'pm', 'full_day') then
      raise exception 'Invalid machinery booking period: %', period_value using errcode = '22023';
    end if;

    booking_id := null;
    select mb.id
      into booking_id
      from public.machinery_bookings mb
     where mb.job_id = p_job_id
       and (
         (requested_id is not null and mb.id = requested_id)
         or (
           mb.machine_id = machine_id_value
           and mb.start_date = start_date_value
           and mb.end_date = end_date_value
           and mb.period = period_value
         )
       )
     order by case when requested_id is not null and mb.id = requested_id then 0 else 1 end,
              mb.updated_at desc nulls last
     limit 1;

    -- Do not let a stale client UUID move a booking belonging to another job.
    if booking_id is null and requested_id is not null and exists (
      select 1 from public.machinery_bookings other where other.id = requested_id
    ) then
      requested_id := null;
    end if;

    booking_id := coalesce(booking_id, requested_id, gen_random_uuid());

    insert into public.machinery_bookings (
      id, machine_id, job_id, worker_id, start_date, end_date,
      period, booking_type, description, updated_at
    ) values (
      booking_id,
      machine_id_value,
      p_job_id,
      worker_id_value,
      start_date_value,
      end_date_value,
      period_value,
      'job',
      nullif(item->>'description', ''),
      now()
    )
    on conflict (id) do update set
      machine_id = excluded.machine_id,
      job_id = excluded.job_id,
      worker_id = excluded.worker_id,
      start_date = excluded.start_date,
      end_date = excluded.end_date,
      period = excluded.period,
      booking_type = 'job',
      description = excluded.description,
      updated_at = now();

    kept_ids := array_append(kept_ids, booking_id);
  end loop;

  if cardinality(kept_ids) = 0 then
    delete from public.machinery_bookings where job_id = p_job_id;
  else
    delete from public.machinery_bookings
     where job_id = p_job_id
       and not (id = any(kept_ids));
  end if;
end;
$$;

revoke all on function public.aimcg_replace_job_machinery_bookings(uuid, jsonb) from public;
grant execute on function public.aimcg_replace_job_machinery_bookings(uuid, jsonb) to authenticated;

-- Rebuild the core Jobs/Bookings policies explicitly. The earlier pilot
-- builds used several policy names, so a database could otherwise save a
-- booking successfully for Admin while the assigned Trade login could not read
-- it after refresh.
alter table public.jobs enable row level security;
alter table public.job_bookings enable row level security;

grant select, insert, update, delete on public.jobs to authenticated;
grant select on public.job_bookings to authenticated;
revoke insert, delete, update on public.job_bookings from authenticated;
grant update (booking_status, total_ms, running_since, status_updated_at, visit_id, updated_at)
  on public.job_bookings to authenticated;

drop policy if exists "Authenticated users can manage bookings during pilot" on public.job_bookings;
drop policy if exists "Employees can read own bookings" on public.job_bookings;
drop policy if exists "Employees can update own bookings" on public.job_bookings;
drop policy if exists "bookings_select_admin_or_self" on public.job_bookings;
drop policy if exists "bookings_manage_admin" on public.job_bookings;
drop policy if exists "bookings_select_admin_or_self_v43e" on public.job_bookings;
drop policy if exists "bookings_manage_admin_v43e" on public.job_bookings;
drop policy if exists "bookings_update_self_v43e" on public.job_bookings;
drop policy if exists "bookings_update_self_status" on public.job_bookings;

create policy "bookings_select_admin_or_self_v43e"
on public.job_bookings
for select
to authenticated
using (
  public.aimcg_is_admin()
  or exists (
    select 1
    from public.workers w
    where w.id = job_bookings.worker_id
      and w.profile_id = auth.uid()
      and coalesce(w.inactive, false) = false
  )
);

create policy "bookings_manage_admin_v43e"
on public.job_bookings
for all
to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());

create policy "bookings_update_self_v43e"
on public.job_bookings
for update
to authenticated
using (
  exists (
    select 1
    from public.workers w
    where w.id = job_bookings.worker_id
      and w.profile_id = auth.uid()
      and coalesce(w.inactive, false) = false
  )
)
with check (
  exists (
    select 1
    from public.workers w
    where w.id = job_bookings.worker_id
      and w.profile_id = auth.uid()
      and coalesce(w.inactive, false) = false
  )
);

-- Trades can read only jobs currently assigned to their linked worker record.
-- All job-row writes remain Admin-only; Trade status, notes and completion data
-- are written to their dedicated tables.
drop policy if exists "Authenticated users can manage jobs during pilot" on public.jobs;
drop policy if exists "jobs_update_admin_or_assigned_pilot" on public.jobs;
drop policy if exists "jobs_update_admin_v43e" on public.jobs;
drop policy if exists "jobs_insert_admin" on public.jobs;
drop policy if exists "jobs_delete_admin" on public.jobs;
drop policy if exists "jobs_select_admin_or_assigned" on public.jobs;
drop policy if exists "jobs_select_admin_or_assigned_v43e" on public.jobs;
drop policy if exists "jobs_manage_admin_v43e" on public.jobs;

create policy "jobs_select_admin_or_assigned_v43e"
on public.jobs
for select
to authenticated
using (
  public.aimcg_is_admin()
  or exists (
    select 1
    from public.job_bookings b
    join public.workers w on w.id = b.worker_id
    where b.job_id = jobs.id
      and w.profile_id = auth.uid()
      and coalesce(w.inactive, false) = false
  )
);

create policy "jobs_manage_admin_v43e"
on public.jobs
for all
to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());

-- Admin-only notes remain hidden at the database layer. A trade can read a
-- note explicitly shared with Trade View, plus notes they personally created.
drop policy if exists "Authenticated users can manage notes during pilot" on public.job_notes;
drop policy if exists "notes_select_admin_or_assigned" on public.job_notes;
drop policy if exists "notes_select_admin_shared_or_own_v43e" on public.job_notes;
create policy "notes_select_admin_shared_or_own_v43e"
on public.job_notes
for select
to authenticated
using (
  public.aimcg_is_admin()
  or (
    exists (
      select 1
      from public.job_bookings b
      join public.workers current_worker
        on current_worker.id = b.worker_id
       and current_worker.profile_id = auth.uid()
      where b.job_id = job_notes.job_id
    )
    and (
      coalesce(job_notes.show_in_trade_view, false)
      or exists (
        select 1
        from public.workers own_worker
        where own_worker.id = job_notes.worker_id
          and own_worker.profile_id = auth.uid()
      )
    )
  )
);

-- Machinery attached to a job is visible to the assigned Trade even when the
-- machinery booking itself was left unassigned. Admin remains the only role
-- that can create, edit or delete machinery bookings.
drop policy if exists "Authenticated users read machinery bookings" on public.machinery_bookings;
drop policy if exists "machinery_bookings_select_admin_or_assigned_v43e" on public.machinery_bookings;
create policy "machinery_bookings_select_admin_or_assigned_v43e"
on public.machinery_bookings
for select
to authenticated
using (
  public.aimcg_is_admin()
  or exists (
    select 1 from public.workers own_worker
    where own_worker.id = machinery_bookings.worker_id
      and own_worker.profile_id = auth.uid()
      and coalesce(own_worker.inactive, false) = false
  )
  or exists (
    select 1
    from public.job_bookings jb
    join public.workers own_worker on own_worker.id = jb.worker_id
    where jb.job_id = machinery_bookings.job_id
      and own_worker.profile_id = auth.uid()
      and coalesce(own_worker.inactive, false) = false
  )
);

-- Apply each tool checkout/return/fault action and its history row atomically.
create or replace function public.aimcg_apply_tool_action(
  p_tool_id uuid,
  p_action text,
  p_worker_id uuid default null,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  tool_row public.tools%rowtype;
  current_worker_id uuid;
  action_worker_id uuid;
  admin_access boolean := public.aimcg_is_admin();
begin
  select t.* into tool_row
  from public.tools t
  where t.id = p_tool_id
  for update;

  if tool_row.id is null then
    raise exception 'Tool not found.' using errcode = 'P0002';
  end if;

  select w.id into current_worker_id
  from public.workers w
  where w.profile_id = auth.uid()
    and coalesce(w.inactive, false) = false
  limit 1;

  if not admin_access and current_worker_id is null then
    raise exception 'This login is not linked to an active employee.' using errcode = '42501';
  end if;

  if p_action = 'sign_out' then
    action_worker_id := coalesce(p_worker_id, current_worker_id);
    if action_worker_id is null then
      raise exception 'An employee is required to sign out a tool.' using errcode = '22023';
    end if;
    if not admin_access and action_worker_id is distinct from current_worker_id then
      raise exception 'Trades can only sign tools out to themselves.' using errcode = '42501';
    end if;
    if tool_row.status <> 'available' or tool_row.active = false then
      raise exception 'This tool is not available.' using errcode = '23514';
    end if;
    update public.tools
       set status = 'signed_out',
           assigned_worker_id = action_worker_id,
           signed_out_at = now(),
           updated_at = now()
     where id = p_tool_id;

  elsif p_action = 'return' then
    if not admin_access and tool_row.assigned_worker_id is distinct from current_worker_id then
      raise exception 'Trades can only return tools assigned to them.' using errcode = '42501';
    end if;
    action_worker_id := coalesce(tool_row.assigned_worker_id, p_worker_id, current_worker_id);
    update public.tools
       set status = 'available',
           assigned_worker_id = null,
           signed_out_at = null,
           updated_at = now()
     where id = p_tool_id;

  elsif p_action = 'out_of_service' then
    if not admin_access
       and tool_row.assigned_worker_id is distinct from current_worker_id
       and tool_row.status <> 'available'
    then
      raise exception 'Trades can only report an available tool or a tool assigned to them.' using errcode = '42501';
    end if;
    action_worker_id := coalesce(tool_row.assigned_worker_id, p_worker_id, current_worker_id);
    update public.tools
       set status = 'out_of_service',
           updated_at = now()
     where id = p_tool_id;

  elsif p_action = 'return_to_service' then
    if not admin_access then
      raise exception 'Only an admin can return a tool to service.' using errcode = '42501';
    end if;
    action_worker_id := coalesce(tool_row.assigned_worker_id, p_worker_id);
    update public.tools
       set status = 'available',
           assigned_worker_id = null,
           signed_out_at = null,
           updated_at = now()
     where id = p_tool_id;

  else
    raise exception 'Unsupported tool action: %', p_action using errcode = '22023';
  end if;

  insert into public.tool_transactions (
    tool_id,
    action,
    worker_id,
    from_worker_id,
    reason,
    created_by
  ) values (
    p_tool_id,
    p_action,
    action_worker_id,
    tool_row.assigned_worker_id,
    nullif(p_reason, ''),
    auth.uid()
  );
end;
$$;

revoke all on function public.aimcg_apply_tool_action(uuid, text, uuid, text) from public;
grant execute on function public.aimcg_apply_tool_action(uuid, text, uuid, text) to authenticated;

-- Tool register security. All authenticated staff may see the register. Only
-- admins edit tool details or delete tools; Trade actions go through the atomic
-- aimcg_apply_tool_action RPC and cannot bypass its transition checks.
alter table public.tools enable row level security;
alter table public.tool_transactions enable row level security;
grant select, insert, update, delete on public.tools to authenticated;
grant select, insert, delete on public.tool_transactions to authenticated;

drop policy if exists "Authenticated users can read tools" on public.tools;
drop policy if exists "Admins manage tools" on public.tools;
drop policy if exists "Admins insert tools" on public.tools;
drop policy if exists "Admins update tools" on public.tools;
drop policy if exists "Admins delete tools" on public.tools;
drop policy if exists "Trades sign out available tools" on public.tools;
drop policy if exists "Trades update own tool allocation" on public.tools;
drop policy if exists "tools_select_authenticated_v43e" on public.tools;
drop policy if exists "tools_manage_admin_v43e" on public.tools;

create policy "tools_select_authenticated_v43e"
on public.tools for select to authenticated using (true);
create policy "tools_manage_admin_v43e"
on public.tools for all to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());

drop policy if exists "Authenticated users read tool history" on public.tool_transactions;
drop policy if exists "Authenticated users create tool history" on public.tool_transactions;
drop policy if exists "Admins delete tool history" on public.tool_transactions;
drop policy if exists "tool_transactions_select_admin_or_self" on public.tool_transactions;
drop policy if exists "tool_transactions_select_admin_or_self_v43e" on public.tool_transactions;
drop policy if exists "tool_transactions_insert_admin_or_self_v43e" on public.tool_transactions;
drop policy if exists "tool_transactions_manage_admin_v43e" on public.tool_transactions;

create policy "tool_transactions_select_admin_or_self_v43e"
on public.tool_transactions
for select
to authenticated
using (
  public.aimcg_is_admin()
  or exists (
    select 1 from public.workers own_worker
    where own_worker.profile_id = auth.uid()
      and coalesce(own_worker.inactive, false) = false
      and own_worker.id in (tool_transactions.worker_id, tool_transactions.from_worker_id)
  )
);
create policy "tool_transactions_manage_admin_v43e"
on public.tool_transactions
for all
to authenticated
using (public.aimcg_is_admin())
with check (public.aimcg_is_admin());

-- Ensure all tables used by the app's live views are in the Realtime publication.
do $$ begin
  alter publication supabase_realtime add table public.jobs;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_bookings;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.workers;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_notes;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_history;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.attachments;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_completion_submissions;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.machinery;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.machinery_bookings;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tools;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.tool_transactions;
exception when duplicate_object then null; when undefined_table then null; end $$;

do $$ begin
  alter publication supabase_realtime add table public.job_visit_history;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.messages;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.job_financials;
exception when duplicate_object then null; when undefined_table then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.employee_costs;
exception when duplicate_object then null; when undefined_table then null; end $$;

comment on function public.aimcg_replace_job_bookings(uuid, jsonb) is
  'Atomically replaces a job booking set while preserving newer trade status/time for the same visit.';

comment on function public.aimcg_save_job_with_bookings(jsonb, jsonb) is
  'Atomically saves a job and its complete booking set so Trade View never sees an intermediate unbooked job.';

comment on function public.aimcg_save_machinery_booking(jsonb) is
  'Atomically saves one machinery booking under a per-machine conflict lock.';

comment on function public.aimcg_replace_job_machinery_bookings(uuid, jsonb) is
  'Atomically replaces the machinery assigned to a job and rejects unavailable or conflicting machines.';

comment on function public.aimcg_apply_tool_action(uuid, text, uuid, text) is
  'Atomically applies a tool action and records its immutable history event.';
