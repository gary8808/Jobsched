# Jobsched v40 — PWA and workflow refinements

## Included
- Installable AIM Jobsched PWA with Android/desktop install prompt and iPhone/iPad Add to Home Screen guidance.
- AIM-branded manifest, icons and splash/theme colours.
- Basic service-worker app-shell caching with live Supabase requests excluded from caching.
- Admin users now land in Admin view by default after login/profile resolution.
- Employee-only users continue to land in Employee view.
- Blank or `Not checked` materials status is treated as Materials N/A for readiness and Awaiting materials calculations.
- Only Required, Ordered and Partially arrived are treated as awaiting materials.

## GitHub upload
Upload the full repository contents, particularly:
- `src/main.jsx`
- `index.html`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/*`
- `package.json`

No new Supabase SQL is required for v40.
