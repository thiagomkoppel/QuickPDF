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

Image

Checkmark

Icons only where practical.

---

# Inspector

Contextual.

Nothing selected:

Show nothing.

Text selected:

Show text properties.

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
