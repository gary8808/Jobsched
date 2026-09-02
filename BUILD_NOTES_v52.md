# AIM Jobsched v52 — Inventory QR & Trade Materials

v52 is the first full feature release after the v51 hotfix series. It focuses on printable inventory QR labels and end-to-end material issuing from Trade View or an iPad/phone camera scan.

## Included

### Printable inventory QR labels
- Inventory now has **Print QR labels**.
- Admin/Stores users can select one or many active materials and batch-print labels.
- Individual inventory item windows also have **Print label**.
- Label layout is designed for 62 × 45 mm media and includes material name, item number, default storage location and QR code.
- QR payload uses the immutable inventory UUID in a Jobsched deep link rather than the editable item description/name.

### Trade View material issue
- Existing Trade View > Add materials workflow remains available.
- Trades can search materials manually, see available quantity and issue stock only to jobs assigned to them.
- Trades do not receive inventory edit/delete/archive/transfer/adjustment controls.
- Manual issues are recorded as Trade View manual-search issues.

### QR scan workflow
- Existing in-app QR scan remains available from Trade View > Add materials.
- Printed v52 labels resolve directly to the correct inventory item.
- If the label is scanned with the iPad/phone Camera app, Jobsched opens with `?stock=<inventory UUID>` and presents a Scanned Material issue window after login.
- The scanned screen shows the item, location, quantity available, job selector and issue quantity.
- Non-Stores Trade users only see active jobs assigned to their own worker account.
- QR issues are recorded separately as QR scan material issues.

### Stock protection / security
- v52 adds a source-aware Trade inventory RPC while retaining the v51e four-argument function for safe deployment compatibility.
- Database advisory locking and available-stock validation remain in the issue transaction, preventing concurrent over-issue below zero.
- Inventory reporting views are reasserted as `security_invoker` where present.
- QR codes identify an item only; they do not grant permission. The user must authenticate and the server validates job access.

### Cache/version
- Package version: 1.52.0.
- Service-worker cache: `aim-cg-v52`.
- New dependency: `qrcode` 1.5.4 for local browser QR SVG generation. Printed labels do not rely on a third-party QR web service.

## Deliberately deferred cleanup
The agreed lower-priority cleanup remains out of v52: legacy Awaiting Parts cleanup, removal of old multi-day resize code, simplification of Share Schedule recipient modes, and remaining nonessential mobile calendar cleanup.
