# AIM CG v49 — FastField PDF Parsing and Tradify Job-Pack Imports

## FastField
- The webhook acknowledges FastField quickly and stores the PDF in the background.
- Close-outs are created as `storing_pdf`, then `parsing_pending` when the PDF is available.
- The admin Close-outs screen reads the fixed labels on the PDF and extracts job number, work order, reference, submitter, completion answers and further-work information.
- Matching uses the normalised job number and work order. Filenames are never used as job identifiers.
- Unrelated reports remain in the unmatched queue.

## Tradify / OneDrive / Power Automate
- Added `job-pack-import` Edge Function.
- Added the private `job-pack-imports` bucket and `job_pack_imports` register.
- Added a left-menu Job Pack Imports screen.
- Pending PDFs are parsed using the existing fixed AIM job-sheet parser.
- Valid packs create a normal job in `To be scheduled` and attach the original PDF.
- Duplicate job number/work-order matches are held for review rather than creating a second job.

## Installation
1. Run `SUPABASE_MIGRATION_v49_DOCUMENT_IMPORTS.sql`.
2. Replace/redeploy `fastfield-closeout` and keep Verify JWT disabled.
3. Deploy `job-pack-import` and keep Verify JWT disabled.
4. Add project secret `JOB_PACK_IMPORT_SECRET`.
5. Deploy the web app.
