# AIM Jobsched v51b – deployment steps

1. Do not deploy the earlier v51a ZIP.
2. Upload the contents of `aim-cg-v51b-stability-hotfix.zip` to the repository, replacing the current app files.
3. Commit to `main` and allow one fresh GitHub Pages workflow run to complete. Do not re-run an older failed workflow run.
4. The Supabase migration and `revoke-worker` Edge Function from v51a are unchanged. If you already applied them, do not apply them again. If you have not, apply the v51a migration and deploy the v51a `revoke-worker` function before regression testing.
5. After deployment, hard refresh the app and confirm the version is v51b / 1.51.2, then retest the v51a affected areas.
