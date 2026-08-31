# v51f focused regression check

## Job tags
- Open an existing job, type a new/existing tag, do NOT press Add, then press Save job.
- Confirm the Save button changes to Saving... while Supabase responds.
- Reopen the same job and confirm the tag is still present.
- Refresh/reload the app and confirm the tag remains present.
- Search/filter for the saved tag and confirm the job is returned.
- Add two tags, remove one, save, reopen, and confirm the final tag list is correct.
- Disconnect/break Supabase temporarily if practical and confirm a failed save leaves the editor open with an error rather than silently closing.

## Trade Schedule
- Log in as a Trade user and confirm `View as` is no longer shown.
- Confirm the user can still see their own schedule and open jobs normally.

## Sanity
- Create/edit/save a normal job with no tag.
- Confirm calendar/job preview still displays saved tags.
- Confirm tag filter remains functional.
