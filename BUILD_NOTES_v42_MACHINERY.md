# AIM CG v42 – Machinery Scheduling

## Included
- New admin-only **Machinery** tab beside Schedule.
- Machinery list on the left and AM/PM calendar on the right.
- Full-day, AM and PM bookings.
- Multiple machines can be allocated to a job in Edit Job → Scheduling.
- Each job machinery booking has a machine, employee, date range and period.
- Ad hoc bookings with a free-text description.
- Maintenance and repairs booking types.
- Conflict detection blocks overlapping bookings.
- Out-of-service machines cannot be booked.
- Settings → Manage machinery for machine type, asset number, registration, base location, notes and availability.
- Employees can read machinery assigned to their job.
- Booking created/updated timestamps and database audit trail.

## Deployment order
1. In Supabase SQL Editor, run `SUPABASE_MIGRATION_v42_MACHINERY.sql` once.
2. Upload the repository files to GitHub and deploy.
3. Hard refresh the browser/PWA after deployment.

## Important
The migration is required before opening the Machinery tab. It creates the machinery tables, RLS policies, indexes, realtime publication entries and audit trigger.
