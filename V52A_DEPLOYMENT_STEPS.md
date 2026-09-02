# AIM Jobsched v52a Deployment

1. Confirm `SUPABASE_MIGRATION_v52_QR_INVENTORY.sql` from v52 has already been run successfully.
2. No new SQL is required for v52a.
3. Replace the repository contents with the files from `aim-cg-v52a.zip`, preserving your existing GitHub Actions workflow/settings if these are managed separately.
4. Commit and push the update.
5. Confirm GitHub Actions completes the install/build/deploy stages successfully.
6. On the iPad/phone, close any open Jobsched tabs/PWA window and reopen it so the `aim-cg-v52a` service-worker cache is loaded.
7. Test the live QR scanner from Trade View on an actual HTTPS deployment. Browser camera permission will be requested the first time.

Important: live camera access requires HTTPS (or localhost). GitHub Pages provides HTTPS.
