# Jobsched v25 password setup notes

This build fixes the login reset handler and adds a password setup panel for invite/recovery links.

## Supabase settings to check

Authentication -> URL Configuration:

- Site URL: `https://gary8808.github.io/Jobsched/`
- Redirect URL: `https://gary8808.github.io/Jobsched/`

## What the app now does

- Forgot password sends a reset email using `supabase.auth.resetPasswordForEmail`.
- Invite/recovery links redirect back to Jobsched.
- Jobsched detects `type=invite` or `type=recovery` from the returned URL/session.
- Jobsched shows a create/reset password panel.
- The password is saved with `supabase.auth.updateUser({ password })`.

No new SQL is required beyond the v24 grants and invite setup.
