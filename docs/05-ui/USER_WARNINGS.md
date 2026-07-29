# User Warnings

## Dirty document warning

Show an accessible confirmation dialog before an in-app action discards unsaved temporary edits.

Use direct wording:

- "Discard unsaved edits?"
- "Closing this document will discard all temporary text and whiteout edits."

## Whiteout warning

Whiteout is a visual cover only. The UI must say:

> Whiteout only covers content visually. It does not securely remove underlying PDF data.

Do not call whiteout redaction or imply secure deletion of underlying PDF data.

## Browser warning

When a document is dirty, register a browser `beforeunload` warning where supported. Remove it when the document is clean or disposed.
