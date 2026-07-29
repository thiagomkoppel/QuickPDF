# Session Lifecycle

## Purpose

QuickPDF is a local-first, session-based PDF editor. Documents and editing state exist only in browser memory during the active session.

The application does not upload documents, save projects, or automatically preserve editing progress.

## Core principles

- Documents remain on the user's device.
- Editing state exists only for the active browser session.
- No account, database, cloud storage, or hidden autosave is used.
- Downloading does not close the editor.
- Disposing a session removes the application's references to the document and its temporary editing state.

## Session lifecycle

```text
Landing page
    ↓
Open local PDF
    ↓
Active document session
    ↓
Edit document
    ↓
Download edited PDF
    ↓
Continue editing or close document
    ↓
Dispose session
    ↓
Return to landing page
```

## Session states

A document session may be:

- **Active** — the document is open and usable.
- **Dirty** — the exported result would differ from the last clean state.
- **Clean** — no unsaved output-changing edits exist.
- **Disposed** — document resources and application references have been released.

Downloading may mark the current revision clean according to the application model, but it must not dispose the session.

## Dirty-state rules

The session becomes dirty after an operation that changes the downloaded result, including:

- adding, editing, moving, resizing, duplicating, or deleting text;
- adding, moving, resizing, duplicating, or deleting signatures or initials;
- adding or deleting checkmarks, dates, images, highlights, or whiteout;
- filling or changing form values;
- rotating, reordering, duplicating, inserting, or deleting pages;
- any future operation that changes exported output.

The following must not mark the session dirty:

- navigating between pages;
- zooming;
- fitting the page to the viewport;
- selecting or deselecting an element;
- opening or closing non-destructive UI panels;
- reading metadata.

## Actions that may discard work

When the active session is dirty, confirmation is required before:

- opening another local PDF;
- closing the current document;
- returning to the landing page;
- refreshing the page;
- closing the browser tab or window;
- navigating away from the application;
- replacing or disposing the active session.

No confirmation should appear when the active session is clean.

## Opening another document

Replacement must be atomic:

1. Read and validate the candidate file without destroying the current session.
2. Attempt to open the candidate successfully where practical.
3. If the current session is dirty, ask the user to confirm discarding it.
4. If the user cancels, preserve the current document exactly as it was.
5. If the user confirms, dispose the previous session and activate the replacement.
6. If validation or opening fails, preserve the current session.

## Closing a document

When closing a dirty document:

1. Ask the user to confirm.
2. If cancelled, keep the session unchanged.
3. If confirmed:
   - cancel active rendering;
   - dispose PDF-engine resources;
   - clear document-byte references;
   - clear editing elements and temporary personal data;
   - clear selections and history;
   - remove application references;
   - return to the landing page.

Closing a clean document should not show an unnecessary warning.

## Browser navigation and refresh

Use the browser `beforeunload` mechanism when a dirty document exists.

Modern browsers generally show a browser-controlled generic warning and may ignore custom message text. The application must not promise custom wording for refresh, tab-close, or external-navigation warnings.

The listener must be removed when:

- no document is active;
- the active session becomes clean;
- the session is disposed.

## Download behavior

Downloading an edited PDF:

- does not close the document;
- does not clear the session;
- does not prevent further editing;
- must not silently persist the source document or editing state;
- may update the clean/dirty baseline only after a successful export and download operation.

A failed export must leave the session usable and dirty state unchanged.

## Disposal requirements

Session disposal must release or clear, where applicable:

- PDF document handles;
- active render tasks;
- canvases and rendering references;
- raw PDF byte references;
- generated object URLs;
- temporary images;
- signatures and initials;
- editing elements;
- undo/redo history;
- selections;
- temporary form data;
- application-level session references.

Disposal must be idempotent.

Do not claim cryptographic erasure from memory. Describe the behavior accurately as releasing application references and disposing the session.

## Persistence policy

Document content and editing progress must not be stored in:

- databases;
- cloud storage;
- `localStorage`;
- `sessionStorage`;
- IndexedDB;
- cookies;
- service-worker caches;
- analytics;
- telemetry;
- crash reports;
- URLs or browser history.

## Architecture responsibility

The domain and application layers are authoritative for active-session and dirty-state decisions.

Presentation components may display confirmation UI, but they must not independently infer whether work will be lost.

Browser lifecycle behavior must be isolated behind an adapter.

## Testing requirements

Automated tests must cover:

- clean document closes without warning;
- dirty document requests confirmation;
- cancellation preserves the session;
- confirmation disposes the session;
- invalid replacement preserves the current document;
- successful replacement disposes the previous session;
- `beforeunload` is active only while dirty;
- download does not close the session;
- failed export does not clear dirty state;
- disposal clears application references.
