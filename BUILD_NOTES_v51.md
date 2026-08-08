# AIM CG v51

## Included
- Trade View job cards now default to compact/collapsed and expand on selection.
- Trade View shows an after-6:15pm running-time reminder when a job is still Onsite/running.
- Machinery labels in Trade View now resolve assigned machinery more reliably; v51 migration also permits trades to read machinery already assigned to their booking.
- Missing site/address no longer makes a normal job appear in Action Needed.
- Calendar status tab only uses the green/confirmed state when Client Accepted is actually ticked.
- Schedule and daily run-sheet Excel exports include `JobType` (`Quoted work`, `Ad-hoc`, `Travel`).
- Inventory Excel import tab includes a downloadable template.
- Tool Register includes downloadable Excel template and bulk Excel upload.
- Manage machinery moved to the Machinery page; tool management remains on the Tool Register page rather than Settings.
- FastField close-outs and Tradify job-pack imports moved to Settings.
- FastField automatic matching now uses AIM Job Number as the primary/required matching key; work order is supplementary only.
- FastField and job-pack screens support Clear/Archived records and safe deletion of unlinked mistaken uploads.
- Job-pack imports can be filtered by Pending and Need review (plus imported/cleared/all).
- Employee access revocation now calls a secure `revoke-worker` Edge Function rather than displaying the temporary-build message.

## Supabase update required
Run `SUPABASE_MIGRATION_v51_UI_IMPORT_HOUSEKEEPING.sql` once in SQL Editor.

Deploy `supabase/functions/revoke-worker/index.ts` as Edge Function `revoke-worker`.

The existing v48/v49 FastField/job-pack migrations and functions remain required.

## Deployment
The included Pages workflow uses Node 24 and `cancel-in-progress: false`.
