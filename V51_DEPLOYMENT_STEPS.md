# AIM CG v51 deployment steps

Deploy in this order so the new housekeeping and permission functions are available before staff use the new controls.

1. **Run the Supabase migration**
   - Open Supabase > SQL Editor.
   - Run `SUPABASE_MIGRATION_v51_UI_IMPORT_HOUSEKEEPING.sql`.
   - This adds import Clear/archive fields, machinery read access for assigned workers, and admin delete policies for unlinked import PDFs.

2. **Deploy the new revoke-worker Edge Function**
   - Deploy `supabase/functions/revoke-worker/index.ts` as the `revoke-worker` function.
   - The function requires the existing Supabase project URL, anon key and service role key environment values available to Edge Functions.
   - Keep access to the function authenticated; it also independently validates the caller and requires an active Admin profile before making auth changes.

3. **Deploy the v51 web app**
   - Upload/commit the package to the GitHub repository and run the existing Pages workflow.
   - `.github/workflows/deploy.yml` is set to `cancel-in-progress: false`.

4. **Hard refresh and smoke test**
   - Admin: Settings > FastField close-outs and Tradify job-pack imports.
   - Admin: Machinery > Manage machinery and Tools > Manage tools/bulk upload.
   - Trade: open/collapse a job, confirm machinery name, start/stop a timer.
   - Drag a not-client-accepted job from To be scheduled onto the calendar and confirm it does not receive the green confirmed state.
   - Export a run sheet/schedule and confirm the `JobType` column is present.

## Notes

- FastField automatic matching now uses the AIM job number as the primary automatic identifier. Work order is stored as supporting information but is not required.
- Clear/archive hides an import from the active integration work list while retaining its database record and any job/PDF association.
- Delete is intentionally limited to unlinked imports so an attached close-out/job pack cannot accidentally remove a job document.
- The trade running-time reminder is an in-app warning after 6:15 pm when the worker still has a running timer. If browser notification permission was already granted, it also sends one browser notification per day; v51 does not force a notification-permission prompt.
