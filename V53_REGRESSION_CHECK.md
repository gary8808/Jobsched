# AIM Jobsched v53 Focused Regression Check

## Warehouse role — priority
- [ ] Admin can set an employee permission level to Warehouse and Save People.
- [ ] Reopening People shows the employee still set to Warehouse.
- [ ] New Warehouse invite creates a working login.
- [ ] Warehouse login header shows `warehouse`.
- [ ] Warehouse opens directly to the Admin-style schedule.
- [ ] Warehouse can see all expected active workers.
- [ ] Warehouse can see scheduled jobs across workers.
- [ ] Warehouse cannot create a new job / PDF drop job.
- [ ] Warehouse cannot drag a bucket job onto the calendar.
- [ ] Warehouse cannot drag an existing calendar booking.
- [ ] Warehouse cannot add an ad-hoc/calendar item.
- [ ] Warehouse cannot edit/delete a job from a bucket card.
- [ ] Warehouse cannot edit a calendar job, toggle SMS/client accepted, or confirm completion.
- [ ] Warehouse does not see Quick Actions for copy/delete booking.
- [ ] Warehouse does not see Job Dashboard.
- [ ] Warehouse does not see People management.
- [ ] Warehouse does not see Share, Messages, FastField or Tradify import controls.

## Warehouse inventory
- [ ] Inventory menu is available.
- [ ] Search/filter inventory works.
- [ ] Add inventory item works.
- [ ] Edit/archive/delete inventory item works according to existing history rules.
- [ ] Add/edit warehouse locations works.
- [ ] Excel inventory import still works.
- [ ] Stock receipt/adjustment/transfer/job issue works.
- [ ] QR label printing works.
- [ ] Live QR job-material workflow still works.
- [ ] Available quantity and over-issue protection still work.

## Warehouse reports / privacy
- [ ] Reports menu opens **Stock Reports**.
- [ ] Only Inventory stock on hand and Inventory low stock are selectable.
- [ ] Warehouse can print/export those stock reports.
- [ ] Jobs completed/active/all reports are not available.
- [ ] Inventory job costs report is not available.
- [ ] Job value is not visible anywhere accessible to Warehouse.
- [ ] Internal employee hourly costs are not visible.
- [ ] Direct normal UI actions cannot add/delete/manage employees.

## Admin regression
- [ ] Admin still sees the full Admin calendar and Job Dashboard.
- [ ] Admin can create/edit/drag/delete bookings as before.
- [ ] Admin can switch to Trade View from Settings as before.
- [ ] Admin still sees full Reports including financial/job reports.
- [ ] Admin People management still works.
- [ ] Existing Employee + Stores permission remains supported.
- [ ] Changing a linked user Employee → Warehouse → Employee updates the login role after re-login/refresh.

## Trade regression
- [ ] Normal Trade login still sees only its own Trade View/schedule.
- [ ] Trade cannot see Admin calendar.
- [ ] Trade inventory permissions remain read/issue-only unless Stores permission is explicitly granted.
- [ ] Trade QR live scan still adds the selected material to the open job.

## Machinery
- [ ] Open Machinery while the main Admin calendar is on an old/future week.
- [ ] Press **This week**.
- [ ] Machinery shows the actual current local week.
- [ ] Previous week moves exactly 7 days back.
- [ ] Next week moves exactly 7 days forward.
- [ ] Pressing This week again returns to the actual current week.
- [ ] Mobile Machinery layout from v52b remains compact and booking cells remain visible.

## Cleanup / stability
- [ ] No Awaiting Parts bucket appears in the UI.
- [ ] Historical Awaiting Parts jobs migrated to To be rescheduled after the SQL migration.
- [ ] Share Schedule no longer shows All Workers / Onsite Workers recipient selector.
- [ ] Share Schedule email still populates active workers with email addresses.
- [ ] Main Admin mobile calendar sticky dates/arrows still behave correctly.
- [ ] Tags still save and tag search/filter still work.
- [ ] FastField and Tradify imports still load for Admin.
