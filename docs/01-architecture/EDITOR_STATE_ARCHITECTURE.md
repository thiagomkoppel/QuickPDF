# Editor State Architecture

## Goals

- deterministic behavior;
- reliable undo and redo;
- serializable state;
- separation from rendering libraries;
- efficient updates;
- testability without a browser canvas.

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
- history
- dirtyState
```

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

## History

- A successful command produces a new state or reversible state transition.
- Failed commands do not enter history.
- Consecutive pointer-move events should be coalesced into one meaningful history item.
- Selection-only changes do not need to enter document history.
- Undo and redo must preserve domain invariants.

## Export state

Export uses deterministic editor snapshots. The application builds an export plan from the original PDF bytes plus current text and whiteout overlay elements. Whiteout elements are exported before text elements so replacement text remains visible above visual covers. Stable insertion order is preserved among elements of the same type.

A successful export marks the active session clean and leaves the editor open. A failed export preserves the session and dirty state.
