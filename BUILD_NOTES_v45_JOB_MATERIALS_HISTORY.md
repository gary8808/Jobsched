# v45 — Job Materials and Inventory History

Built from the deployed v44 Phase 1 Inventory package.

## Changes

- Job Materials tab split into:
  - Inventory materials: live job-linked inventory issues and returns, including net quantity and cost.
  - Special Order Materials: retains the existing manual materials list and materials status menu.
- Inventory materials can be issued to or returned from a saved job directly inside the job Materials tab.
- Stock Movement modal now supports job search across job number, work order, quote, PO, title, client, address and site.
- Inventory item window now includes Edit and Item history tabs.
- Item history displays movement type, signed quantity, date/time, location, linked job, reference, notes and the user who recorded it.
- No Supabase migration is required; this uses the existing inventory_movements fields from v44.

## Validation

- JSX parsed successfully with the TypeScript JSX parser (0 syntax diagnostics).
- Full Vite compilation could not be completed in the local environment because the internal npm registry returned 404 for @supabase/supabase-js.
