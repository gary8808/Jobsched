# v53 Deployment Steps

1. **Run the Supabase migration first**
   - Open Supabase → SQL Editor.
   - Open `SUPABASE_MIGRATION_v53_WAREHOUSE_ROLE_STABILITY.sql`.
   - Run the complete file once.
   - Confirm it finishes without an error.

2. **Redeploy the invite-worker Edge Function**
   - Deploy the updated `supabase/functions/invite-worker/index.ts` using the same method used for the existing invite-worker function.
   - This is required for newly invited Warehouse users to receive the `warehouse` profile role.

3. **Deploy the v53 frontend**
   - Replace the repository contents with the files from `aim-cg-v53.zip` using the normal Jobsched deployment process.
   - Commit/push and allow GitHub Actions to complete.
   - Check that Install dependencies, Build and Pages deployment all pass.

4. **Refresh installed/mobile copies**
   - Close/reopen the installed PWA or hard refresh the browser after deployment.

5. **Create/test one Warehouse login**
   - Admin → Settings → People.
   - Select/add the employee.
   - Set Permission level to **Warehouse**.
   - Save People.
   - For a new login, tick Send invite and verify the invite-worker Edge Function succeeds.

6. **Run the focused v53 regression checklist**
   - Use `V53_REGRESSION_CHECK.md` before wider rollout.
