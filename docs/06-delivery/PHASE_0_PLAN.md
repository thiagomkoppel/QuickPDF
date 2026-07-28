# Phase 0 Plan

## Goal

Prove the core privacy and PDF-editing architecture before building the complete interface.

## Workstreams

### 1. Repository foundation

- TypeScript strict configuration.
- Application scaffold.
- Unit, component, and end-to-end test setup.
- Linting and formatting.
- CI workflow.

### 2. Domain foundation

- DocumentSession.
- PageModel.
- EditorElement union.
- Add, move, update, and delete operations.
- Undo and redo.

### 3. PDF boundary

- PdfLoader port.
- PdfRenderer port.
- PdfExporter port.
- PDF.js rendering adapter.
- Initial export adapter.

### 4. Browser boundary

- Local file picker.
- Drag-and-drop.
- Download adapter.
- Unsaved-change warning.
- Session cleanup.

### 5. Proof-of-concept UI

- Open PDF.
- Render active page.
- Add text.
- Add drawn signature.
- Move and resize elements.
- Download edited PDF.

### 6. Verification

- Automated end-to-end test.
- Network isolation test.
- Export opens in multiple PDF readers.
- Cleanup behavior test.

## Exit criteria

Phase 0 is complete only when all proof-of-concept behavior is tested and the PDF engine remains isolated behind ports.
