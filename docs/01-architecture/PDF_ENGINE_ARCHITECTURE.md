# PDF Engine Architecture

## Purpose

Keep PDF technology replaceable and prevent vendor-specific objects from leaking into the application.

## Current Phase 0 boundary

The implemented viewer uses a focused `PdfEngine` application contract for the current needs only:

- open a validated `Uint8Array` as a PDF document;
- return page count and page dimensions;
- render one requested page to a caller-provided canvas;
- cancel obsolete render work through `AbortSignal`;
- dispose document resources when the active session closes or is replaced.

PDF.js-specific documents, pages, render tasks, workers, exceptions, and worker URLs remain inside `src/infrastructure/pdf/pdfjs-engine.ts`.

## Required ports

```ts
interface PdfLoader {
  load(bytes: Uint8Array): Promise<LoadedPdf>;
}

interface PdfRenderer {
  renderPage(document: LoadedPdf, pageIndex: number, request: RenderRequest): Promise<RenderedPage>;
}

interface PdfExporter {
  export(request: ExportRequest): Promise<Uint8Array>;
}

interface PdfFormAdapter {
  readFields(document: LoadedPdf): Promise<ReadonlyArray<PdfFormField>>;
  applyValues(request: ApplyFormValuesRequest): Promise<void>;
}
```

These examples define long-term intent, not final implementation details. The current implementation intentionally covers only open, metadata, render, cancellation, and disposal.

## Render lifecycle

- Only the current page is rendered at full resolution.
- Page changes and zoom changes cancel obsolete render requests.
- The React editor owns the canvas element; the application service owns the active PDF handle.
- The PDF.js adapter scales the canvas for high-DPI displays while CSS dimensions remain viewport-sized.
- Stale render completions are ignored through a render sequence guard.
- Rendering failures map to stable application errors and preserve the open document.

## Rules

- `LoadedPdf` must be an application-owned opaque handle or metadata structure.
- Raw PDF.js and pdf-lib types must remain inside infrastructure adapters.
- Coordinates crossing the boundary must use documented units and origins.
- Export must operate from the original bytes plus deterministic session state when export is introduced.
- Rendering failure must not corrupt editor state.
- Export failure must preserve the open session so the user can retry.

## Coordinate systems

The system must explicitly distinguish:

- PDF coordinates, usually bottom-left origin;
- viewport coordinates, usually top-left origin;
- CSS pixels;
- device pixels;
- normalized editor coordinates.

The current `viewport-geometry` utilities cover only page-to-screen and screen-to-page point conversion needed for future overlays. Do not expand this into a larger geometry framework until a feature needs it.
