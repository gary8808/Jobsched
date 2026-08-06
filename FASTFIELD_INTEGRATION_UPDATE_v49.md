# FastField v49 update

Keep the current FastField HTTP action pointed to:

`https://YOUR_PROJECT_REF.supabase.co/functions/v1/fastfield-closeout`

JSON-only FastField delivery currently arrives as multipart data containing the generated PDF. The v49 receiver accepts that behaviour.

Replace the deployed Edge Function code with `supabase/functions/fastfield-closeout/index.ts`. Keep **Verify JWT** disabled and retain `FASTFIELD_WEBHOOK_SECRET`.

The receiver returns success after registering the submission and schedules the PDF storage operation. The app reads the fixed first-page labels when an admin opens or refreshes FastField Close-outs.
