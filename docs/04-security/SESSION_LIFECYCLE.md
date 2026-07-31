# Session Lifecycle

## Current lifecycle

```text
Open local PDF
-> parse metadata locally
-> create temporary overlay edits in memory
-> export edited PDF locally on demand
-> trigger browser download
-> keep editing session open
-> discard runtime state when the session ends
```

## Rules

- Export starts from the original local PDF bytes.
- Export success marks the current session clean and keeps the editor open.
- Export failure preserves the active session and temporary elements.
- Exported bytes are handed to the browser download adapter and are not retained by application state.
- No localStorage, sessionStorage, IndexedDB, cookies, service-worker caches, or backend persistence are allowed.

JavaScript garbage collection timing is controlled by the browser, so QuickPDF describes cleanup as releasing references and disposing the session rather than immediate physical memory erasure.

## Render resource disposal

The PDF.js render document is an in-memory viewer resource tied to the active editor session. Opening another document or unmounting the app disposes the current render document, cancels active page renders, and clears the canvas. This releases application references without promising immediate physical memory erasure.
