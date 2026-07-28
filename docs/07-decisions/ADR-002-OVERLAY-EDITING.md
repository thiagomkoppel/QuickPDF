# ADR-002: Overlay-Based Editing

## Status

Accepted for MVP.

## Context

True editing of arbitrary existing PDF text is complex and unreliable because PDFs store final page content rather than document-flow semantics.

## Decision

The MVP will preserve original PDF content and represent user additions as editor elements applied during export. Visual correction will use whiteout plus replacement content.

## Consequences

- Common fill, sign, and correction tasks are feasible.
- Original content remains stable.
- Undo and redo are simpler.
- Existing arbitrary text is not truly reflowed or modified.
- Whiteout must not be presented as secure redaction.
