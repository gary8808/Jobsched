# AIM Jobsched v51d deployment

1. No new Supabase migration is required for v51d. If the v51c migration has already been applied, leave the database unchanged.
2. Extract the v51d ZIP.
3. Replace the repository files with the extracted v51d files, preserving your existing GitHub Pages workflow unless you intentionally maintain it separately.
4. Commit and push the change.
5. Allow GitHub Actions / Pages to complete the Vite build and deployment.
6. Hard-refresh the deployed app after Pages reports success.

## Focused checks
- Add `Access Anytime` to a job, save it, then search `access anytime` from a different active bucket. The tagged job should appear.
- Confirm Required Trade/s is absent from Create/Edit Job.
- Open People, drag the bottom active worker to the top, click Save people, refresh, and confirm the order persists on the People list and Admin calendar.
- Confirm the left calendar arrow overlays the boundary between the job buckets and calendar on a normal desktop/laptop view.
