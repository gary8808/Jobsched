# AIM Jobsched v51g Hotfix

## Changes

### Trade View identity
- Trade View now resolves the displayed employee from the authenticated Supabase login whenever Trade View is active.
- Matching priority is the worker `profile_id`, with employee email as a fallback.
- This applies to both normal Trade users and Admin users who open Trade View.
- Removed the Admin fallback that could select the first active employee while Trade View was open.
- If the login cannot be linked to an active employee, Trade View shows the existing "Login not linked to an employee" message instead of another employee's schedule.

### People moved to Settings
- Removed the People shortcut from the left navigation.
- Added People to the Admin Settings menu.
- Settings > People opens the existing People management window, including employee details, access controls and calendar ordering.

## Database
No new Supabase migration is required for v51g.

## Version
Package version bumped to 1.51.7 and PWA cache bumped to `aim-cg-v51g`.
