# AIM CG v50 — Tradify Job-Pack Processing

## Included

- Automatically checks `job_pack_imports` for new pending uploads when an admin opens the app.
- Listens for newly uploaded job packs and attempts processing without requiring the Imports screen to be opened.
- Downloads the original PDF from the private `job-pack-imports` bucket.
- Extracts text with the app's PDF.js reader using the fixed Tradify job-pack layout.
- Reads job/reference, job number, work order, quote, PO, client, site/address and scope/notes.
- Calls `aimcg_create_job_from_pack` to create the job in **To be scheduled**.
- Links the source PDF as a `Tradify Job Pack` attachment and records job history.
- Leaves unreadable files in `parse_failed / review_required` with the error visible in the Job-Pack Imports screen.
- Failed imports are not automatically retried every 30 seconds; admins can use **Parse and import** after correcting the source or parser.
- Duplicate job numbers/work orders remain in review rather than creating duplicate jobs.

## Database

No new v50 migration is required. The v49 document-import migration must already have been run.

## Deployment

Replace the repository contents with this build and deploy the web app. The existing `job-pack-import` Edge Function and Power Automate flow remain unchanged.
