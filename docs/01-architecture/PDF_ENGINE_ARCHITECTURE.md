# PDF Engine Architecture

## Purpose

Keep PDF technology replaceable and prevent vendor-specific objects from leaking into the application.

## Current boundary

The implemented PDF engine boundary supports:

- open a document from validated bytes;
- return page count and page dimensions;
- render one requested page into a canvas;
- cancel obsolete render work;
- dispose document resources.

PDF.js documents, pages, render tasks, exceptions, and worker URLs remain inside `src/infrastructure/pdf`.

## Overlay relationship

The PDF canvas is the immutable visual background. Text and whiteout edits are rendered as DOM overlays above the canvas and never repaint or mutate PDF content. Export is deferred and will need to combine original PDF bytes with deterministic editor state.

## Rules

- `LoadedPdf` must be an application-owned opaque handle or metadata structure.
- Raw PDF.js and pdf-lib types must remain inside infrastructure adapters.
- Coordinates crossing the boundary must use documented units and origins.
- Export must operate from the original bytes plus deterministic session state.
- Rendering failure must not corrupt editor state.
- Export failure must preserve the open session so the user can retry.

## Coordinate systems

The current coordinate utility covers:

- page-to-screen point conversion;
- screen-to-page point conversion;
- page-to-screen rectangle conversion;
- screen-to-page rectangle conversion;
- cursor-anchor scroll calculation for wheel zoom.

Do not expand this into a generic matrix framework until a feature requires it.
