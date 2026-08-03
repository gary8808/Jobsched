-- AIM CG v42f: associate employee completion notes with the active job visit.
-- Safe to run more than once.

alter table public.job_notes
  add column if not exists visit_id text;

create index if not exists job_notes_job_visit_idx
  on public.job_notes (job_id, visit_id, created_at desc);

-- Backfill recent completion notes for current defect visits where possible.
-- Existing notes remain intact even when a visit cannot be inferred.
update public.job_notes n
set visit_id = nullif(j.app_payload ->> 'currentVisitId', '')
from public.jobs j
where n.job_id = j.id
  and n.visit_id is null
  and n.note_type in ('completion', 'completion_follow_up')
  and nullif(j.app_payload ->> 'currentVisitId', '') is not null
  and n.created_at >= coalesce(
    nullif(j.app_payload ->> 'currentVisitStartedAt', '')::timestamptz,
    n.created_at
  );
