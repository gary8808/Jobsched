# v46a Trade Materials Scope Fix

## Fixed
- Moved `TradeJobMaterials` from inside the `App` component to shared module scope.
- This allows the top-level `TradeView` component to render it without a `ReferenceError`.

## Validation
- JSX parser: passed with zero parse diagnostics.
- TypeScript source audit: no `Cannot find name`, near-match, or use-before-declaration diagnostics.
- No Supabase migration required.
