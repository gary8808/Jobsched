# AIM CG v42e – visit repair

- Existing defects jobs are repaired by the SQL migration.
- Current defects status starts at Not Started.
- Confirm complete requires both a current-visit completion status and a current-visit completion submission.
- Previous status, labour and completion information is archived in `job_visit_history` and retained in the job payload.
- Defects labour is tracked as the current visit and is added to archived visit labour in reports.
