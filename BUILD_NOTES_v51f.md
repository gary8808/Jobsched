# AIM Jobsched v51f hotfix

## Scope
Focused hotfix for job tag persistence and Trade Schedule simplification.

## Changes
- Save Job now automatically commits any pending text in the Tags field before saving, even if Add was not pressed.
- Job save waits for Supabase persistence (including `aimcg_replace_job_tags`) before closing the editor.
- Save button shows `Saving...` and is disabled during persistence to prevent duplicate submissions.
- If Supabase save/tag sync fails, the job editor remains open and a visible error is shown so the user can retry.
- Existing Add/Enter tag workflow remains available.
- Removed the `View as` employee selector from Trade Schedule.
- Service-worker cache bumped to `aim-cg-v51f-hotfix`.
- Package version bumped to 1.51.6.

## Database
No new migration is required for v51f. The v51e tag-link migration must already be applied.
