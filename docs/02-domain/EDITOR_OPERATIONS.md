# Editor Operations

## Operation requirements

Each operation must:

- have a stable operation type;
- validate its input;
- be deterministic;
- produce no partial state on failure;
- define reversible before/after state when it changes document output;
- be serializable for debugging and testing without including document contents.

## Pointer interaction

UI pointer events are not domain operations by themselves.

Example:

```text
pointer down
→ many pointer moves
→ pointer up
→ one MoveElement operation
```

## Duplication

Duplicating an element creates a new identifier and a small offset while preserving editable properties.

## Page deletion

Deleting the last remaining page is not allowed unless the product later defines an empty-document state.

## Command history boundary

Committed output-changing operations enter history through the application layer. The domain validates and applies transitions but does not depend on React, keyboard shortcuts, toolbar controls, or browser event objects.

Selection, focus, active-tool changes, zoom, page navigation, and live pointer previews are not document operations.

## No-op behavior

An operation that produces no document-output change succeeds as a no-op or returns an explicit no-change result and must not create a history entry or mark the session dirty.
