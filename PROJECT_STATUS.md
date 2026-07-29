# Project Status

## Current phase

Phase 0 - Architecture and technical proof of concept.

## Product status

Repository foundation initialized. The project has a Vite, React, and TypeScript static client scaffold with strict TypeScript, ESLint, Prettier, Vitest, React Testing Library, jsdom, Playwright, CI workflow, and an accessible application shell.

The first pure domain foundation is implemented: `DocumentSession`, page identity/order handling, minimal editor elements, selection, dirty-state tracking, page deletion, typed domain failures, and disposal behavior.

The first browser product feature is implemented: open and render one local PDF entirely in the browser. The viewer supports file picker input, drag-and-drop, byte-level PDF signature validation, empty/oversized/read failure errors, PDF.js parsing behind an infrastructure boundary, page metadata, current-page canvas rendering, page navigation, bounded zoom, fit width, render cancellation, replacement safety, and close-document disposal.

Editing tools, signing, form filling, page organization, export, thumbnails, undo/redo UI, and persistence are not implemented.

## Current objective

Prove that the application can safely and reliably:

1. open a local PDF without uploading it; Done for viewer proof of concept.
2. render one or more pages; Done for current-page rendering.
3. add text and a signature as overlay elements; Not started.
4. export a valid PDF containing those additions; Not started.
5. discard the document and editing state when the session ends; Started with close-document viewer disposal.

## Required Phase 0 deliverables

- Static web application scaffold. Done.
- Strict TypeScript configuration. Done.
- Test runner and browser test environment. Done.
- PDF engine abstraction. Started with focused PDF.js open/render/dispose port.
- Local file adapter. Started with browser-local PDF validation and reading.
- In-memory document session. Started with pure domain model.
- PDF rendering proof of concept. Done for active page canvas rendering.
- PDF export proof of concept. Not started.
- Text element. Started as minimal domain element type only; no UI or export behavior.
- Signature element. Not started.
- Undo and redo proof of concept. Not started.
- Privacy verification showing no document network requests. Started with architecture checks and Playwright external-request smoke coverage.
- Automated tests for the full proof-of-concept flow. Started for viewer-only flow.

## Not started

- PDF editing, signing, form filling, page organization, and export.
- Interactive form filling.
- Mobile editor tooling beyond responsive viewer controls.
- Whiteout and correction tools beyond a minimal domain element type.
- Accessibility audit.
- Large-document performance work beyond a configurable file size limit.

## Blocking decisions

- Canvas/SVG overlay implementation.
- Exact PDF export library after proof-of-concept validation.
- Long-term PDF.js version pinning policy beyond the current lockfile.

## Recent assessment

Local PDF viewer implemented on 2026-07-28 using PDF.js, browser File APIs, application-owned viewer state, and strict local-only lifecycle rules. Document-session domain foundation implemented on 2026-07-28 using strict TDD and pure TypeScript. Repository foundation implemented on 2026-07-28 using Vite, React, TypeScript, npm, Vitest, React Testing Library, jsdom, ESLint, Prettier, and Playwright configuration. The Vite SPA choice is documented in ADR-004.
