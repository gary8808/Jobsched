# AIM Jobsched v52b

## Mobile Machinery layout refinement

- Reworked the Machinery page controls on mobile into a compact two-column action grid.
- Reordered week controls so Previous / Next sit together, followed by This week / Refresh, then Manage machinery / Booking, with Back full-width below.
- Hid the descriptive Machinery subtitle on small screens to recover vertical space.
- Split machinery identity in the calendar into separate lines:
  - machine name/type
  - asset number
  - registration or base location
- Reduced the sticky machine column on mobile to 118px so more of each AM/PM booking column is visible.
- Reduced mobile machinery row height and calendar-cell padding while preserving booking controls.
- Kept the first machine column sticky during horizontal scrolling.
- Bumped application version to 1.52.2 and service-worker cache to aim-cg-v52b.

No Supabase migration is required for v52b.
