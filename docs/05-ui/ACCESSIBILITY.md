# NestlyPDF Accessibility

## Goal

NestlyPDF must support users who navigate with keyboards, touch, screen readers, magnification, reduced motion, and alternative input devices.

Accessibility is part of feature completion, not a later visual polish task.

## Semantic structure

Use semantic landmarks:

- header;
- main;
- navigation/toolbars where appropriate;
- dialogs;
- status/live regions.

Do not use generic `div` elements when a native interactive element is available.

## Keyboard navigation

All functions must be reachable without a mouse.

Required keyboard behavior includes:

- Tab/Shift+Tab through controls;
- visible focus;
- Enter/Space activate buttons;
- Enter edits selected text;
- Escape exits edit mode, cancels transient gestures, closes dialogs, or clears selection according to context;
- Delete/Backspace remove selected elements only outside editing controls;
- Undo/Redo shortcuts;
- Copy/Paste shortcuts;
- viewer zoom shortcuts.

Shortcut handlers must not interfere with native editing inside inputs, textareas, selects, contenteditable regions, or drawing surfaces.

## Focus visibility

Every interactive element must display a clear focus indicator.

- minimum contrast: WCAG AA expectations;
- focus must not be hidden beneath sticky toolbars or floating inspectors;
- selection outline is not a substitute for keyboard focus;
- focus order follows visual and task order.

## Toolbars

- use toolbar semantics where helpful;
- buttons require accessible names;
- active tool uses `aria-pressed` or equivalent;
- disabled Undo/Redo state must be exposed semantically;
- icon-only controls require tooltips but tooltips are not the accessible name.

## Selected elements

Selected overlays must expose:

- element type;
- selected state;
- page association where useful;
- instructions for edit/move/delete through accessible help text.

A text element must distinguish:

- selected;
- editing.

## Dialogs

Dialogs must:

- have an accessible name;
- trap focus;
- close with Escape when safe;
- restore focus to the invoking control;
- prevent background interaction;
- announce validation errors;
- avoid focus loss during tab changes.

## Drag and drop

Drag-and-drop must never be the only path.

The drop zone must support:

- click/tap file selection;
- keyboard activation;
- clear accepted-type information;
- announced validation and loading states.

## Pointer and touch

- touch targets: at least `44 × 44px`;
- resize handles enlarged for touch without changing exported geometry;
- no hover-only controls;
- pointer capture used for drag/resize/draw interactions;
- cancellation paths work through Escape or pointer cancellation.

## Screen readers

Announce important state changes without flooding:

- PDF opened;
- current page changed;
- active tool changed;
- element selected/deselected;
- unsaved/downloaded status;
- export started/completed/failed;
- invalid file or unsupported action.

Use polite live regions for routine status and assertive announcements only for blocking errors.

Do not announce every pointer preview update.

## Color and contrast

- text and controls meet WCAG AA contrast;
- active, selected, error, success, and disabled states never rely only on color;
- whiteout selection UI must remain visible against white page content without becoming exported content;
- focus and selection should remain distinguishable.

## Reduced motion

Respect `prefers-reduced-motion`.

When enabled:

- remove drop-zone floating/tilt/ripple;
- use immediate or minimal opacity transitions;
- avoid smooth-scroll dependence;
- retain state changes through text, border, and icon feedback.

No critical information may depend on animation.

## Zoom and magnification

- UI remains operable at browser zoom levels used for accessibility;
- editor viewer zoom remains separate from browser zoom;
- toolbar and inspector wrap/scroll instead of clipping;
- text remains readable;
- focus targets remain reachable.

## Error messages

Errors must:

- be associated with the relevant control;
- explain what happened and how to recover;
- avoid raw technical messages;
- not disappear before assistive technology can announce them.

## Forms

Use native labels and controls where possible.

- visible labels preferred;
- placeholders do not replace labels;
- numeric inputs expose bounds;
- font selector reports current value;
- validation is understandable and keyboard accessible.

## Testing requirements

At minimum:

- automated accessibility checks where practical;
- keyboard-only critical workflows;
- screen-reader smoke testing;
- reduced-motion behavior;
- color contrast review;
- mobile touch-target review;
- focus restoration after dialogs;
- sticky toolbar/floating inspector focus visibility;
- no shortcut conflicts during text editing.
