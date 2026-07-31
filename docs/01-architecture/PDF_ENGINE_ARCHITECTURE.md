# PDF Engine Architecture

## Purpose

Keep PDF technology replaceable and prevent vendor-specific objects from leaking into the application.

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

These examples define intent, not final implementation details.

## Rules

- `LoadedPdf` must be an application-owned opaque handle or metadata structure.
- Raw PDF.js and pdf-lib types must remain inside infrastructure adapters.
- Coordinates crossing the boundary must use documented units and origins.
- Export must operate from the original bytes plus deterministic session state.
- Rendering failure must not corrupt editor state.
- Export failure must preserve the open session so the user can retry.

## Coordinate systems

The system must explicitly distinguish:

- PDF coordinates, usually bottom-left origin;
- viewport coordinates, usually top-left origin;
- CSS pixels;
- device pixels;
- normalized editor coordinates.

Conversions must be centralized, unit-tested, and never duplicated inside components.

## Export boundary

The first export milestone uses `pdf-lib` only inside `src/infrastructure/pdf`. Application and presentation code depend on an application-facing export interface, not on `pdf-lib` types.

The export adapter loads the original PDF bytes, draws opaque white rectangles for whiteout overlays, draws text using the deterministic built-in Helvetica font supported by `pdf-lib`, and returns new PDF bytes for the browser download adapter.

Overlay coordinates use page-space top-left origin. Export maps them into PDF bottom-left coordinates. Viewer zoom and device pixel ratio do not affect export placement.

## Rendering boundary

The first live viewer milestone uses `pdfjs-dist` only inside `src/infrastructure/pdf`. The application stores an opaque render document id after opening a local PDF; React receives that id and asks the infrastructure renderer to draw the active page into a supplied canvas.

The renderer configures the PDF.js worker through Vite's worker URL handling, loads from in-memory bytes with streaming and auto-fetch disabled, and maps failures to stable `RenderFailed` editor errors. Development diagnostics may log a non-sensitive error name and render context, but not filenames, bytes, or document content.

Canvas sizing uses viewport CSS dimensions for layout and `devicePixelRatio` for the backing store. Overlays remain in page-space top-left coordinates and are scaled into CSS pixels by the viewer. Export continues to use unscaled page coordinates, so zoom and high-DPI rendering do not change downloaded placement.

Render tasks are cancelable. The viewer cancels stale work on page, zoom, document, or unmount changes and ignores results from older render sequences.
