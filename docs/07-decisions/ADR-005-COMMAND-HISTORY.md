# ADR-005: Application Command History

## Status

Accepted for the undo/redo milestone.

## Context

NestlyPDF now supports several reversible overlay operations: creation, text editing, font-size changes, movement, resizing, duplication, and deletion across text, whiteout, signature, and initials elements.

A React-owned pair of undo and redo arrays would couple history to the current interface, make future page and form features harder to integrate, and risk inconsistent behavior between toolbar, keyboard, pointer, and inspector actions.

Two broad approaches were considered:

1. store complete editor snapshots for every input event;
2. route committed application mutations through reversible, mergeable commands.

Full snapshots are simple conceptually but can duplicate unnecessary state, encourage recording transient UI events, and make command coalescing and revision-aware dirty state less explicit.

## Decision

NestlyPDF will use application-owned command history for committed document-output mutations.

- Presentation invokes application use cases and reads `canUndo`/`canRedo` state.
- History is not owned by React components.
- Pointer gestures commit one command on completion.
- Continuous text editing is coalesced into one meaningful history entry.
- Selection, focus, tool state, zoom, page navigation, and export are not commands.
- History is limited to 100 committed entries per active document session.
- History is memory-only and is cleared on close, replacement, disposal, or unload.
- Dirty state is revision-based rather than inferred from stack length.

The implementation may store reversible patches or compact before/after values. It must not duplicate original PDF bytes in history.

## Consequences

### Positive

- All editing paths share one undo/redo model.
- Toolbar and keyboard actions use the same application boundary.
- Future images, forms, annotations, and page operations can participate consistently.
- Dragging, resizing, and typing can be coalesced into understandable actions.
- Dirty state can correctly account for export and returning to a clean revision.
- Domain and presentation boundaries remain testable.

### Negative

- Command design and merge rules add implementation complexity.
- Each new output-changing feature must define reversible data and tests.
- Selection reconciliation is required when undo removes a selected element.
- History memory usage must be monitored as richer element types are added.

## Rejected alternatives

### React-owned undo and redo stacks

Rejected because history is application behavior shared by multiple presentation paths and future interfaces.

### Record every low-level mutation

Rejected because a drag or typing session would produce unusable history and excessive state churn.

### Persist history locally

Rejected because NestlyPDF intentionally discards document and editing state when the browser session ends.

### Clear history after export

Rejected because download is not an edit and users may need to continue working or undo after exporting.
