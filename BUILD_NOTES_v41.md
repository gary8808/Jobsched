# AIM CG v41 build

## Included
- Renamed browser/PWA application to AIM CG.
- Reduced the AIM header height and removed the Batman-version subtitle.
- Hid the Supabase status panel from admin and employee views.
- Added collapsible job buckets, especially for mobile screens.
- Raised modal layering so job editing is not obscured by the left navigation on mobile.
- Added an admin-only Reports book icon.
- Added Completed Jobs, Active Jobs and All Jobs reports.
- Added date, client and employee report filters.
- Added on-screen totals, printable/PDF output and Excel export.
- Added admin-only job value entry.
- Added optional admin-only internal hourly cost to employee setup.
- Added combined labour hours, labour cost and value-less-labour reporting.
- Financial fields are held in separate RLS-protected Supabase tables.

## Required deployment order
1. Run `SUPABASE_MIGRATION_v41_REPORTING.sql` in the Supabase SQL Editor.
2. Upload the repository files to GitHub and deploy through the existing GitHub Pages workflow.
3. Sign in as an admin and test employee costs, job values and reports.

## Notes
- Labour hours use the existing Onsite/Offsite recorded time for every employee assigned to the job.
- Labour cost equals each employee's recorded hours multiplied by their internal hourly cost.
- Value less labour is not net profit; it excludes materials, subcontractors, plant and overheads.
- Employees cannot query the financial tables because the SQL migration applies admin-only RLS policies.
