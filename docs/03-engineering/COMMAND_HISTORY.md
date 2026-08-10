# Command History

## Purpose

Command history provides browser-memory-only undo and redo for the active NestlyPDF document session.

It is an application concern. The presentation layer may read capabilities such as `canUndo` and `canRedo` and invoke use cases, but it must not own or mutate the stacks.

## State model

```text
CommandHistory
- undoStack
- redoStack
- maximumEntries
- activeSessionId
```

The implementation may use two stacks or an equivalent cursor-based structure. Observable behavior must remain the same.

## Execution rules

When a new command succeeds:

1. apply the command atomically;
2. merge it with the previous command when allowed;
3. otherwise append it to undo history;
4. clear redo history;
5. enforce the history limit;
6. update dirty state from the resulting document state.

A failed or no-op command is not added.

## Undo rules

Undo:

- reverts the most recent committed history entry;
- moves that entry to redo history only after a successful revert;
- preserves all domain invariants;
- does not close the editor;
- does not change zoom or current page unless a future page command requires it for coherent feedback;
- exposes a disabled state when no undo entry exists.

## Redo rules

Redo:

- reapplies the next reverted history entry;
- moves it back to undo history only after successful application;
- is cleared by any new successful editing command after an undo;
- exposes a disabled state when no redo entry exists.

## History reset

History must be cleared when:

- a new PDF replaces the active document;
- the active document is closed;
- the session is disposed;
- the application returns to a no-document state;
- session creation fails after a previous session has already been disposed.

History must not carry across documents, tabs, reloads, or browser sessions.

## Export behavior

Export is not an editing command.

A successful export:

- leaves undo and redo history intact;
- marks the current document revision clean;
- keeps the editor open.

Further edits after export make the session dirty again.

Undo after export is allowed. Dirty state must then reflect whether the current revision differs from the most recently exported clean revision.

## Dirty-state model

Dirty state must not be implemented as “undo stack is non-empty.” A document can have history and still be clean after export, or return to a clean revision through undo.

The application should track a clean revision marker or an equivalent stable revision identity.

Conceptually:

```text
currentRevision === cleanRevision → clean
currentRevision !== cleanRevision → dirty
```

Opening a document establishes the initial clean revision. Successful export advances the clean revision marker to the current revision.

## History limit

The initial maximum is **100 committed entries per active session**.

When the limit is exceeded, discard the oldest undo entry. The limit applies after command coalescing, so one drag or one continuous text-editing session counts as one entry.

The value should be centralized and testable. It may be revisited if real browser-memory measurements justify a change.

## Memory and privacy

History exists only in browser memory.

History entries should store the smallest reversible state needed for the operation, such as:

- element identifiers;
- validated geometry;
- safe element property values;
- session-local image overlay data URLs and natural dimensions when required to undo/redo image operations;
- captured annotation values such as Date text in `MM/DD/YYYY` format;
- before/after values;
- insertion position when required.

The session-local overlay clipboard follows the same memory-only lifetime as history. It stores copied text, whiteout, signature, initials, image, checkmark, cross, and date overlay snapshots without retaining the original element ID. Date snapshots preserve the captured date text; paste does not recalculate today.

History and clipboard state must not:

- persist to local storage, IndexedDB, cookies, a backend, or analytics;
- contain duplicate copies of original PDF bytes;
- outlive the active document session;
- expose document contents in logs or error messages.

## Coalescing policy

The initial policy is:

- one pointer gesture equals one move or resize entry;
- one continuous text-editing focus session equals one update-text entry;
- repeated font-size adjustments during one control interaction may merge;
- separate element creations remain separate entries, including one-shot Checkmark, Cross, and Date placement;
- delete, duplicate, and paste remain separate entries;
- copy is not a command because it does not change document output;
- commands never merge across different elements or sessions.

## Selection after history navigation

After undo or redo:

- if the previously selected element still exists, selection may remain;
- if it no longer exists, selection must clear;
- re-created elements may be selected when doing so clearly confirms the action;
- text-editing mode must exit before history navigation;
- presentation state must never reference a missing element.

## Concurrency and reentrancy

Only one history transition may execute at a time.

Undo and redo controls must be disabled while an asynchronous command transition is pending. The current overlay commands are expected to be synchronous, but the boundary must not permit double execution or reentrant stack mutation.

## Required tests

Tests must cover:

- successful execute, undo, and redo;
- redo clearing after a new command;
- failed and no-op commands excluded from history;
- command coalescing;
- session reset and disposal;
- history limit eviction;
- clean revision behavior before and after export;
- undoing back to the clean revision;
- selection clearing when an element disappears;
- no persistence or network activity;
- invariant preservation through repeated undo/redo cycles.
