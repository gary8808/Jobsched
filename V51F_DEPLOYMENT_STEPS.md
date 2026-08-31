# AIM Jobsched v51f deployment

1. Confirm `SUPABASE_MIGRATION_v51e_TAG_LINKS_TRADE_INVENTORY.sql` has already been successfully applied.
2. Upload the contents of `aim-cg-v51f-hotfix.zip` to the GitHub repository, replacing the current app files.
3. Commit/push and allow the existing GitHub Pages workflow to complete.
4. On the iPad/laptop, close any open AIM Jobsched tabs and reopen the app. If an old version remains visible, refresh once so the new service-worker cache activates.
5. Run the short v51f regression test.

No new Supabase SQL or Edge Function deployment is required for this build.
