-- Jobsched v32 - employee update / notes integration foundation
-- This keeps the current broad pilot access model, while allowing employee status
-- changes and completion updates to write to job_notes and job_history.

grant usage on schema public to authenticated, service_role;

grant select, insert, update, delete on public.job_notes to authenticated;
grant select, insert, update, delete on public.job_history to authenticated;
grant select, insert, update, delete on public.job_notes to service_role;
grant select, insert, update, delete on public.job_history to service_role;

drop policy if exists "Authenticated users can manage notes during pilot" on public.job_notes;
create policy "Authenticated users can manage notes during pilot"
on public.job_notes
for all
to authenticated
using (true)
with check (true);

drop policy if exists "Authenticated users can manage history during pilot" on public.job_history;
create policy "Authenticated users can manage history during pilot"
on public.job_history
for all
to authenticated
using (true)
with check (true);
