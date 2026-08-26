# AIM Jobsched v51c

v51c is a focused stability/usability release built from the v51b hotfix.

## Calendar and layout
- Left and right calendar edge arrows are fixed to the viewport at desktop widths.
- Calendar arrows are hidden while any modal is open so they cannot sit over popup windows.
- Edge arrows first scroll horizontally within the visible calendar; when already at the edge, the next click moves to the previous/next week.
- Week changes preserve the current vertical page position.
- Worker filters, week controls and Quick Actions are sticky on desktop.
- Calendar date headers remain sticky while the calendar body scrolls vertically.
- Existing compact desktop-density improvements are retained.
- Machinery calendar is explicitly horizontally scrollable; machine names remain on the left while date columns move.

## FastField close-outs
- Further-work parsing now treats the explicit Yes/No answers as authoritative.
- `Additional works ... = No` cannot create a further-work warning from question-label text.
- Follow-up text is only retained when the governing answer requires it.
- Existing close-outs parsed by an older parser version are eligible for v51c reprocessing.
- Active PDF rows now expose Read PDF/Reprocess even when already matched.
- Leading-zero job number comparison remains normalised for matching.

## Job tags
- Jobs can have multiple reusable tags.
- Tags are edited above Job Description / Scope.
- Users can choose an existing tag or create a new one while editing a job.
- Tags display on the calendar job preview below SMS Sent / Client Accepted.
- Tags also display in the bucket card and Trade View.
- Main job search includes tags.
- A Tag filter is available in the job bucket panel.
- Admin can add, rename or remove reusable tags from Settings > Sites, trades & tags.

## Managed sites and trades
- Sites and trade categories are no longer limited to the original hard-coded list when the v51c migration is installed.
- Admin management is available from Settings > Sites, trades & tags.
- New values feed scheduling filters, employee setup, job site selection, job trade selection and Trade View follow-up trade selection.
- Removing a value archives it from future selection rather than deleting historical job/employee data.
- Renaming a value updates existing relevant job/employee references through the database helper function.
- Duplicate values are prevented case-insensitively.

## Inventory
- Inventory item popup now includes Delete Material / Archive Material.
- An unused material can be permanently deleted.
- A material with stock movement history is archived instead so history remains intact.
- Archived materials are hidden from the active inventory register and summary totals.
- Delete/archive actions are written to `inventory_item_audit`.

## Scheduling behaviour retained/cleaned up
- Scheduling an employee who is RNR/on leave/unavailable prompts Admin to proceed or cancel.
- If Admin proceeds, the booking remains visible on all calendars/Trade View.
- The old onsite-only visibility suppression has been removed.
- The Awaiting Parts job bucket/status option has been removed; material readiness remains handled by Materials Status.

## Database change
Run `SUPABASE_MIGRATION_v51c_TAGS_REFERENCE_INVENTORY.sql` before testing managed Sites/Trades/Tags or material delete/archive audit.

No FastField Edge Function redeployment is required for this release; the v51c parsing correction is in the app's PDF processing/reprocessing logic.
