# QuickPDF User Warnings

## Purpose

This document defines user-facing warnings related to unsaved work, document replacement, closing, navigation, and visual whiteout limitations.

Security and lifecycle rules remain authoritative in the security documentation. This file defines presentation and UX behavior.

## Principles

Warnings must be:

- shown only when meaningful;
- concise;
- explicit about what will be lost;
- accessible;
- consistent across actions;
- free of manipulative language.

## Dirty-session discard warning

Show a warning when a dirty document would be discarded by:

- closing the current PDF;
- opening another PDF;
- returning to the landing page;
- navigating away;
- refreshing;
- closing the tab or browser window.

Clean documents do not require a warning.

## In-application dialog

Suggested title:

> Discard unsaved changes?

Suggested message:

> Your edits exist only in this browser session. If you continue, the current changes will be lost.

Actions:

- `Keep editing` — safe/default action;
- `Discard changes` — destructive action.

Requirements:

- accessible dialog;
- focus trap;
- safe action receives initial focus unless a documented platform convention justifies otherwise;
- Escape cancels and preserves the session;
- focus returns to the invoking control;
- cancelling leaves document state exactly unchanged.

## Opening another PDF

When dirty:

1. validate the replacement candidate as far as practical without disposing the current document;
2. ask for discard confirmation;
3. dispose the old session only after confirmation and successful replacement preparation.

Invalid replacement files must preserve the current document.

## Browser-level warning

Use `beforeunload` only while a dirty document exists.

The browser controls the final message.

Remove the listener when:

- no document is open;
- document is clean;
- session is disposed.

Do not claim custom browser-close wording can always be displayed.

## Whiteout warning

Whiteout is visual cover only.

Required UI copy near the tool or help area:

> Whiteout only covers content visually. It does not securely remove the underlying PDF data.

Do not call Whiteout secure redaction.

## Export/download state

After successful export/download initiation:

- status becomes `Downloaded` or equivalent;
- current revision becomes clean according to the application model;
- editor stays open;
- future edits become unsaved again.

On failure:

- keep edits;
- keep dirty state;
- show a recoverable error;
- allow retry.

## File validation warnings

Messages should cover:

- not a supported PDF;
- malformed/unreadable PDF;
- password-protected PDF not yet supported;
- multiple files dropped;
- unsupported image type;
- corrupted image;
- resource limitations.

Avoid raw exception messages.

## Accessibility

- dialogs and inline errors have accessible names;
- errors use live regions appropriately;
- focus moves to blocking errors or remains on the relevant control;
- warnings do not rely only on color;
- motion feedback respects reduced-motion settings.
