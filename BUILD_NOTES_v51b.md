# AIM Jobsched v51b – deployment hotfix

This package is the corrected replacement for v51a.

## Fix
- Replaced accidental literal `\n` character sequences in `src/styles.css` with real line breaks.
- Retains all v51a stability changes.
- GitHub Pages workflow remains on Node 24 with `cancel-in-progress: false`.
- Package version bumped to 1.51.2.

## Validation performed
- No unresolved merge markers in source.
- CSS brace counts are balanced.
- No literal `\n` sequences remain in the v51a CSS patch.
- GitHub Pages workflow contains a single Pages artifact upload/deploy path.

A full local Vite build could not be executed in the packaging environment because npm dependencies were not available locally, so GitHub Actions remains the definitive build validation.
