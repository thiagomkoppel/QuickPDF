# Project Status

## Current phase

Phase 0 - Architecture and technical proof of concept.

## Product status

Repository foundation initialized. The project has a Vite, React, and TypeScript static client scaffold with strict TypeScript, ESLint, Prettier, Vitest, React Testing Library, jsdom, Playwright configuration, CI workflow, and an accessible application shell.

Implemented proof-of-concept behavior:

- open one local PDF through browser File APIs;
- validate basic PDF file properties and signature bytes;
- parse PDF page metadata with `pdf-lib` behind an infrastructure adapter;
- render the active PDF page with PDF.js on a real canvas;
- size the canvas backing store with device pixel ratio while keeping CSS dimensions in page-space scale;
- keep text and whiteout overlays aligned over the rendered canvas during zoom;
- add temporary text overlay elements, including bounded font-size changes;
- add temporary whiteout visual cover rectangles by click-drag creation;
- add drawn, typed, and uploaded signature overlays;
- add drawn and typed initials overlays;
- select, move, resize, duplicate, and delete text, whiteout, signature, and initials overlays;
- export the current PDF with text, whiteout, signature, and initials overlays embedded;
- preserve original page count, page dimensions, page order, and untouched content during export;
- download the edited PDF through a browser adapter using a temporary object URL;
- keep the editor session open after successful download;
- mark the current session clean after successful download;
- preserve the current session when export fails.

Not implemented: checkmarks, images, form filling, undo/redo, page organization, OCR, secure redaction, native editing of existing PDF text, persistence, backend services.

## Current objective

Prove that the application can safely and reliably:

1. open a local PDF without uploading it; Done for proof of concept.
2. add text, visual whiteout, signatures, and initials as overlay elements; Done for current page.
3. export a valid PDF containing those additions; Done for text, whiteout, signature, and initials overlays.
4. discard the document and editing state when the session ends; Started; full warning lifecycle remains future work.

## Blocking decisions

- Live PDF rendering adapter and visual fidelity checks.
- Export coordinate behavior for rotated pages beyond the current metadata-preserving baseline.
- Undo/redo command history model.
- Larger fixture set and PDF complexity limits.

## Recent assessment

Live PDF rendering now uses PDF.js behind an infrastructure boundary. The editor renders the active page to a canvas, aligns overlays in CSS page units, supports temporary signature and initials overlays, and keeps export coordinates independent from zoom and device pixel ratio.
