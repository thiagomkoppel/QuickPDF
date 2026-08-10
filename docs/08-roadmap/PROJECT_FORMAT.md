# NestlyPDF Project Format

## Status

Planned after PWA and Version 1.0 delivery.

## Goal

Allow users to save an editable NestlyPDF project and resume later without uploading documents.

Suggested extension:

```text
.qpp
```

## Project contents

- format version
- original PDF bytes
- document metadata
- page ordering
- overlays
- bounds
- text content and styles
- signatures and initials
- images
- colors
- layer order
- hidden and locked states
- current page
- optional view state
- integrity checks

## Privacy

- Save only when explicitly requested.
- Store as a user-downloaded local file.
- Do not automatically upload or persist projects.
- Do not include local file paths.

## Deferred

- Automatic recovery
- IndexedDB drafts
- Autosave
- Encryption
- Cloud synchronization
