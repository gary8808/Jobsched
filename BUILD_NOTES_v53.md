# AIM Jobsched v53 Build Notes

## Main changes

### Warehouse role
- Added a new `warehouse` application role.
- Warehouse users open into the Admin-style schedule automatically, but the schedule is read-only.
- Warehouse users can see all workers and scheduled jobs required for stores coordination.
- Warehouse users cannot create, drag, reschedule, delete, confirm, or otherwise alter job/calendar bookings.
- People management, FastField imports, Tradify imports, messages, sharing, machinery management and the Job Dashboard remain Admin-only.
- Warehouse users receive full inventory access, including item/location management, stock movements, imports, QR label printing and inventory history.
- Warehouse Reports are restricted to `Inventory stock on hand` and `Inventory low stock`.
- Job financial values and internal employee costs remain Admin-only and are not loaded for Warehouse users.
- The People screen now allows `Employee`, `Warehouse`, and `Admin` permission levels.
- Saving People synchronises the selected app role to the linked Supabase profile using the new v53 RPC.
- The invite-worker Edge Function now accepts the Warehouse role.

### Machinery calendar
- Machinery no longer derives its displayed week from the main Admin calendar's current week.
- `This week` recalculates from the device's current local date every time it is pressed.
- Previous/Next week navigation now operates from the Machinery calendar's own week state.

### Stability / tidy-up
- Legacy `Awaiting Parts` job-category rows are migrated to `To be rescheduled`; material readiness continues to be controlled by Materials Status.
- Share Schedule recipient selection was simplified: email sharing now targets active workers with saved email addresses rather than maintaining the old All Workers / Onsite Workers mode selector.
- Reviewed the current calendar source for the previously discussed multi-day resize control; no active resize UI/code path remains in v52b, so there was nothing further to remove in v53.
- Warehouse restrictions are enforced in both the UI and Supabase RLS/RPC logic rather than relying only on hidden buttons.

## Supabase
Run `SUPABASE_MIGRATION_v53_WAREHOUSE_ROLE_STABILITY.sql` once before deploying the frontend.

The migration:
- adds Warehouse role helpers;
- grants Warehouse read-only access to workers/jobs/bookings/notes/history needed by the Admin calendar;
- prevents Warehouse users from using the Employee assigned-job update policy;
- extends stores access to Warehouse users;
- keeps workers/job bookings/job financials/employee costs Admin-only for mutation/private values;
- adds an Admin-only role-sync RPC;
- cleans up legacy Awaiting Parts job rows.

## Edge Function
Redeploy `supabase/functions/invite-worker/index.ts` so new Warehouse users can be invited directly from People.

## Validation performed
- TypeScript parser successfully parsed `src/main.jsx` as JSX after the changes.
- v53 role/search strings and removed legacy selectors were checked statically.
- ZIP integrity should be verified after packaging.
- A full Vite build could not be completed in this environment because dependency installation timed out; GitHub Actions remains the full dependency/build validation.
