# AIM CG Jobsched v51a — stability patch

Built from v51 after the completed functional test pass.

## Confirmed fixes included
- FastField job-number matching now normalises leading zeroes for comparison while retaining the raw submitted value.
- FastField further-work parsing now uses explicit Yes/No answers and ignores question-label fragments.
- Existing uncleared FastField PDFs are queued for re-parse by the v51a migration.
- Scheduling an employee who is on RNR/leave/unavailable now prompts the admin to confirm before proceeding. If confirmed, the job remains visible normally on all calendars.
- Employee calendar ordering no longer treats order `0` as missing; Move Up/Down is rebalanced sequentially.
- Active employee list supports drag/drop calendar ordering.
- Employee reactivation calls the access Edge Function to reactivate the profile and remove the auth ban.
- Deactivation with access removal saves immediately after the admin confirms revocation.
- Inventory movements/transfers use atomic RPCs that reject outbound quantities greater than stock on hand.
- Inventory stock/low-stock views are converted to `security_invoker` and anonymous grants are revoked.
- Machinery Trade View lookup accepts legacy `name`/`description` fields as fallbacks instead of displaying Unnamed.
- Machinery calendar has Previous week / This week / Next week controls.
- Admin calendar side arrows now move a full week and are kept below modal windows.
- Calendar date headers and employee names remain sticky; filter/week/Quick Actions controls stay accessible on desktop while scrolling.
- Desktop/laptop layout density is reduced so 100% browser zoom shows substantially more calendar content.
- Travel/accommodation edit view is simplified and no longer presents client/SMS or normal scheduling tabs.
- Scheduling employee selection is searchable and the old “Employees for main dates” wording is removed.
- Trade mismatch and employee double-booking warnings are removed; roster/leave availability warning remains.
- Inventory job search no longer shows “No matching jobs” after a job has already been selected.
- Import count bubbles below FastField and Tradify filters are removed.
- Service-worker cache name bumped for clean v51a activation.

## 6:15 pm reminder
The existing one-per-day browser/PWA notification behaviour remains. It fires once after 6:15 pm when a timer is still running, provided notification permission has already been granted. True background push while the app is fully closed would require a Web Push subscription/push service and is not introduced in this patch.

## Intentionally deferred
The following low-risk simplifications from the test notes are not forced into this stability patch because they would change established workflows/data semantics:
- Removing the legacy Awaiting Parts category from historical jobs.
- Removing multi-day resize code entirely.
- Removing Share Schedule recipient modes.
These can be removed after v51a regression testing if still desired.
