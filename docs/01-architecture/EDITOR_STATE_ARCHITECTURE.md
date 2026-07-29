# Editor State Architecture

## Goals

- deterministic behavior;
- reliable undo and redo later;
- serializable state;
- separation from rendering libraries;
- efficient updates;
- testability without a browser canvas.

## Document session

```text
DocumentSession
- documentId
- originalFileName later
- originalPdfBytes reference later
- pageOrder
- pageStates
- elementsByPage
- formValues later
- currentSelection
- history later
- dirtyState
```

## Application boundary

The presentation layer does not mutate `DocumentSession` directly. It calls application use cases through `DocumentSessionService`, which owns the single active session required for the MVP and returns immutable snapshots.

Current application commands and queries include:

- create document session;
- get document session state;
- navigate to page;
- select element;
- clear selection;
- add editor element;
- update editor element;
- delete editor element;
- delete page;
- reorder pages;
- mark session clean;
- dispose document session.

## Commands

Every meaningful mutation should be represented as a command.

Examples:

- AddElement
- UpdateElement
- MoveElement later
- ResizeElement later
- RotateElement later
- DeleteElement
- DuplicateElement later
- SetFormValue later
- RotatePage later
- ReorderPages
- DeletePage
- InsertPages later

## History

- A successful command produces a new state or reversible state transition.
- Failed commands do not enter history.
- Consecutive pointer-move events should be coalesced into one meaningful history item.
- Selection-only changes do not need to enter document history.
- Undo and redo must preserve domain invariants.

History and undo/redo are intentionally deferred beyond the first application boundary.
