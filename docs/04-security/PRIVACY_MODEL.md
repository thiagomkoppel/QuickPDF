# Privacy Model

## Privacy promise

The document is processed locally in the browser and is not uploaded to the application operator.

## Data classification

PDF bytes, rendered pages, extracted text, signatures, initials, images, and form values are private document data.

## Current viewer controls

- Local files are read through browser File APIs only.
- PDF bytes are not stored in React state, URLs, LocalStorage, IndexedDB, forms, analytics, telemetry, fetch, or XMLHttpRequest.
- PDF.js runs as a static client dependency and receives bytes in browser memory.
- The close-document flow cancels active rendering, clears the visible canvas where practical, disposes the PDF handle, clears application references, and returns to the landing page.
- The application does not claim immediate physical memory erasure because JavaScript garbage collection timing is controlled by the browser.

## Rules

- Private document data remains local.
- No private document data enters analytics.
- No private document data enters error reporting.
- No private document data is written to URLs.
- No private document data is stored in LocalStorage.
- No document history is maintained.
- Third-party scripts are prohibited on the editor route unless proven incapable of observing document data and explicitly approved.

## Accurate wording

Use:

> Your PDF is processed in your browser and is not uploaded to us.

Do not use absolute claims such as "impossible to access," "military-grade privacy," or "permanently erased from memory."
