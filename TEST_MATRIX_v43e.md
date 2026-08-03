# AIM CG v43e deployment test matrix

Run these checks after the SQL migration and GitHub deployment. Use one Admin browser and one Trade login where possible.

## 1. Login and employee identity

- Sign in as an Admin: Admin View should open by default.
- Sign in as a Trade: Trade View should open and show the worker linked by `workers.profile_id`.
- Confirm deleted demo employees do not reappear after refresh.
- Add a temporary employee and optional hourly cost; save, refresh and confirm both remain.

## 2. Normal booking visibility

- Create or edit a normal job.
- Assign it to a Trade for today or a future date inside the 14-day Trade View range.
- Save and confirm it appears on the Trade device immediately or within the 30-second fallback refresh.
- Refresh both devices and confirm it remains.

## 3. Ad hoc booking visibility

- In the Admin calendar, create an ad hoc item for the Trade.
- Confirm it appears on the correct date in Trade View.
- Refresh both devices and confirm it remains.

## 4. Additional and rescheduled occurrences

- Add an additional booking to a job on dates different from the primary booking.
- Confirm the assigned Trade sees the additional dates.
- Move a previously scheduled/past job to a future date.
- Confirm the future booking remains after refresh and appears in Trade View.

## 5. Defect visit and labour history

- Reschedule a completed job as a defect/callback.
- Confirm Trade View starts at Not Started and the card is marked as a defects job.
- Confirm Admin does not show Confirm complete before the current Trade submission.
- Enter completion notes, record time and mark Complete.
- Confirm notes appear in Admin View and Confirm complete then appears.
- Confirm previous and defect labour remain included in total labour reporting.

## 6. Machinery initial load and conflicts

- Open Machinery immediately after login/refresh without adding a machine.
- Confirm existing machines and bookings are visible.
- Create an AM, PM and full-day test booking.
- Confirm overlapping bookings are blocked.
- Confirm out-of-service machinery cannot be booked.

## 7. Tools initial load and audit

- Open Tools immediately after login/refresh without adding a tool.
- Confirm existing tools are visible.
- Sign out, return and mark a test tool out of service.
- Confirm the tool status and history remain after refresh.

## 8. Notes and messages

- Add two Admin job notes; share only one with Trade View.
- Confirm only the selected note appears to the Trade.
- Action an inbound message or send a reply.
- Refresh and confirm the linked action note remains in the job.

## 9. PWA/session refresh

- Fully close and reopen an installed PWA.
- Confirm workers, jobs, machinery and tools load without creating a new record.
- Leave the app in the background, return to it and confirm data refreshes.

## 10. Failure handling

- Temporarily interrupt the device connection, restore it and return to the app.
- Confirm one unavailable optional dataset does not blank the schedule.
- Confirm failed saves show an error rather than silently disappearing after refresh.
