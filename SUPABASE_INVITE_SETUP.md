# Jobsched v24 Supabase invite setup

1. Run `supabase/sql/v24_user_invites.sql` in Supabase SQL Editor.
2. Deploy the Edge Function in `supabase/functions/invite-worker/index.ts` as `invite-worker`.
3. Ensure the Edge Function has access to `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.
4. Add `https://gary8808.github.io/Jobsched/` to Supabase Auth redirect URLs.
5. Sign in as an admin user in Jobsched, open People, add/edit a worker, select role, tick "Send invite email / give app access", then Save people.

Do not put the secret/service-role key in the React app or GitHub Pages browser bundle.
