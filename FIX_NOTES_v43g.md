# v43g hotfix — blank page / undefined realtime channel

Corrected crossed cleanup handlers in `src/main.jsx`:

- The messages effect now removes its own `channel` subscription.
- The jobs/bookings effect now removes its own `coreChannel` and `enrichmentChannel` subscriptions.

The previous mismatch caused `ReferenceError: coreChannel is not defined` when React cleaned up/re-ran the messages effect, which could trigger the app error screen or a blank page.
