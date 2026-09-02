# AIM Jobsched v52a Build Notes

## Scope
v52a refines the v52 inventory QR workflow without changing the database schema.

## Trade View – job materials
- Replaced the image/photo QR decoding workflow with a live camera scanner.
- `Add materials` from a Trade job now offers:
  - live QR scan; or
  - manual inventory search by item number, product name or location.
- A successful QR scan selects the material directly within the current job, so the Trade does not need to select the job again.
- Available stock and over-issue protection remain unchanged.
- Removed QR photo upload/capture fallback. Manual search is the fallback if camera access is unavailable or denied.

## QR opened from device Camera
- Retained the v52 deep-link QR workflow.
- Replaced the plain job dropdown with a searchable job picker.
- Job search includes job number, work order, title, client, site, address/contact and other existing searchable job fields.
- Trade users only see active jobs assigned to their login. Stores/Admin users retain their broader permitted job list.

## Live scanner implementation
- Uses `getUserMedia` with the rear/environment camera preference.
- Uses the browser `BarcodeDetector` where available.
- Falls back to the bundled `jsQR` decoder against live video frames.
- Camera stream and animation loop are stopped when the scan closes or the component unmounts.
- QR remains identification only; the existing authenticated database issue function still performs the stock transaction and permission checks.

## Version/cache
- package version: 1.52.1
- service worker cache: aim-cg-v52a

## Database
No new Supabase migration is required for v52a. The v52 QR inventory migration must already be installed.
