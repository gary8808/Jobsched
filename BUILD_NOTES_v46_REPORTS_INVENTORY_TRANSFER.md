# AIM CG v46 — Reports, Inventory Management and Transfers

Changes from v45a:

- Reports now open as a dedicated full-width application screen rather than a modal.
- Trade View Materials list is split into Inventory Materials and Special Order Materials.
- Inventory Materials are read live from job-linked inventory movements.
- Added Manage Inventory window with tabs for:
  - manual item creation
  - Excel bulk import
  - warehouse/material-location management
- Warehouse locations can be added and edited, including code, parent location and active status.
- Stock Movement now supports transfers between material locations.
- Transfers create linked transfer_out and transfer_in records using transfer_group_id.

Database:
- No new migration is required when the v44 inventory migration has already been run.
- The v44 schema already includes parent_id, transfer_in, transfer_out and transfer_group_id.

Validation:
- TypeScript JSX parser: passed with zero parse diagnostics.
- ZIP integrity: verify after packaging.
- Full Vite build could not run because the environment package registry returned 404 for @supabase/supabase-js.
