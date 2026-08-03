# v43h Realtime mobile subscription fix

This build includes the v43g cleanup-variable correction and fixes the mobile Supabase Realtime error:

`Cannot add postgres_changes callbacks for realtime:aimcg-jobs-core...`

Changes:
- Every Realtime subscription now uses a unique topic per effect instance.
- Cleanup still removes the exact channel object created by that effect.
- Subscription status callbacks log CHANNEL_ERROR, TIMED_OUT and CLOSED states.
- Applied consistently to workers, messages, jobs core, jobs enrichment, machinery and tools.
- Existing focus/visibility refresh remains as a fallback when mobile browsers resume.

No database migration is required for this fix.
