# QuickPDF Editor Interface

## Purpose

This document defines the final editor layout and interaction model.

The document is the application. Every control exists to help the user complete the PDF quickly.

## Primary layout

Recommended hierarchy:

```text
Application header, when present
Sticky main editor toolbar
Compact floating selected-element inspector, when selected
Scrollable PDF editor viewport
Compact document status region
```

The PDF canvas and overlay share one aligned page frame within the viewport.

## Application header

The header should be minimal.

Possible contents:

- QuickPDF wordmark;
- local file name;
- current document status;
- optional help/shortcuts entry.

Do not duplicate the full editor toolbar in the header.

## Sticky main toolbar

The toolbar remains visible while the editor viewport scrolls.

It must:

- sit above PDF content;
- preserve a stable height;
- avoid covering the page unexpectedly;
- remain keyboard navigable;
- adapt through horizontal scrolling, grouping, or compact labels on narrow layouts.

### Logical groups

#### File

- Open local PDF
- Download edited PDF

#### Edit

- Undo
- Redo
- Copy
- Paste

#### Insert and tools

- Select
- Text
- Whiteout
- Image
- Signature
- Initials
- Checkmark
- Cross
- Date

#### View

- Zoom out
- Zoom value
- Zoom in
- Reset zoom
- Fit width

#### Pages

- Previous page
- Current page / total pages
- Next page

The toolbar may visually reorganize, but these logical groups must remain understandable.

## Active tool

Every tool button must clearly indicate active state through:

- `aria-pressed` or equivalent semantics;
- primary background or outline;
- contrasting icon/text;
- optional small `Active` label in prototype/accessible layouts;
- visible keyboard focus independent from active state.

Users must never have to guess which tool is active.

## Tool policies

### One-shot tools

After one element is placed, return to Select:

- Text
- Image
- Signature
- Initials
- Checkmark
- Cross
- Date

### Persistent tool

Whiteout remains active after drawing so multiple regions can be covered efficiently.

### Select

Select is the neutral/default tool.

Clicking empty page or empty editor workspace while Select is active clears the current selection.

Tool changes:

- are presentation state;
- create no document history;
- do not mark dirty;
- do not invalidate Redo.

## PDF viewport

The editor viewport:

- owns scrolling;
- remains stable while the page zoom changes;
- contains the PDF page frame, canvas, and overlay;
- owns the non-passive modified-wheel zoom listener;
- fills available central space;
- uses a neutral background that distinguishes the page edge.

The page frame should cast a very subtle shadow and must not resemble a card-heavy dashboard.

## Zoom

Supported controls:

- toolbar buttons;
- zoom value/readout;
- fit width;
- reset;
- `Ctrl/Cmd + wheel` inside the editor viewport;
- `Ctrl/Cmd + +`;
- `Ctrl/Cmd + -`;
- `Ctrl/Cmd + 0`.

Browser page zoom must remain unchanged while the editor handles these shortcuts.

Modified-wheel gestures remain contained even at the viewer minimum and maximum zoom.

Zoom, fit width, and navigation never mark the document dirty or create history entries.

## Selected-element inspector

The inspector is compact, persistent while selected, and outside the PDF document flow.

Preferred placement:

- a horizontal floating bar below the toolbar; or
- a narrow right-side panel on large screens.

It must not:

- appear at the bottom of a long PDF page;
- reflow or shift the canvas;
- obscure a large portion of the PDF;
- disappear during scrolling.

### Shared controls

For every supported overlay:

- element type/status;
- Copy;
- Duplicate;
- Delete.

### Text controls

- font family;
- font size;
- future color/alignment only when explicitly implemented.

### Image/signature/initials controls

- dimensions when useful;
- no advanced image editing in the initial interface.

The inspector must not trap focus.

## Selection model

### Text

- new text enters edit mode automatically;
- single click existing text selects;
- double-click or Enter enters editing;
- Escape exits editing and keeps selection;
- click outside commits/exits and applies normal deselection policy;
- Delete/Backspace deletes the selected element only when not editing text.

### Other overlays

- single click/tap selects;
- drag moves;
- corner handles resize;
- click empty space with Select active deselects.

### Borders

Unselected overlays have no decorative border.

Selected overlays display editor-only selection UI that is never exported.

## Move and resize

- pointer gestures preview live;
- one completed gesture creates one history entry;
- Escape or pointer cancellation restores the starting state;
- no-op gestures create no history;
- selection remains after move/resize;
- text corner resize scales font size proportionally;
- images preserve aspect ratio during inspector and corner-handle resize;
- signatures and initials keep their current resize behavior;
- whiteout supports rectangular resizing.

## Images

Image insertion uses only browser-local File APIs.

Supported file types:

- PNG;
- JPG;
- JPEG.

Workflow:

1. Activate Image.
2. Choose a supported local image file.
3. QuickPDF validates and decodes the image in the browser.
4. The editor enters image placement mode.
5. Click the PDF page to place the image centered on that point.
6. The image is clamped inside the page and selected.

Images export as shown, including PNG transparency and JPG/JPEG images. Image data is session-only, participates in copy/paste and undo/redo through the shared overlay lifecycle, and is cleared when the document is closed or replaced.

Unsupported formats such as GIF, SVG, WebP, PDF-as-image, cropping, rotation, filters, opacity, and layer effects are intentionally out of scope.

## Whiteout

Whiteout creation uses click-drag:

1. Activate Whiteout.
2. Pointer down starts preview.
3. Drag defines the rectangle in any direction.
4. Release commits a valid whiteout.
5. Tiny accidental drags are ignored.
6. Tool remains active.

Whiteout is always described as visual cover only, never secure redaction.

## Text controls

Initial supported standard fonts:

- Helvetica;
- Times Roman;
- Courier.

Font changes update preview and export, preserve top-left anchoring, and are undoable.

Font size range: `8–96`.

## Copy and paste

Overlay clipboard shortcuts:

- `Ctrl/Cmd+C` — copy selected overlay;
- `Ctrl/Cmd+V` — paste copied overlay.

The overlay clipboard is session-local and application-owned.

Inside active text editing, native text copy/paste remains available and overlay shortcuts must not interfere.

Pasted overlays:

- receive a new ID;
- appear with a predictable bounded offset;
- are selected;
- create one undoable history entry;
- preserve image data and dimensions when the copied overlay is an image.

## Undo and redo

Controls:

- sticky toolbar buttons;
- `Ctrl/Cmd+Z` — Undo;
- `Ctrl+Y` or `Ctrl/Cmd+Shift+Z` — Redo.

History includes all current output-changing overlay operations.

History does not include:

- selection;
- tool switching;
- zoom;
- page navigation;
- opening inspector controls;
- copy without paste;
- export itself.

## Status

Show a compact document state:

- `Unsaved changes`;
- `Downloaded`;
- `Exporting…`;
- recoverable error.

After export, the current revision becomes clean. Further edits become dirty again.

## Dialogs

Signature and Initials dialogs:

- Draw;
- Type;
- Upload for Signature where supported;
- Clear;
- Accept;
- Cancel.

They must trap focus, support Escape, and restore focus.

Image selection uses a local file picker and validation state. Unsupported, unreadable, oversized, and corrupted image files must show friendly errors without leaving placement mode active.

## Responsive behavior

Desktop:

- full sticky toolbar;
- floating horizontal inspector or right-side inspector;
- generous viewport.

Tablet:

- toolbar groups may horizontally scroll;
- inspector wraps or becomes a compact sheet;
- touch targets increase.

Mobile:

- primary tools move to a bottom or compact sticky toolbar;
- secondary controls use drawers/sheets;
- inspector becomes a small bottom sheet or horizontally scrollable bar;
- PDF remains the largest visible region.

## Keyboard shortcuts

At minimum:

- Undo/Redo;
- Copy/Paste;
- Delete/Backspace selected element;
- Enter edit text;
- Escape exit/cancel/deselect according to context;
- viewer zoom shortcuts.

A shortcut help dialog may be added later.

## Explicitly avoid

- multiple stacked toolbars;
- inspector below the full canvas;
- floating windows scattered over the PDF;
- hidden essential actions;
- advanced controls for unsupported features;
- exported selection borders;
- browser-level zoom while using editor zoom;
- UI state stored in document history.
