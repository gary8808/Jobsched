# v53a Focused Regression Check

## Warehouse calendar/job access
- Warehouse can see the full Admin calendar.
- Clicking a calendar job opens the Warehouse job window.
- Job title, job number, WO, client, site/address, scheduled dates, assigned employees and description/scope are visible.
- Warehouse cannot drag/reschedule a booking or use empty calendar cells to create work.
- Warehouse cannot change dates, assigned employees, bucket/status, client/SMS, machinery bookings, job references or tags.
- Job financial value and employee labour-cost information are not visible.

## Materials
- Warehouse can open Materials from the job.
- Existing inventory issued to the job is visible.
- Add inventory material / QR workflow succeeds.
- Quantity available and over-issue safeguards still work.
- Materials Status can be changed and persists after refresh.
- Special Order Materials can be added/removed and persist after refresh.
- Save Materials does not alter the job booking, assigned employees or category.

## Notes / attachments / history
- Existing job Notes are visible.
- Warehouse cannot change note visibility or edit/delete notes in this modal.
- Existing Attachments are visible and Open works.
- Warehouse cannot upload or remove attachments from this modal.
- Job History is visible.

## Role/security
- Employee login cannot call the Warehouse materials RPC.
- Warehouse still has full inventory management.
- Warehouse still cannot manage People.
- Warehouse Reports still only shows stock-level reports.
- Admin job editing remains unchanged.
- Open at least one storage-backed PDF/image attachment as Warehouse (not just an old public/data URL attachment).
