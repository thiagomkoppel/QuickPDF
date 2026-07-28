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
