# GitHub upload instructions — v40

Upload/replace the contents of the v40 folder in the root of the `Jobsched` repository.

Essential changed files:

- `src/main.jsx`
- `index.html`
- `package.json`
- `public/manifest.webmanifest`
- `public/sw.js`
- `public/icons/apple-touch-icon.png`
- `public/icons/icon-192.png`
- `public/icons/icon-512.png`
- `public/icons/icon-maskable-192.png`
- `public/icons/icon-maskable-512.png`
- `BUILD_NOTES_v40.md` (optional documentation)

Keep the existing `.github/workflows/deploy.yml` in GitHub if it is already working. Do not upload `node_modules` or `package-lock.json`.

After GitHub Pages deploys, hard-refresh the site once. On an already installed PWA, close and reopen it so the new service worker can activate.
