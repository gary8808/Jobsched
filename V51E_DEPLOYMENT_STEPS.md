# v51e deployment

1. In Supabase SQL Editor, run **SUPABASE_MIGRATION_v51e_TAG_LINKS_TRADE_INVENTORY.sql** once.
2. Confirm the query completes successfully and PostgREST schema reloads.
3. Upload/deploy the contents of **aim-cg-v51e-hotfix.zip** to GitHub as normal.
4. Wait for the GitHub Pages workflow to complete.
5. On the first device test, fully refresh the page. The service-worker cache name has changed, so the old v51d cache will be retired.
6. Reopen an existing job, add a tag, save, close and reopen it. Confirm the tag remains before testing tag search.
7. Test Trade View materials using a normal Trade account assigned to the test job.

## Important
This build adds the `jsqr` npm dependency. The GitHub build must run the normal dependency install step before `npm run build`.
