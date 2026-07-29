# Session Lifecycle

## Current lifecycle

```text
Open local PDF
-> parse and render locally
-> create temporary overlay edits in memory
-> warn before dirty discard
-> confirm discard
-> cancel active render work
-> dispose PDF handle and domain session
-> clear visible canvas where practical
-> return to landing page
```

## Rules

- Clean documents close without a custom warning.
- Dirty documents require confirmation before close, replacement, or app navigation that would dispose the session.
- Browser refresh, tab close, and external navigation use `beforeunload` where supported.
- Cancelling a warning preserves the active session and temporary elements.
- Confirming discard clears the active session and temporary elements.
- Invalid replacement files must preserve the current session.
- No localStorage, sessionStorage, IndexedDB, cookies, service-worker caches, or backend persistence are allowed.

JavaScript garbage collection timing is controlled by the browser, so QuickPDF describes cleanup as releasing references and disposing the session rather than immediate physical memory erasure.
