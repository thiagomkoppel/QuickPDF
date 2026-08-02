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
- add temporary text overlay elements as one-shot placements, including bounded font-size changes and proportional text resize;
- add temporary whiteout visual cover rectangles by click-drag creation;
- add drawn, typed, and uploaded signature overlays as one-shot placements;
- add drawn and typed initials overlays as one-shot placements;
- add PNG, JPG, and JPEG image overlays through a browser-local file picker and click-to-place workflow;
- add checkmark, cross, and captured-date annotation overlays as one-shot placements;
- select, move, resize, duplicate, delete, and session-local copy/paste text, whiteout, signature, initials, image, checkmark, cross, and date overlays;
- undo and redo overlay add, paste, duplicate, delete, move, resize, text/date font-size, text/date resize, and image/annotation lifecycle commands with revision-based dirty state;
- export the current PDF with text, whiteout, signature, initials, image, checkmark, cross, and date overlays embedded;
- preserve original page count, page dimensions, page order, and untouched content during export;
- download the edited PDF through a browser adapter using a temporary object URL;
- keep the editor session open after successful download;
- mark the current session clean after successful download;
- preserve the current session when export fails.

Not implemented: form filling, page organization, OCR, secure redaction, native editing of existing PDF text, arbitrary symbol picker, stickers, emojis, date picker, time/timestamps, custom annotation colors, annotation rotation, image cropping, image rotation, image filters, image opacity, persistence, backend services.

UI redesign progress: the shared presentation tokens and branded, browser-local landing experience are complete. The landing page now provides accessible click-to-browse and drag-and-drop opening states, local processing messaging, reduced-motion support, and recoverable opening errors. Part 2 of the UI redesign now provides the full-viewport Compact Professional desktop editor shell: a compact application header, grouped command toolbar, collapsible rail with browser-local PDF.js page thumbnails, dominant central PDF viewport, contextual right inspector, and compact status/navigation bar. Page selection uses stable page IDs, and Previous, Next, direct thumbnail selection, Fit Page, Fit Width, and 100% manual view synchronize the rendered page and visible indicators without entering history or changing dirty state. Signature and Initials dialogs now use the same dark compact design language. New text, date, typed/drawn signature or initials, checkmark, and cross overlays render and export black by default. Editor routes without an active in-memory document now redirect directly to the landing page, preserving the session-only privacy model.

## Current objective

Prove that the application can safely and reliably:

1. open a local PDF without uploading it; Done for proof of concept.
2. add text, visual whiteout, signatures, initials, images, checkmarks, crosses, and dates as overlay elements; Done for current page.
3. export a valid PDF containing those additions; Done for text, whiteout, signature, initials, image, checkmark, cross, and date overlays.
4. discard the document and editing state when the session ends; Started; full warning lifecycle remains future work.

## Blocking decisions

- Live PDF rendering adapter and visual fidelity checks.
- Export coordinate behavior for rotated pages beyond the current metadata-preserving baseline.
- Undo/redo command history model.
- Larger fixture set and PDF complexity limits.

## Recent assessment

Live PDF rendering now uses PDF.js behind an infrastructure boundary. The editor renders the active page to a canvas, aligns overlays in CSS page units, supports temporary signature, initials, image, checkmark, cross, and date overlays, and keeps export coordinates independent from zoom and device pixel ratio.
