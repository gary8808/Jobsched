# AIM Jobsched v52a Focused Regression Check

## Trade job → Materials
- [ ] Log in as a Trade user and confirm Trade View resolves to that employee.
- [ ] Open an assigned calendar job → Materials list → Add materials.
- [ ] Manual material search still works by item number.
- [ ] Manual material search still works by material name.
- [ ] Available quantity is displayed.
- [ ] Start live scanner and approve camera permission.
- [ ] Rear/environment camera opens without requiring a photo to be taken.
- [ ] Point camera at an AIM inventory QR label and confirm it automatically selects the correct item.
- [ ] Scanner closes after a valid QR is recognised.
- [ ] Quantity can be entered and material added to the already-open job without selecting a job again.
- [ ] Inventory history records the issue as QR source.
- [ ] Stock quantity reduces correctly.
- [ ] Attempt to issue more than available stock and confirm it is blocked.
- [ ] Deny camera permission and confirm manual item search remains usable.
- [ ] Scan an invalid/non-inventory QR and confirm a useful message is shown without issuing anything.

## Device Camera deep-link
- [ ] Scan printed AIM QR using normal iPad/phone Camera.
- [ ] Jobsched opens the correct Scanned material.
- [ ] If logged out, log in and confirm the scanned material remains available.
- [ ] Search jobs by job number.
- [ ] Search jobs by work order number.
- [ ] Search jobs by title/client/site.
- [ ] Select a search result and issue the material.
- [ ] Trade user cannot locate/select a job they are not assigned to.

## Permissions / safety
- [ ] Trade still cannot edit inventory item details.
- [ ] Trade still cannot delete/archive inventory items.
- [ ] Trade still cannot transfer or adjust stock.
- [ ] Admin/Stores inventory management remains unchanged.
- [ ] Concurrent/over-issue database safeguard remains functional.

## General sanity
- [ ] v51g Trade identity fix remains correct.
- [ ] Tags still save and filter/search correctly.
- [ ] People remains under Settings.
- [ ] Admin calendar loads and scrolls normally on desktop/mobile.
