# v52 Focused Regression Check

## QR label administration
- [ ] Inventory page opens for Admin/Stores.
- [ ] Print QR labels opens.
- [ ] Search/filter label list works.
- [ ] Select shown and Clear work.
- [ ] Single label prints.
- [ ] Batch labels print as separate 62 × 45 mm pages.
- [ ] Individual item > Print label works.
- [ ] Printed QR points to the current Jobsched base URL with the inventory UUID.
- [ ] Renaming the material does not invalidate an already printed QR.

## Trade manual issue
- [ ] Trade opens an assigned job > Materials > Add materials.
- [ ] Manual material search works by item/name/location.
- [ ] Quantity available is visible.
- [ ] Valid quantity issues to the job.
- [ ] Job material list updates.
- [ ] Available stock decreases correctly.
- [ ] Quantity above available stock is blocked.
- [ ] Trade cannot edit, delete, archive, transfer or adjust inventory.

## Trade QR issue — in app
- [ ] Scan QR button can access camera/photo capture on iPad/phone.
- [ ] Correct item is selected from printed label.
- [ ] Correct location and available quantity are shown.
- [ ] QR issue saves to the current assigned job.
- [ ] Inventory movement reference identifies QR scan issue.
- [ ] Invalid/archived item QR shows a clear error.

## QR deep link — native camera
- [ ] Scan printed label with iPad/phone Camera app.
- [ ] Logged-in user opens directly to Scanned material.
- [ ] Logged-out user can sign in without losing the scanned stock link.
- [ ] Trade sees only active jobs assigned to their authenticated worker record.
- [ ] Admin/Stores user can select an active job.
- [ ] Correct location can be selected when the same item exists at multiple locations.
- [ ] Issue succeeds and stock/job history update.
- [ ] Closing the modal clears the `stock` query parameter.

## Concurrency / security
- [ ] Two sessions cannot over-issue the same final stock quantity.
- [ ] Server rejects a Trade issuing to a job they are not booked on.
- [ ] QR alone does not bypass login or permissions.
- [ ] `inventory_low` and `inventory_stock` remain security-invoker views where present.

## v51 regression sanity
- [ ] Tags still save and reload.
- [ ] Tag search/filter still works.
- [ ] Gary/other Trade logins see their own Trade View schedule.
- [ ] People remains under Settings.
- [ ] Calendar opens and recent mobile sticky/header changes remain usable.
- [ ] FastField/Tradify imports still load normally.
