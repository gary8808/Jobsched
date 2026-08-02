-- AIM CG v42d: separate employee status/time for each rescheduled defect visit.
-- Safe to run more than once.
alter table public.job_bookings
  add column if not exists visit_id text;

comment on column public.job_bookings.visit_id is
  'Identifies the current visit/callback cycle so previous completion status and labour are not reused.';
