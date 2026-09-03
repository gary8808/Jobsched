# v53a Deployment

1. In Supabase SQL Editor, run `SUPABASE_MIGRATION_v53a_WAREHOUSE_JOB_MATERIALS.sql` once.
2. Upload/deploy the v53a project files to GitHub as normal.
3. Wait for GitHub Pages Actions to complete successfully.
4. On test devices, fully refresh/reopen the PWA so the `aim-cg-v53a` service-worker cache is active.
5. Log in as a Warehouse user and test a scheduled job from the Admin calendar.

No Edge Function redeployment is required specifically for v53a if the v53 invite-worker function is already deployed.
