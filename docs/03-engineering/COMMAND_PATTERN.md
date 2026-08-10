# Command Pattern

## Purpose

NestlyPDF represents every committed document-output mutation as an application command. Commands provide one consistent path for validation, state transition, undo, redo, dirty-state updates, and testing.

Pointer events, keystrokes, focus changes, selection changes, page navigation, zoom, dialog state, and other transient presentation events are not commands by themselves.

## Boundary

The presentation layer requests editor use cases. It does not manipulate history stacks or construct reversible state transitions directly.

```text
Presentation
    ↓
Editor application use case
    ↓
Command execution and history
    ↓
DocumentSession transition
```

The domain remains independent of React, browser APIs, PDF.js, and `pdf-lib`.

## Command contract

A command must:

- have a stable command type;
- validate all required input before mutation;
- target one active document session;
- be deterministic for the same starting state and input;
- apply atomically or fail without partial mutation;
- preserve domain invariants;
- contain enough reversible data to undo the committed transition;
- avoid storing original PDF bytes or document text in logs or telemetry;
- expose only metadata safe for tests and diagnostics.

A conceptual contract is:

```ts
interface EditorCommand {
  readonly type: EditorCommandType;
  execute(state: EditorState): CommandResult;
  undo(state: EditorState): CommandResult;
  redo(state: EditorState): CommandResult;
  canMergeWith?(next: EditorCommand): boolean;
  mergeWith?(next: EditorCommand): EditorCommand;
}
```

The concrete implementation may use immutable snapshots, reversible patches, or before/after element values. It does not need to follow this TypeScript shape exactly.

## Initial command coverage

The first undo/redo milestone must cover all currently supported output-changing operations:

- add text;
- update text;
- change text font size;
- add whiteout;
- add signature;
- add initials;
- move element;
- resize element;
- duplicate element;
- delete element.

Future page, form, image, and annotation operations must enter history through the same boundary.

## Transaction boundaries

A command represents one meaningful user action, not every low-level input event.

### Pointer gestures

```text
pointer down
→ preview updates during pointer move
→ pointer up
→ one committed MoveElement or ResizeElement command
```

No history entry is added while a gesture is only being previewed.

### Text editing

A text-editing session may emit live visual updates, but history must coalesce the session into a meaningful change. At minimum, edits made during one continuous focus session should undo as one action.

The implementation may later add time-based or word-boundary coalescing, but it must never make every keystroke a separate history entry by default.

### Font-size changes

Repeated stepper changes may be coalesced while the control remains active. A direct committed value change may be one command.

## Merge rules

Commands may merge only when all of the following are true:

- they have compatible command types;
- they target the same session and element;
- no unrelated command occurred between them;
- merging preserves the original pre-change state and final post-change state;
- undo still represents one understandable user action.

Add, duplicate, delete, signature creation, initials creation, and whiteout creation do not merge with unrelated commands.

## Selection and editing state

Selection and presentation-local editing state are not part of document history.

Undo or redo may update selection only when needed to keep the UI coherent. For example, undoing element creation may clear selection if that element no longer exists. Such selection correction is a consequence of the document transition, not a separate history entry.

## Failure behavior

- Failed commands do not enter history.
- Undo or redo failure must not partially mutate the session.
- The history cursor moves only after a successful transition.
- Errors are mapped through the existing application error boundary.
- A recoverable failure keeps the editor open and preserves the last valid state.

## Prohibited designs

Do not:

- keep independent undo stacks in React components;
- add type-specific history paths for text, whiteout, signature, or initials;
- store browser event objects in commands;
- record zoom, selection, hover, modal, focus, or page-navigation changes;
- serialize original document bytes into command metadata;
- use export as a history command;
- bypass application use cases for direct domain mutation.
