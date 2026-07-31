# Editor State Architecture

## Goals

- deterministic behavior;
- reliable undo and redo;
- serializable and testable state;
- separation from rendering libraries;
- efficient updates;
- testability without a browser canvas;
- revision-aware dirty state.

## Document session

```text
DocumentSession
- documentId
- originalFileName
- originalPdfBytes reference
- pageOrder
- pageStates
- elementsByPage
- formValues
- currentSelection
- dirtyState
```

Original PDF bytes remain outside command history and are referenced by the active session only as required for rendering and export.

## Presentation state

Transient interface state is kept separate from document-output state.

Examples:

- active tool;
- text-editing element id;
- open modal;
- hover state;
- pointer preview geometry;
- current zoom;
- render status.

These values do not enter document history.

## Commands

Every committed output-changing mutation must pass through an application command boundary.

Examples:

- AddElement
- UpdateElement
- MoveElement
- ResizeElement
- RotateElement
- DeleteElement
- DuplicateElement
- SetFormValue
- RotatePage
- ReorderPages
- DeletePage
- InsertPages

The presentation layer invokes application use cases. It does not own command stacks or reversible transitions.

See:

- `../03-engineering/COMMAND_PATTERN.md`
- `../03-engineering/COMMAND_HISTORY.md`
- `../03-engineering/UNDO_REDO.md`

## History

- A successful command produces one reversible state transition.
- Failed and no-op commands do not enter history.
- Consecutive pointer-move events are preview state and commit as one meaningful history item on pointer release.
- Continuous text editing is coalesced into a meaningful update instead of one entry per keystroke.
- Selection-only and presentation-only changes do not enter document history.
- Undo and redo preserve domain invariants.
- History is limited, memory-only, session-scoped, and cleared on close, replacement, disposal, or unload.

## Revisions and dirty state

Dirty state is based on document revision identity, not on whether the undo stack contains entries.

```text
currentRevision === cleanRevision → clean
currentRevision !== cleanRevision → dirty
```

Opening a PDF establishes the initial clean revision. Successful export marks the current revision clean without clearing history. Undo and redo may therefore move the session between clean and dirty revisions.

## Export state

Export uses deterministic editor snapshots. The application builds an export plan from the original PDF bytes plus current overlay elements. Whiteout elements are exported before text elements so replacement text remains visible above visual covers. Stable insertion order is preserved among elements of the same type.

A successful export marks the active revision clean and leaves the editor and history open. A failed export preserves the session, history, and dirty state.
