-- AIM CG v42 machinery scheduling
create extension if not exists pgcrypto;

create table if not exists public.machinery (
  id uuid primary key default gen_random_uuid(),
  machine_type text not null,
  asset_number text,
  registration text,
  base_location text,
  notes text,
  status text not null default 'available' check (status in ('available','out_of_service','inactive')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.machinery_bookings (
  id uuid primary key default gen_random_uuid(),
  machine_id uuid not null references public.machinery(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  worker_id uuid references public.workers(id) on delete set null,
  start_date date not null,
  end_date date not null,
  period text not null default 'full_day' check (period in ('am','pm','full_day')),
  booking_type text not null default 'ad_hoc' check (booking_type in ('job','ad_hoc','maintenance','repairs')),
  description text,
  created_by uuid references auth.users(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create index if not exists machinery_bookings_machine_dates_idx on public.machinery_bookings(machine_id,start_date,end_date);
create index if not exists machinery_bookings_job_idx on public.machinery_bookings(job_id);
create index if not exists machinery_bookings_worker_idx on public.machinery_bookings(worker_id);

alter table public.machinery enable row level security;
alter table public.machinery_bookings enable row level security;

drop policy if exists "Authenticated users can read active machinery" on public.machinery;
create policy "Authenticated users can read active machinery" on public.machinery for select to authenticated using (active = true or exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true));

drop policy if exists "Admins manage machinery" on public.machinery;
create policy "Admins manage machinery" on public.machinery for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true));

drop policy if exists "Authenticated users read machinery bookings" on public.machinery_bookings;
create policy "Authenticated users read machinery bookings" on public.machinery_bookings for select to authenticated using (
  exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true)
  or exists(select 1 from public.workers w where w.id=machinery_bookings.worker_id and w.profile_id=auth.uid())
);

drop policy if exists "Admins manage machinery bookings" on public.machinery_bookings;
create policy "Admins manage machinery bookings" on public.machinery_bookings for all to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true)) with check (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true));

grant select on public.machinery, public.machinery_bookings to authenticated;
grant insert, update, delete on public.machinery, public.machinery_bookings to authenticated;

-- Optional realtime. Safe to run even when already added.
do $$ begin
  alter publication supabase_realtime add table public.machinery;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.machinery_bookings;
exception when duplicate_object then null; end $$;

create table if not exists public.machinery_booking_audit (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid,
  action text not null,
  changed_by uuid references auth.users(id) on delete set null default auth.uid(),
  changed_at timestamptz not null default now(),
  previous_data jsonb,
  new_data jsonb
);
alter table public.machinery_booking_audit enable row level security;
drop policy if exists "Admins read machinery booking audit" on public.machinery_booking_audit;
create policy "Admins read machinery booking audit" on public.machinery_booking_audit for select to authenticated using (exists(select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.active=true));
grant select on public.machinery_booking_audit to authenticated;

create or replace function public.audit_machinery_booking_changes() returns trigger language plpgsql security definer set search_path=public as $$
begin
  if tg_op='INSERT' then
    insert into public.machinery_booking_audit(booking_id,action,new_data) values(new.id,'created',to_jsonb(new));
    return new;
  elsif tg_op='UPDATE' then
    insert into public.machinery_booking_audit(booking_id,action,previous_data,new_data) values(new.id,'updated',to_jsonb(old),to_jsonb(new));
    return new;
  else
    insert into public.machinery_booking_audit(booking_id,action,previous_data) values(old.id,'deleted',to_jsonb(old));
    return old;
  end if;
end $$;
drop trigger if exists machinery_booking_audit_trigger on public.machinery_bookings;
create trigger machinery_booking_audit_trigger after insert or update or delete on public.machinery_bookings for each row execute function public.audit_machinery_booking_changes();
