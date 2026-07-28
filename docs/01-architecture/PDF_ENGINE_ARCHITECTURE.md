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
