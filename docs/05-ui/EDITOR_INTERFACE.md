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

Show text properties, including a simple 8-96 pt font-size control.

Whiteout selected:

Show whiteout properties.

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

## Tools And Overlays

The active tool remains active until the user chooses another tool. Tool buttons expose `aria-pressed` and a visible active label.

Creating text is fast: activate Text, click the page, and the new selected text element enters editing immediately.

After creation, text selection and text editing are separate. A single click anywhere inside the visible text box selects the element for moving, resizing, duplicating, deleting, or changing font size. Double-clicking selected or unselected text, or pressing Enter while selected, enters text editing. Escape exits text editing, preserves the current text, and keeps the element selected.

Creating whiteout uses pointer drag: activate Whiteout, press on the page, drag to define the rectangle, and release to create it. Tiny accidental drags are ignored. Whiteout remains a visual cover only.

Unselected text, whiteout, signature, and initials overlays have no decorative borders. Selected overlays may show temporary editor-only outlines and resize handles. These selection affordances are never exported.

## Signatures And Initials

The Signature command opens a modal with Draw, Type, and Upload tabs. Drawn and uploaded signatures are transparent image overlays. Typed signatures use application-bundled/system font choices only; no remote fonts are loaded.

The Initials command opens the same modal pattern with Draw and Type tabs only. Initials do not support upload in this milestone.

Accepted signatures and initials become normal overlay elements. They can be selected, moved, resized, duplicated, deleted, and exported. No signature or initials data is persisted after the browser session ends.
