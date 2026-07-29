# User Warnings

## Purpose

QuickPDF does not automatically save documents or editing progress. Users must clearly understand when an action can permanently discard work.

Warnings must be concise, consistent, accessible, and shown only when necessary.

## Required warning situations

When the active document is dirty, confirmation is required before:

- opening another local PDF;
- closing the current document;
- returning to the landing page;
- replacing the active document;
- navigating away through application controls;
- refreshing the page;
- closing the tab or browser window;
- any future operation that disposes the session.

## Situations that do not require a warning

Do not show a discard warning when:

- no document is open;
- the document has not been edited;
- the current revision is clean;
- the user only navigated pages;
- the user only changed zoom;
- the user only selected or deselected an element;
- the session is already disposed.

Avoid warning fatigue.

## Standard in-application confirmation

### Title

**Discard your changes?**

### Message

**Your edits are stored only in this browser session. If you continue, they will be permanently lost.**

### Actions

- **Discard changes** — destructive action.
- **Cancel** — safe default.

The wording may be adapted to the action, but it must clearly communicate permanent loss.

## Button behavior

- The safe action should receive initial focus unless platform conventions strongly indicate otherwise.
- The destructive action must be clearly labeled.
- Do not use vague labels such as **OK**, **Yes**, or **Continue**.
- Pressing `Escape` should cancel.
- Closing the dialog should cancel.
- Focus must return to the control that opened the dialog.

## Accessibility

Confirmation dialogs must:

- use appropriate dialog semantics;
- have an accessible name and description;
- trap keyboard focus while open;
- support keyboard-only operation;
- restore focus when closed;
- not rely on color alone to indicate danger;
- provide sufficiently large touch targets.

## Browser-controlled warnings

For refresh, tab close, browser-window close, or external navigation, use `beforeunload` when the session is dirty.

Modern browsers control the displayed text and commonly ignore custom messages. Product copy and documentation must not promise that the standard QuickPDF dialog wording will appear for these browser-level events.

## Opening another PDF

The current document must not disappear immediately when the user selects another file.

Required flow:

1. Validate and attempt to open the candidate file.
2. If the candidate is invalid, show the file error and preserve the current document.
3. If the current document is dirty, show the discard confirmation.
4. If cancelled, preserve the current document.
5. If confirmed, replace it and dispose the old session.

## Download behavior

Downloading does not close the editor.

After a successful download:

- the document remains open;
- the user may continue editing;
- no discard dialog appears solely because a download occurred;
- the application may mark the downloaded revision clean according to the documented state model.

## Error messages

Errors must not expose:

- raw PDF.js errors;
- stack traces;
- document content;
- extracted text;
- internal file paths;
- confidential metadata.

User-facing messages should explain what happened and what the user can do next.

Examples:

- **This file does not appear to be a valid PDF.**
- **This PDF could not be opened. It may be damaged or unsupported.**
- **Password-protected PDFs are not supported yet.**
- **The file is larger than QuickPDF currently supports.**

## Architecture rule

The presentation layer displays warnings based on application-level decisions.

It must not independently determine dirty state by inspecting UI elements or local component state.

The application layer must expose explicit information or outcomes indicating whether confirmation is required.

## Testing requirements

Component and end-to-end tests must verify:

- warning appears for dirty close;
- warning does not appear for clean close;
- cancel preserves edits;
- discard closes or replaces the session;
- opening an invalid file preserves the current document;
- browser unload protection is registered only when dirty;
- dialog focus behavior is accessible;
- download does not dispose the session.
