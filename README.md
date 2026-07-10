# Job Scheduler - Calendar with Buckets

This is a GitHub Pages-ready prototype for a web-based job scheduler.

## Layout

- Left panel stores jobs in buckets/categories.
- Jobs can be filtered by category.
- Right side is a weekly calendar.
- Workers are horizontal rows.
- Days are columns.
- Jobs can be dragged from the left panel onto a worker/date.
- Jobs can be assigned to multiple workers.
- Jobs can span multiple days using start and end dates.
- The right edge handle on a scheduled job can extend that job to the selected day.

## Job fields

Each job contains:

- Job title
- Work order number
- Address
- Client contact
- Category
- Assigned workers
- Start date
- End date
- Notes

## Important prototype note

This version stores data in the browser using localStorage. It does not yet sync between devices or users.

For real multi-user use, the next stage would be Supabase or Firebase.
