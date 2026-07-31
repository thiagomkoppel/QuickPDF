# EDITOR_INTERFACE.md

## Philosophy

The document is the application.

Everything else supports it.

---

# Layout

Top Toolbar

Left Tool Panel

Center PDF

Right Inspector

Bottom Page Navigation

---

# Toolbar

Contains:

Open

Download

Undo

Redo

Page

Zoom

Fit Width

No additional actions unless necessary.

The main editor toolbar remains visible while scrolling the PDF workspace. It stays in the editor shell above the PDF canvas and overlays, keeps a stable height, and preserves horizontal overflow access on smaller screens.

Undo and Redo are disabled when unavailable and expose accessible names and semantic disabled states. They call the same application use cases as keyboard shortcuts and do not change the active tool or shift the PDF viewport.

Keyboard shortcuts:

- `Ctrl+Z` / `Cmd+Z`: Undo;
- `Ctrl+Shift+Z` / `Cmd+Shift+Z`: Redo;
- Ctrl+Y: Redo on Windows and Linux;
- Ctrl+C / Cmd+C: Copy the selected overlay into QuickPDF's private session clipboard;
- Ctrl+V / Cmd+V: Paste the copied overlay onto the current page when the private clipboard has an element.

QuickPDF must not hijack native text-field undo, copy, or paste while the user is actively editing text or using another editing control.

---

# Left Toolbar

Contains tools only.

Examples:

Select

Text

Whiteout

Signature

Initials

Image

Checkmark

Icons only where practical.

---

# Inspector

Contextual.

Nothing selected:

Show nothing.

Text selected:

Show text properties, including a standard font-family selector and a simple 8-96 pt font-size control. The font-family selector uses bundled/browser-safe standard PDF families only: Helvetica, Times Roman, and Courier.

Whiteout selected:

Show whiteout properties.

The selected-element inspector is a compact floating control surface inside the editor shell, visually below the main toolbar and above the PDF canvas layer. It is not rendered after the page canvas in normal document flow, so showing or hiding it must not resize, shift, or misalign the rendered PDF page or overlay layer.

Do not overwhelm users.

---

# Layers

Very simple.

One list per page.

Capabilities:

Select

Delete

Bring Forward

Send Backward

---

# Status

Display:

Unsaved Changes

Downloaded

Exporting

Ready

---

# Zoom

Toolbar

Ctrl + Wheel

Ctrl + +

Ctrl + -

Ctrl + 0

Browser zoom must never change.

---

# PDF Area

This is always the visual priority.

Everything else should feel secondary.

## Export controls

The Download button generates a new edited PDF locally and keeps the editor open. Export progress is announced as status text. Export failure is shown as an alert and does not discard edits.

## Live PDF rendering

The editor workspace must show the actual active PDF page on a canvas. Placeholder-only pages are not acceptable once a document is open. Text and whiteout overlays sit above the canvas and share its CSS coordinate space.

While the current page is rendering, the UI shows rendering status. If rendering fails, the UI shows a recoverable error and keeps the session state intact.

## Undo And Redo

The editor toolbar includes Undo and Redo controls. They are disabled when the application history cannot move in that direction. Keyboard shortcuts are Ctrl+Z for undo and Ctrl+Y or Ctrl+Shift+Z for redo on Windows/Linux; Cmd+Z and Cmd+Shift+Z on macOS. Shortcuts do not override active text fields, text editing, selects, contenteditable controls, or the signature drawing canvas.

History covers adding, pasting, deleting, duplicating, moving, resizing, text-content editing, text font-size changes, and text font-family changes for the current overlay model. Undoing Add removes the added element and clears selection. Redoing Add restores and selects it. Undoing Delete restores and selects the deleted element. Redoing Delete removes it and clears selection. Undoing Duplicate removes the duplicate and restores selection to the original. Redoing Duplicate restores and selects the duplicate. Undoing Paste removes the pasted element and clears selection; redoing Paste restores and selects that same pasted element ID. Undoing text-content or text-appearance changes restores the previous committed value and keeps the element selected when possible.

Export marks the current revision clean but does not clear undo or redo history.

## Tools And Overlays

Text, Signature, and Initials are one-shot placement tools: after one accepted placement, the active tool returns to Select without creating a history entry or dirty-state change. Whiteout remains active after placement because repeated visual cover creation is a common workflow. Tool buttons expose `aria-pressed` and a visible active label.

Creating text is fast: activate Text, click the page, and the new selected text element enters editing immediately. The placement click creates exactly one text element, then the editor returns to Select. Clicking outside, pressing Escape, or using an explicit editor action commits the focus-session text edit without creating another text element; choosing Text again is required for another placement.

After creation, text selection and text editing are separate. A single click anywhere inside the visible text box selects the element for moving, resizing, duplicating, deleting, or changing text appearance. Double-clicking selected or unselected text, or pressing Enter while selected, enters text editing. Escape exits text editing, preserves and commits the current text, and keeps the element selected. Native textarea undo is preserved while the textarea has focus.

Copy and paste are canvas-overlay operations only. Copying keeps the current selection and does not mark the document dirty. Pasting creates a new selected overlay on the current page, offsets it from the copied snapshot, clamps it inside the page bounds, and marks the document dirty. The private overlay clipboard never uses browser clipboard APIs and is cleared when the document closes or is replaced.`r`n`r`nWith the Select tool active, clicking empty page space clears the selected overlay. Clicking an overlay selects it, dragging a selected overlay moves it, and clicking resize handles or editor controls does not trigger empty-space deselection. Clicking empty workspace outside the PDF page follows the same clearing policy unless the click is on editor controls.

Creating whiteout uses pointer drag: activate Whiteout, press on the page, drag to define the rectangle, and release to create it. Tiny accidental drags are ignored. Whiteout remains a visual cover only.

Unselected text, whiteout, signature, and initials overlays have no decorative borders. Selected overlays may show temporary editor-only outlines and resize handles. Text uses a corner resize handle that preserves aspect ratio and scales the text font size between 8 and 96 pt; the inspector font-size and font-family values stay synchronized and export uses the displayed standard font and size. These selection affordances are never exported.

## Signatures And Initials

The Signature command opens a modal with Draw, Type, and Upload tabs. Drawn and uploaded signatures are transparent image overlays. Typed signatures use application-bundled/system font choices only; no remote fonts are loaded.

The Initials command opens the same modal pattern with Draw and Type tabs only. Initials do not support upload in this milestone.

Accepted signatures and initials become normal overlay elements and immediately return the active tool to Select. They can be selected, moved, resized, duplicated, deleted, and exported. No signature or initials data is persisted after the browser session ends.
