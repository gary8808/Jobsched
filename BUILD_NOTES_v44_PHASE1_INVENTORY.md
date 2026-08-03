# AIM CG v44 — Phase 1 Inventory and workflow improvements

## Included
- Standalone Inventory Management screen with forklift icon.
- Admin and optional Stores permission access.
- Inventory search, low-stock filter, item editing and QR-ready identifiers.
- Excel import with item/location creation and opening-balance movements.
- Stock receipt, job issue, job return, adjustment and write-off movements.
- Inventory job-cost and stock reports.
- Standalone Machinery screen showing all machines on one calendar.
- Clickable machinery names with Edit and History tabs; admin delete option.
- Employee calendar ordering controls in People.
- Direct Mark as actioned button in Messages.

## Required database step
Run `SUPABASE_MIGRATION_v44_INVENTORY_STORES_MACHINERY.sql` in Supabase SQL Editor before using this build.

## QR provision
Each stock item stores both barcode and QR-code values. v44 displays the QR identifier and reserves the data model for printed labels/scanning; camera scanning and label-sheet generation are planned for Phase 2.
