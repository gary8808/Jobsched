# AIM Jobsched v51e hotfix

This hotfix focuses on the confirmed issues found after v51d.

## Changes

### Job tags
- Added an explicit `job_tag_links` table so tags are no longer dependent only on the `jobs.app_payload` JSON field.
- Job save now synchronises selected tags through `aimcg_replace_job_tags`.
- Job reload reads the explicit tag links and falls back to legacy payload tags if required.
- Main job search continues to include tag names, so tag search now operates on persisted job/tag relationships.
- Existing payload tags are backfilled into the new link table by the v51e migration.

### Trade View materials
- Removed the **Approximate materials used** field from Job Completion.
- Trade View Materials now provides an **Add materials** workflow.
- Trades can search by item number, material name or location and can see quantity available.
- Trades can issue material only to a job they are assigned to.
- Trades cannot edit, adjust, transfer, archive or delete stock through this workflow.
- Material issues use a restricted Supabase RPC and retain the existing insufficient-stock protection.

### QR material scanning
- Added QR scanning to Trade View → Add materials.
- The control uses the device camera/photo capture and decodes QR codes in-browser using `jsqr`, with the native BarcodeDetector used first where available.
- A QR/item code can also be entered manually.
- Accepted QR values can be the item's QR code, item number, item UUID, or a future label URL carrying `stock`, `item` or `qr` query parameters.

### Mobile Admin calendar
- Moved the left calendar arrow clear of the compact side navigation on tablet/mobile.
- Calendar dates and worker corner header are sticky while vertically scrolling the calendar on tablet/mobile.
- The worker-name column remains sticky horizontally.

### Cache/version
- Service-worker cache bumped to `aim-cg-v51e-hotfix` so old v51d assets are not retained after deployment.
- Package version bumped to 1.51.5.
