# Editor State Architecture

## Goals

- deterministic behavior;
- reliable undo and redo later;
- serializable state;
- separation from rendering libraries;
- efficient updates;
- testability without a browser canvas.

## Current overlay model

The first editing milestone stores user-added items as `EditorElement` instances owned by `DocumentSession`:

- `text` elements store stable IDs, page ownership, page-space bounds, and text content;
- `whiteout` elements store stable IDs, page ownership, and page-space bounds;
- whiteout is opaque visual covering only, not secure redaction.

Overlay geometry is stored in page coordinates. React converts those bounds to screen coordinates when rendering the transparent DOM overlay above the PDF canvas. Zoom and high-DPI canvas rendering do not change stored element coordinates.

## Dirty state

Domain mutations mark the session dirty: adding, updating, moving, resizing, duplicating, and deleting text or whiteout elements.

Selection, deselection, page navigation, toolbar zoom, fit width, and modified-wheel zoom do not mark the session dirty.

## Commands

Every meaningful mutation should be represented as a command.

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

The current milestone exposes explicit application methods for supported text and whiteout operations. Undo/redo command history remains deferred.

## History

- A successful command produces a new state or reversible state transition.
- Failed commands do not enter history.
- Consecutive pointer-move events should be coalesced into one meaningful history item when undo/redo is introduced.
- Selection-only changes do not need to enter document history.
- Undo and redo must preserve domain invariants.
