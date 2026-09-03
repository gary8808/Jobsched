# AIM Jobsched v53a

Warehouse operational-job permissions patch.

## Changes
- Warehouse users can click jobs on the Admin calendar to open them.
- Warehouse job view exposes operational details and job description/scope without allowing scheduling or commercial edits.
- Warehouse can open the Materials tab, issue/return inventory using the existing inventory workflow, change Materials Status, and manage Special Order Materials.
- Warehouse can view job Notes, Attachments and History.
- Warehouse cannot add/remove job attachments or alter saved job notes from this modal.
- Warehouse cannot edit dates, assignments, job category/status, client/SMS fields, machinery bookings, tags, job numbers or financial values.
- Warehouse calendar remains non-draggable/read-only for booking changes.
- Calendar SMS/message envelope is hidden in Warehouse read-only mode.
- Supabase RPC `aimcg_warehouse_update_job_materials` updates only the allowed material fields server-side.
- v53a migration also defensively permits `warehouse` in the workers app-role check constraint.

## Version
Frontend/package: 1.53.1
Service-worker cache: aim-cg-v53a
- Warehouse receives read-only Storage access to existing `job-files` and `job-photos` so attachment Open works from the limited job view.
