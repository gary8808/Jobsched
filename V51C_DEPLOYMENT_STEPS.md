# AIM Jobsched v51c deployment

1. Confirm the v51a stability/security migration has already been run. If v51b is currently working, this is normally already done.
2. In Supabase SQL Editor, run `SUPABASE_MIGRATION_v51c_TAGS_REFERENCE_INVENTORY.sql` once.
3. Upload/replace the repository files with the contents of the v51c ZIP.
4. Commit the changes to the branch used by the GitHub Pages workflow.
5. Open GitHub > Actions and confirm the Pages deployment finishes successfully.
6. Open Jobsched and hard-refresh the browser (Ctrl+F5 on Windows).

## First checks after deployment
- Open Settings > Sites, trades & tags and confirm the seeded Sites and Trades appear.
- Open a job, add a tag such as `Access Anytime`, save, then search for that tag.
- Scroll the main calendar vertically and horizontally; confirm dates/Quick Actions remain usable and both edge arrows follow the viewport.
- At the horizontal edge, click the arrow again and confirm it moves to the previous/next week.
- Open a job modal and confirm the side arrows disappear behind the modal.
- Open Machinery and confirm the date columns can scroll horizontally.
- Open a FastField close-out that previously showed the false further-work warning and click Reprocess. For the example where Additional Works = No, the warning must clear.
- Open an unused inventory material and test Delete Material. For a material with movement history, confirm the action changes to Archive Material and the item disappears from the active register without losing movement history.

## FastField note
v51c marks newly parsed rows as `pdf_page_text_v51c`. Refresh and parse will also pick up a small batch of active rows parsed with the older logic. You can use the individual Reprocess button for any specific row immediately.
