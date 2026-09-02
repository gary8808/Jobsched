# v52 Deployment Steps

1. **Run the new Supabase migration first:** `SUPABASE_MIGRATION_v52_QR_INVENTORY.sql`.
   - This adds the five-argument, source-aware inventory issue RPC used by v52.
   - The existing v51e four-argument RPC is intentionally retained during deployment, so v51g continues to work until the new front end is live.
2. Extract `aim-cg-v52.zip` and replace the current GitHub project files with the extracted v52 files.
3. Commit and push to `main`.
4. Allow the existing GitHub Pages workflow to run **Install dependencies → Build → Deploy**.
5. Reopen/refresh Jobsched after the deployment so the `aim-cg-v52` service-worker cache is loaded.

## First checks

1. Admin/Stores → Inventory → **Print QR labels**.
2. Select one material and print/preview a 62 × 45 mm label.
3. Confirm the label shows product name, item number, storage location and QR.
4. Trade View → assigned job → Materials → Add materials → scan the printed QR and confirm the correct item and available quantity appear.
5. Issue 1 unit and confirm stock falls by 1 and the job material history updates.
6. Scan the same QR using the iPad/phone Camera app. Confirm Jobsched opens the **Scanned material** window and the Trade can select only their active assigned jobs.
7. Confirm a Trade cannot edit/delete/archive/transfer/adjust inventory.
8. Attempt to issue more than available and confirm it is rejected.

## Label printer note
The print stylesheet targets 62 × 45 mm pages. With a Brother QL-820NWB and 62 mm continuous media, choose the matching custom/continuous label size in the print dialog and use actual size / 100% scaling.
