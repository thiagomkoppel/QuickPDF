# Editor Operations

## Operation requirements

Each operation must:

- have a stable operation type;
- validate its input;
- be deterministic;
- produce no partial state on failure;
- support undo when it changes document output;
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
