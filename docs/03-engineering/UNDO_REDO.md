# Undo and Redo

## User goal

Undo and redo let users recover from editing mistakes without making QuickPDF feel like a complex desktop publishing application.

The feature applies to document-output changes only.

## Undoable operations

The current implementation covers committed overlay lifecycle and gesture commands:

| Operation             |  Undo   |  Redo   |
| --------------------- | :-----: | :-----: |
| Add text              |   Yes   |   Yes   |
| Edit text typing      | Phase 3 | Phase 3 |
| Change text font size |   Yes   |   Yes   |
| Add whiteout          |   Yes   |   Yes   |
| Add signature         |   Yes   |   Yes   |
| Add initials          |   Yes   |   Yes   |
| Move an element       |   Yes   |   Yes   |
| Resize an element     |   Yes   |   Yes   |
| Duplicate an element  |   Yes   |   Yes   |
| Delete an element     |   Yes   |   Yes   |

Future output-changing operations must define undo and redo before they are considered complete.

## Not undoable

These actions do not enter document history:

- selecting or deselecting an element;
- entering or leaving text-editing mode;
- changing the active tool, including one-shot return to Select after Text, Signature, or Initials placement;
- opening or closing an inspector or dialog;
- zooming or fitting width;
- page navigation;
- rendering completion;
- exporting or downloading;
- opening a PDF;
- closing a PDF;
- browser refresh or navigation.

Discarding or replacing a dirty session still uses the existing confirmation flow. Undo does not cross a closed or replaced session boundary.

## Toolbar

The top toolbar includes Undo and Redo controls.

Requirements:

- controls show recognizable icons and accessible names;
- Undo is disabled when no undo entry exists;
- Redo is disabled when no redo entry exists;
- disabled state is visually clear and exposed semantically;
- controls do not shift the PDF viewport when their state changes;
- activation exits text-editing mode before applying history navigation;
- status feedback announces the completed action when practical.

## Keyboard shortcuts

| Platform      | Undo     | Redo                       |
| ------------- | -------- | -------------------------- |
| Windows/Linux | `Ctrl+Z` | `Ctrl+Shift+Z` or `Ctrl+Y` |
| macOS         | `Cmd+Z`  | `Cmd+Shift+Z`              |

Shortcut handling must:

- call the same application use cases as toolbar controls;
- prevent browser-native undo only when QuickPDF handles the shortcut;
- not hijack native text-field undo while the user is actively editing text or another form control;
- ignore repeated shortcuts while a history transition is pending;
- preserve browser zoom shortcuts and existing editor keyboard behavior.

## Text-edit behavior

Typing should feel natural.

- A newly created text element may enter editing immediately.
- Changes made during one continuous editing session are Phase 3 work and should undo as one meaningful text change once implemented.
- Undo while the textarea has focus should first follow the textarea's native editing behavior unless the product explicitly commits and exits editing before invoking document history.
- Once text editing is committed, application Undo restores the prior element text.
- Redo reapplies the committed text.

The implementation must choose one consistent focus rule and cover it with component and end-to-end tests. It must never delete the element when Backspace or Delete is intended to edit text.

## Pointer gestures

Dragging and resizing use preview state during the gesture. Phase 2 implements this for text, whiteout, signature, and initials overlays.

- Pointer down creates one transient gesture record with the element ID, start geometry, latest preview geometry, pointer ID when available, gesture type, movement flag, and finalized flag.
- Pointer movement updates the latest preview geometry and must not create hundreds of history entries.
- Releasing the pointer through the document-level pointer listener commits one command when geometry changed.
- Pointer cancellation or Escape restores the pre-gesture geometry and adds no history entry.
- Lost pointer capture does not drop the active gesture; the document listener still finalizes or cancels it.
- A gesture that ends at the original geometry is a no-op and adds no history entry.

Whiteout creation follows the same principle: the live rectangle is a preview, and a valid pointer release commits one Add Whiteout command.

## Active-tool behavior

Undo and redo do not change the active tool. For example, undoing a whiteout while Whiteout is active leaves Whiteout active.

History navigation must cancel any incomplete pointer preview before applying a committed transition.

## Selection behavior

Undoing creation or duplication of the selected element clears selection because the element no longer exists.

Undoing deletion may select the restored element to provide clear feedback. Redoing deletion then clears selection again.

For move, resize, and font-size changes, the affected element remains selected when possible. Text typing selection behavior remains part of the later coalescing phase.

## Dirty state and export

- Opening a PDF starts clean.
- The first committed edit makes it dirty.
- Undoing all changes back to the initial revision makes it clean.
- Successful export marks the current revision clean without clearing history.
- Undo after export may make the session dirty because it differs from the exported revision.
- Redo back to the exported revision makes it clean again.

The visible status must reflect the actual revision, not merely whether history exists.

## Session lifetime

Undo and redo history is available only while the current document remains open in the current browser session.

History is destroyed when the document is closed, replaced, or the page is unloaded. QuickPDF does not persist history.

## Accessibility

- Toolbar controls are keyboard reachable.
- Controls expose accessible names and disabled states.
- Successful history actions should be announced through the existing status region without excessive chatter.
- The active focus target remains predictable after undo or redo.
- Color is not the only indicator of availability.

## Test expectations

Required automated coverage includes:

- toolbar and keyboard invocation;
- disabled states;
- add, edit, font-size, move, resize, duplicate, and delete for every current overlay type;
- coalesced typing and pointer gestures;
- native editing-control shortcut guards;
- redo clearing after a new edit;
- clean/dirty revision transitions around export;
- session replacement and disposal;
- selection consistency;
- no browser zoom regression;
- export matching the current post-history state;
- no console or React warnings.
