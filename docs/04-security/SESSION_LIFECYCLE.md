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
- No localStorage, sessionStorage, IndexedDB, cookies, service-worker caches, or backend persistence stores the active document or edits.

JavaScript garbage collection timing is controlled by the browser, so QuickPDF describes cleanup as releasing references and disposing the session rather than immediate physical memory erasure.

## Render resource disposal

The PDF.js render document is an in-memory viewer resource tied to the active editor session. Closing, replacing, or unmounting a document session disposes the current render document, cancels active page renders, and clears the canvas. This releases application references without promising immediate physical memory erasure.

## Unsaved session protection

A session is protected when a PDF is open and its editor revision is dirty. QuickPDF uses one typed pending-session-exit guard for every intentional action that would discard or replace that protected session:

- QuickPDF logo and Home navigation;
- Open another PDF;
- same-tab internal routes, including Privacy and diagnostics;
- same-tab external links and normal new-tab external links exposed from the editor;
- browser Back and Forward navigation while the editor route is active;
- future editor links captured by the shared route guard.

A clean active session follows the normal application `closeDocument()` path before its pending action runs. A dirty session instead records a typed action (`navigate`, `open-document`, or `close-document`) and opens the QuickPDF `Leave without saving?` dialog. Choosing Stay here, pressing Escape, or leaving the dialog preserves the current document, dirty state, history, and pending replacement operation. Choosing Leave without saving clears the dialog state, uses the standard close path exactly once, and then executes the saved action.

For Open, the replacement file picker is not opened while the dirty confirmation is visible. After confirmation, QuickPDF disposes the old session and opens the browser picker once. The selected file then enters the same browser-local landing opening workflow as an ordinary picker or drag-and-drop selection. Invalid replacement files remain recoverable on the landing page; QuickPDF does not restore the intentionally discarded old session.

## Browser unload limitations

QuickPDF registers a `beforeunload` listener only while an editor session is dirty. The browser, not QuickPDF, owns the resulting native refresh, tab-close, window-close, or address-bar-navigation warning and may ignore custom wording. The listener is removed when the session becomes clean, is closed, or leaves the editor route.

Mobile Safari, installed PWAs, browser process termination, OS task termination, shutdown, memory eviction, and app-switcher dismissal do not reliably emit `beforeunload`. Because QuickPDF intentionally has no autosave or persistent sessions, edits may still be lost in those cases. The custom QuickPDF dialog is available only for in-app actions that the application can intercept.
