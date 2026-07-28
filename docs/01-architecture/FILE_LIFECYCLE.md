# File Lifecycle

## Lifecycle

```text
Local file selected
→ bytes read into browser memory
→ PDF parsed locally
→ pages rendered locally
→ edits stored as local session state
→ completed PDF generated locally
→ browser download triggered
→ session closed
→ object URLs revoked and references released
```

## Rules

- The application must not call a document-upload endpoint.
- Original bytes should not be copied unnecessarily.
- Temporary object URLs must be revoked.
- Closing a document must release references held by viewer, editor, workers, and previews.
- Browser garbage collection timing is not controlled by the application; documentation must not promise immediate physical memory erasure.
- The application must not store PDF bytes in LocalStorage.
- IndexedDB persistence is disabled by default and requires a separate approved decision.
