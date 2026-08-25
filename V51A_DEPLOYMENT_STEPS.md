# v51a deployment steps

1. Back up/export the Supabase database before applying the migration.
2. In Supabase SQL Editor run `SUPABASE_MIGRATION_v51a_STABILITY_SECURITY.sql`.
3. In Supabase Edge Functions, replace/deploy `revoke-worker` using `supabase/functions/revoke-worker/index.ts`.
   - Keep JWT verification configured consistently with the current authenticated admin invocation.
   - The function requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets.
4. Upload the v51a repository files to GitHub `main` and allow one fresh Pages workflow run to deploy.
5. Hard refresh / reopen the installed PWA so the v51a service-worker cache activates.
6. Open Settings → FastField Close-outs and choose Refresh and parse. The migration re-queues existing uncleared PDFs for the corrected parser.
7. Regression-test the known failures before beginning multi-user testing.

## Priority regression checks
- Deactivate an employee and revoke access; confirm it saves and login is blocked.
- Reactivate the same employee; confirm the worker is unbanned and can sign in again.
- Move a newly-created employee all the way to the first calendar position and test drag/drop ordering.
- Schedule a worker on RNR/sick/annual leave; confirm warning → Cancel prevents booking, Proceed creates a visible booking.
- Test FastField job `05014` against AIM job `5014` (or equivalent leading-zero case).
- Test FastField additional/further work Yes and No examples.
- Verify machinery name in Trade View and machinery week navigation.
- Attempt to issue/transfer more inventory than available; confirm the database rejects it.
- Verify inventory views are no longer flagged as Security Definer and anonymous API access is denied.
- Verify calendar arrows, sticky employee names/dates/Quick Actions and modal stacking.
