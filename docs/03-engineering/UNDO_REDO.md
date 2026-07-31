# Undo and Redo

## User goal

Undo and redo let users recover from editing mistakes without making QuickPDF feel like a complex desktop publishing application.

The feature applies to document-output changes only.

## Undoable operations

The initial implementation covers:

| Operation             | Undo | Redo |
| --------------------- | :--: | :--: |
| Add text              | Yes  | Yes  |
| Edit text             | Yes  | Yes  |
| Change text font size | Yes  | Yes  |
| Add whiteout          | Yes  | Yes  |
| Add signature         | Yes  | Yes  |
| Add initials          | Yes  | Yes  |
| Add image             | Yes  | Yes  |
| Add checkmark         | Yes  | Yes  |
| Add cross             | Yes  | Yes  |
| Add date              | Yes  | Yes  |
| Paste overlay         | Yes  | Yes  |
| Move an element       | Yes  | Yes  |
| Resize an element     | Yes  | Yes  |
| Duplicate an element  | Yes  | Yes  |
| Delete an element     | Yes  | Yes  |

Future output-changing operations must define undo and redo before they are considered complete.

## Not undoable

These actions do not enter document history:

- selecting or deselecting an element;
- copying an element into the session-local overlay clipboard;
- entering or leaving text-editing mode;
- changing the active tool, including one-shot return to Select after Text, Image, Signature, Initials, Checkmark, Cross, or Date placement;
- opening or closing an inspector or dialog;
- zooming or fitting width;
- page navigation;
- rendering completion;
- exporting or downloading;
- native browser copy/paste inside active editing controls;
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
- Changes made during one continuous editing session should undo as one meaningful text change.
- Undo while the textarea has focus should first follow the textarea's native editing behavior unless the product explicitly commits and exits editing before invoking document history.
- Once text editing is committed, application Undo restores the prior element text.
- Redo reapplies the committed text.

The implementation must choose one consistent focus rule and cover it with component and end-to-end tests. It must never delete the element when Backspace or Delete is intended to edit text.

## Pointer gestures

Dragging and resizing use preview state during the gesture.

- Pointer movement must not create hundreds of history entries.
- Releasing the pointer commits one command.
- Pointer cancellation or Escape restores the pre-gesture geometry and adds no history entry.
- A gesture that ends at the original geometry is a no-op and adds no history entry.

Whiteout creation follows the same principle: the live rectangle is a preview, and a valid pointer release commits one Add Whiteout command.

## Active-tool behavior

Undo and redo do not change the active tool. For example, undoing a whiteout while Whiteout is active leaves Whiteout active.

History navigation must cancel any incomplete pointer preview before applying a committed transition.

## Selection behavior

Undoing creation or duplication of the selected element clears selection because the element no longer exists.

Undoing deletion may select the restored element to provide clear feedback. Redoing deletion then clears selection again.

For move, resize, text, font-size, and image size changes, the affected element should remain selected when possible.

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

History and the session-local overlay clipboard are destroyed when the document is closed, replaced, or the page is unloaded. QuickPDF does not persist history or copied overlay snapshots.

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
- add, paste, edit where supported, font-size where supported, move, resize, duplicate, and delete for every current overlay type, including images and annotations;
- coalesced typing and pointer gestures;
- native editing-control shortcut guards;
- redo clearing after a new edit;
- clean/dirty revision transitions around export;
- session replacement and disposal;
- selection consistency;
- no browser zoom regression;
- export matching the current post-history state;
- no console or React warnings.
