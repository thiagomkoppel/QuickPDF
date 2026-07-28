# Domain Model

## Aggregates and entities

### DocumentSession

Owns the active document identity, page ordering, editor elements, current page, selected element, dirty state, lifecycle status, temporary personal information, and abstract source references.

The initial implementation supports `ready` and `disposed` lifecycle states. Loading/exporting states remain application-layer concerns until those workflows exist.

### DocumentPage

Represents one logical page in the current document arrangement. Page identity is stable and independent from ordering. Page dimensions must be positive and rotation must be supported.

### EditorElement

Represents content placed by the user over a page.

Supported initial domain element types are intentionally minimal:

- Text
- Date
- Checkmark
- Cross
- Whiteout
- Highlight

Signature, initials, image, form-field, export, and tool-specific formatting data remain deferred until their Phase 0 or MVP tasks require them.

### EditorOperation

Represents a meaningful reversible state change. History and undo/redo are not part of the first document-session foundation and remain deferred.

## Value objects

- DocumentSessionId
- PageId
- ElementId
- Bounds
- PageRotation

Future value objects include:

- Point
- Size
- Opacity
- FontSize
- Color
- PageIndex

Value objects validate their own constraints where they enter the domain and remain immutable.
