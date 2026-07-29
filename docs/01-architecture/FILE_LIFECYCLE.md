# File Lifecycle

## Lifecycle

```text
Local file selected
-> bytes read into browser memory
-> PDF signature and size validated locally
-> PDF parsed locally by PDF.js
-> current page rendered locally
-> edits stored as local session state later
-> completed PDF generated locally later
-> browser download triggered later
-> session closed
-> active render cancelled and document references released
```

## Current viewer behavior

- One PDF is accepted at a time.
- Empty files, oversized files, unreadable files, and files without a practical `%PDF-` signature are rejected before PDF.js parsing.
- A failed replacement preserves the currently open document.
- A successful replacement opens the new document before disposing the old document.
- Closing a document cancels active render work, clears the canvas where practical, disposes the PDF handle, clears application references, and returns to the landing page.

## Rules

- The application must not call a document-upload endpoint.
- Original bytes should not be copied unnecessarily.
- Temporary object URLs must be revoked when object URLs are introduced.
- Closing a document must release references held by viewer, editor, workers, and previews.
- Browser garbage collection timing is not controlled by the application; documentation must not promise immediate physical memory erasure.
- The application must not store PDF bytes in LocalStorage.
- IndexedDB persistence is disabled by default and requires a separate approved decision.
