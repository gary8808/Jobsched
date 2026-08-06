# Power Automate setup — Tradify job packs

Recommended source: a shared SharePoint document library (or shared OneDrive folder) with Incoming, Processed and Failed folders.

## Flow
1. Trigger: **When a file is created (properties only)** in the Incoming folder.
2. Action: **Get file content**.
3. Action: **HTTP**
   - Method: `POST`
   - URI: `https://YOUR_PROJECT_REF.supabase.co/functions/v1/job-pack-import`
   - Header: `x-aimcg-import-secret` = the value stored as `JOB_PACK_IMPORT_SECRET`
   - Header: `x-file-name` = the source file name with extension
   - Header: `Content-Type` = `application/pdf`
   - Body: File Content from the previous step
4. If HTTP status is 200, move the file to Processed.
5. Otherwise move it to Failed and retain the response body.

The AIM app processes pending packs when an admin opens or refreshes **Tradify job-pack imports**. Valid packs are created in **To be scheduled** with the original PDF attached.
