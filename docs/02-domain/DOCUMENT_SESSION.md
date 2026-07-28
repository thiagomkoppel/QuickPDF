# Document Session

## Responsibilities

- identify the current local document;
- own the logical page order;
- own editor elements;
- own current form values later;
- track whether downloadable changes exist;
- provide undo and redo later;
- close and release application references.

## State transitions

```text
Ready
-> Modified
-> Ready after explicit mark-clean/downloaded operation
-> Disposed
```

The broader application may still model loading and exporting states outside the pure domain session.

## Rules

- Only one active document session exists in the MVP.
- Opening another document requires closing or discarding the current session.
- A failed load returns to Empty at the application layer.
- A failed export returns to the previous usable state at the application layer.
- Disposed sessions reject mutation commands.
- Original PDF bytes are never mutated.
- The pure domain may hold an abstract source reference, but disposal clears it.

## Dirty-state policy

A session starts clean. Content and page-structure mutations mark it dirty, including adding, updating, or deleting elements; adding or deleting pages; and reordering pages.

Navigation and selection do not mark the session dirty. Clearing selection is idempotent and also does not mark the session dirty.

`markClean` is the explicit domain operation for marking the current state as downloaded or otherwise clean. Ordinary navigation never clears dirty state.

## Page deletion policy

Deleting the last remaining page is rejected. Deleting any other page removes that page and all elements owned by the page in one atomic operation.

If the deleted page was current, the current page moves to the nearest remaining page at the deleted page's position. If the selected element was removed with the page, selection is cleared.

Failed page deletion does not partially mutate page order, current page, selection, elements, or dirty state.

## Disposed-session access policy

Disposal is idempotent and privacy-critical. It clears pages, elements, current page, selection, temporary personal information, and abstract source references, and marks the session clean.

After disposal, read queries that expose document content or collections return safe empty results or `undefined`. Mutation operations return a typed `SessionDisposed` domain failure.

This is a domain behavior only; it does not claim immediate physical memory erasure by the JavaScript runtime.
