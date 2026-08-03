# AIM CG v47 — Calendar, ad hoc and onsite display update

## Included
- Moved job search below Client filter in the bucket panel.
- Moved Previous / This week / Next week below Trade and Base site filters.
- Suppressed client reschedule prompts for ad hoc and travel/accommodation bookings.
- Reduced the admin ad hoc editor to Details, Attachments and History.
- Added Trade View notes and attachment uploads for ad hoc bookings.
- Added `Only show on calendar if employee is onsite` to normal-job Details.
- Applied onsite-only visibility to Admin calendar, Trade View and schedule exports.

## Database
No migration is required. The onsite-only setting is retained in the existing job `app_payload` JSON.
