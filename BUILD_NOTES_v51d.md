# AIM Jobsched v51d hotfix

This hotfix is deliberately limited to defects identified during v51c testing.

## Fixes
- Main job search now searches tags explicitly and behaves as a global job search while text is entered, so a tag can find jobs regardless of their current bucket.
- Job tag search safely handles both string tag values and tag-like records.
- Left calendar edge arrow moved to the bucket/calendar boundary on desktop rather than beside the navigation rail.
- Removed Required Trade/s selection from the Create/Edit Job form. Historical values remain in stored job payloads for compatibility but are no longer part of the normal job-edit workflow.
- People drag-and-drop ordering now re-renders in calendar order immediately, uses an explicit drag payload, and provides drag-state feedback.
- Existing Move Up / Move Down ordering controls remain as a fallback.

## No database migration
v51d introduces no database-schema changes. Do not re-run the v51c migration solely for this hotfix.
