# v51e focused regression check

## Tags
- Add an existing tag to a job and save.
- Close and reopen the job: tag remains.
- Refresh browser: tag remains.
- Search exact tag name from main search: job appears.
- Search partial/lowercase tag text: job appears.
- Remove tag, save and refresh: tag no longer linked.
- Multiple tags persist independently.

## Trade materials
- Open assigned job in Trade View.
- Confirm Approximate Materials is absent from Job Completion.
- Open Materials → Add materials.
- Search item by item number.
- Search item by product name.
- Confirm quantity available is displayed.
- Issue valid quantity to job.
- Confirm material appears in job material list after save.
- Confirm available quantity reduces.
- Attempt to issue more than available: blocked.
- Confirm Trade user has no edit/delete/transfer/adjust controls.
- Attempt to issue to a job not assigned to that Trade account: server rejects it.

## QR
- Use Scan QR on iPad/mobile and photograph a valid material QR.
- Correct item/location is selected.
- Add quantity to job successfully.
- Invalid QR produces a clear message.
- Manually enter item number/QR code and use code successfully.

## Mobile calendar
- Open Admin calendar on mobile/tablet.
- Left arrow is visible and not under side navigation.
- Scroll vertically inside calendar: date headers remain visible.
- Scroll horizontally: worker names remain visible and dates move correctly.
- Left/right arrows still move calendar and cross to previous/next week at edges.
