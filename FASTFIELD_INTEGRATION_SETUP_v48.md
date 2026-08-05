# FastField Close-Out Integration Setup — v48

## What this build does

- Receives FastField close-out data through a Supabase Edge Function.
- Accepts JSON, multipart form data with a PDF, or a raw PDF with identifying headers.
- Normalises `5068` and AIM job number `J5068` to the same matching key.
- Confirms the work order number where one is supplied.
- Automatically attaches a received PDF only where there is one clear job match.
- Keeps all unrelated reports in **FastField close-outs → Unmatched** rather than rejecting them.
- Allows an administrator to manually match an unmatched report to a job later.
- Flags close-outs containing further-work comments or another-trade requirements.
- Prevents duplicates using FastField's external submission ID.

## Deployment

1. Run `SUPABASE_MIGRATION_v48_FASTFIELD_TIMEKEEPING.sql` in Supabase SQL Editor.
2. Deploy the Edge Function:

   ```bash
   supabase functions deploy fastfield-closeout
   ```

3. Set a webhook secret:

   ```bash
   supabase secrets set FASTFIELD_WEBHOOK_SECRET="replace-with-a-long-random-value"
   ```

4. The webhook endpoint will be:

   ```text
   https://YOUR_PROJECT_REF.supabase.co/functions/v1/fastfield-closeout
   ```

5. Configure FastField's HTTP workflow to send the header:

   ```text
   x-aimcg-webhook-secret: YOUR_SECRET
   ```

## Current form fields recognised

The function recognises the visible labels used by the supplied **Job Sign Off – Completed Works** report, including:

- Job Number Only
- Work Order Number – Sodexo Only
- Reference as per job sheet
- Name
- Submitted By
- Date Submitted
- Is the overall job complete?
- Are your part of the works complete?
- What's left to finish?
- Additional works by another trade
- Required trade
- Supervisor inspection

No FastField form changes are required for the first implementation.

## Unrelated historical and transition-period forms

These are expected. They are stored with `match_status = unmatched`, retain the PDF and extracted details, and appear in the admin **FastField close-outs** screen. They can remain unmatched indefinitely or be linked manually later.

## PDF delivery

The function supports:

- PDF included in a multipart webhook field;
- `pdf_url` in JSON;
- `pdf_base64` in JSON;
- raw `application/pdf` request with `x-job-number`, `x-work-order-number`, and `x-submission-id` headers.

The exact FastField HTTP configuration should be confirmed using one real webhook test. Until then, do not assume FastField sends the generated PDF in a particular field.
