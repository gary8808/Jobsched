-- AIM CG v42c: persist labour time for each current job booking.
-- Safe to run more than once.
alter table public.job_bookings
  add column if not exists total_ms bigint not null default 0,
  add column if not exists running_since timestamptz,
  add column if not exists status_updated_at timestamptz;

comment on column public.job_bookings.total_ms is 'Accumulated stopped labour time in milliseconds for the current booking.';
comment on column public.job_bookings.running_since is 'Timestamp when the current running/onsite period began.';
comment on column public.job_bookings.status_updated_at is 'Timestamp of the most recent employee status change.';
