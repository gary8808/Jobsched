# AIM CG v43e — consolidated code and Supabase review

This build was prepared from the repository uploaded on 3 August 2026. It is a structural sync and transaction repair, not another isolated UI patch.

## Main faults found

1. **One failed query could block unrelated data.** Earlier loading paths mixed workers, jobs, admin-only messages, machinery and tools. A Trade login could be refused access to an admin-only table and never receive otherwise-valid jobs or machinery.
2. **Realtime was being treated as the initial load.** Realtime delivers changes after subscription; it does not return rows that already exist. This caused machinery/tools to remain empty until another item was added.
3. **Job and booking writes were not atomic.** The app could save the job row, remove old bookings and then fail before adding replacements. During that gap Trade View could lose the job because its RLS access depends on an assigned booking.
4. **Trade View could use stale admin dates.** RLS may expose only the logged-in Trade's booking. If that row was an ad hoc, additional or rescheduled occurrence, the app could still filter using the old primary dates stored in the job payload.
5. **Optional tables could suppress the core schedule.** A missing/blocked notes, history, attachments, completion, visit or finance query could prevent core jobs and bookings from rendering.
6. **Browser cache and seeded records could restore old workers/jobs.** Supabase now remains authoritative for those records.
7. **Worker identity could fall back to the wrong employee.** Trade logins now resolve by `workers.profile_id`; email matching is only a legacy fallback where no profile link exists.
8. **Concurrent machinery bookings and tool actions were not transaction-safe.** Conflict checking and audit writes could race between devices.
9. **New employee hourly cost could be skipped.** A new employee previously had a temporary local ID when costs were saved; the build now uses the UUID returned by Supabase.
10. **Message action notes could disappear after refresh.** The action/reply was visible locally but the linked job note was not consistently persisted.

## Changes included

- Independent initial loaders for workers, jobs/bookings, admin messages, machinery/bookings and tools/history.
- Immediate initial fetch for existing machinery and tools, plus Realtime, focus/visibility refresh and polling fallbacks.
- Request sequence guards so a slow response from an earlier session cannot repopulate the next user's screen.
- Separate Realtime channels for core jobs/bookings and optional enrichment tables. A restricted optional table cannot disable scheduling updates.
- Supplemental job data uses settled queries; core jobs/bookings still display if notes, attachments, history or finance cannot be read.
- Trade View promotes its RLS-visible booking dates, including normal, ad hoc, additional and rescheduled bookings.
- Atomic `aimcg_save_job_with_bookings` RPC: job row and complete booking set commit together or roll back together.
- Atomic machinery save/conflict RPC with a per-machine advisory lock.
- Atomic job-machinery replacement RPC.
- Atomic tool action and audit-history RPC.
- Per-job browser save queue and refresh deferral while this browser is saving.
- Existing Trade status and labour time are retained when an admin edits/reschedules the same visit.
- Defect/current-visit separation and prior-visit labour/history are retained.
- Supabase-backed demo/cache fallback removed for employees, jobs, messages, machinery and tools. Only leave records remain local in this release.
- Conditional unique guard for `workers.profile_id`; duplicate profile links are reported without aborting the migration.
- New employees receive a Supabase UUID before cost/invite processing.
- Message action/reply notes are persisted with the job.
- Service-worker cache version changed so installed PWAs request the new app files.
- Deployment workflow rejects merge markers and `.bak`/`.orig` source files.
- `package.json` declares ESM, avoiding the Vite native-config warning for `vite.config.js`.

## Deployment order

1. In **Supabase → SQL Editor**, run `SUPABASE_MIGRATION_v43e_SYNC_AND_ATOMIC_BOOKINGS.sql` in full.
2. Replace the GitHub repository with this build, or at minimum replace the files listed in the release message.
3. Commit/push and let the GitHub Pages workflow finish.
4. Hard-refresh browser sessions. Fully close and reopen installed PWA sessions once.

The migration is designed to be rerun. It does not delete jobs, workers, machinery or tools. If duplicate `workers.profile_id` links already exist, it raises a notice and skips only the unique index so the rest of the migration can continue.

## Acceptance checks

Use `TEST_MATRIX_v43e.md` after deployment. The most important checks are:

- Existing machinery appears immediately without adding another machine.
- A normal Admin booking appears for the assigned Trade.
- An Admin-created ad hoc item appears for the assigned Trade.
- An additional/rescheduled occurrence appears on its actual dates, not the old job dates.
- Refreshing either device does not remove bookings.
- Existing tools appear immediately.
- Worker identity matches the login's `profile_id` and deleted demo employees do not return.

## Known limitations deliberately not expanded in this repair

- Leave/roster exception records are still local to one browser and should be moved to Supabase in a later build.
- A Trade status update currently applies to that worker's current job visit. If the same worker is deliberately booked to the same job in multiple separate occurrences within one visit, those occurrences do not yet have independent attendance statuses.
- Removing a previously uploaded attachment from the Job modal removes it from the form only; permanent Storage/database deletion should be added as a separate, confirmed workflow.
- Machinery allocated to a job uses its own selected dates. It does not automatically move when the job is later rescheduled unless the machinery allocation is edited.
- NPM dependencies remain declared as `latest` because the repository does not currently use a portable lockfile. This is a build reproducibility risk and should be addressed after the application stabilises.

## Validation completed

- TypeScript/JSX syntax check: passed.
- TypeScript AST parse diagnostics: zero.
- Duplicate top-level declarations: zero.
- Conflict-marker and backup-source checks: passed.
- `package.json` and PWA manifest JSON validation: passed.
- Focused Trade booking-date mapping checks: passed for primary, ad hoc/additional and stale-payload cases.
- SQL migration reviewed for idempotent policy/function replacement and balanced dollar-quoted function bodies.

A complete local Vite production build could not be performed because this execution environment's internal npm registry does not provide `@supabase/supabase-js`. GitHub Actions remains the final dependency and production-build validation.
